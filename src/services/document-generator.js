import { Auth, google } from 'googleapis';
import gdoctableapp from 'gdoctableapp';
import fs from 'fs';
import { plainAddPlaceholder, SignPdf } from 'node-signpdf';

export default class DocumentGeneratorService {
  drive;
  docs;
  auth;
  db;

  /**
   * Get Authorization on Google Api and create drive / docs
   */
  constructor(db) {
    this.db = db;

    this.authorize()
      .then(auth => {
        this.drive = google.drive({version: 'v3', auth});
        this.docs = google.docs({version: 'v1', auth});
      })
    ;
  }

  /**
   * Request authorization to call APIs
   *
   * @returns client
   */
  async authorize() {
    const googleAuth = new Auth.GoogleAuth({
      keyFile: process.env.CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive'],
    });

    this.auth = await googleAuth.getClient();

    return this.auth;
  }

  /**
   * Generate new document, fill information and export to PDF
   *
   * @param {*} params with documentId and information for document
   */
  async generateDocument(params) {
    const { name, documentId } = await this.createCopy(params);
    await this.fillInformation(params.information, documentId);
    await this.exportPdf(name, documentId);

    const id = Date.now();
    const smsCode = Math.floor(Math.random() * 900000);

    this.db.data.documents.push({
      id,
      name,
      documentId,
      smsCode,
    });

    await this.db.write();

    console.log(`Document was generated, go to http://localhost:${process.env.PORT}/sign/${id} to sign it with the smsCode ${smsCode}`);
  }

  /**
   * Handle the signature process
   */
  async handleSign(signature, document) {
    const documentId = document.documentId;

    await this.insertSignature(signature, documentId);
    await this.fillInformation({
      mention: `Ce document a été signé numériquement (${Date().toString()}) par certificat P12`
    }, document.documentId);
    await this.exportPdf(document.name, documentId, true);
  }

  /**
   * Create a copy from source document
   *
   * @param {*} params
   *
   * @returns name and documentId as objet params
   */
  async createCopy(params) {
    const template = await this.docs.documents.get({
      documentId: params.documentId,
    });

    const name = `${template.data.title}_${params.information.firstname}_${params.information.lastname}`;

    const newDoc = await this.drive.files.copy({
      fileId: params.documentId,
      resource: { name },
    });

    return { name, documentId: newDoc.data.id };
  }

  /**
   * Replace all {{ key }} in document by given values
   *
   * @param {*} information object
   * @param {*} documentId where to replace information
   */
  async fillInformation(information, documentId) {
    const requests = Object.keys(information).map(key => (
      {
        replaceAllText: {
          containsText: {
            text: `{{ ${key} }}`,
            matchCase: true,
          },
          replaceText: information[key],
        },
      })
    );

    await this.docs.documents.batchUpdate(
      {
        documentId,
        requestBody: {
          requests,
        },
      }
    );
  }

  /**
   * Insert signature in document in place of {{ signature }} placeholder
   *
   * @param {*} signature png base64
   * @param {*} documentId where to replace signature
   *
   * @returns Promise who inform the replacement is done
   */
  async insertSignature(signature, documentId) {
    return new Promise((resolve, reject) => {
      const base64Data = signature.replace(/^data:image\/png;base64,/, '');
      const path = `./documents/${Date.now()}.png`;

      fs.writeFileSync(path, base64Data, 'base64');

      const resource = {
        auth: this.auth,
        documentId,
        searchText: '{{ signature }}',
        imageWidth: 150,
        imageHeight: 150,
        replaceImageFilePath: path,
      };

      gdoctableapp.ReplaceTextsToImages(resource, (err, done) => {
        if (err) {
          console.log(err);
          resolve(err);
        } else {
          console.log(done);
          resolve(done);
        }
      });
    })
  }

  /**
   * Add stamp to document
   *
   * @param {*} filePath of the file to sign
   */
  numericSignDocument(filePath) {
    let pdfBuffer = fs.readFileSync(filePath);

    pdfBuffer = plainAddPlaceholder({
      pdfBuffer,
      reason: 'Signature process end.',
      signatureLength: 1612,
    });

    const p12Buffer = fs.readFileSync(process.env.P12_CERTIFICATE);

    const signer = new SignPdf();

    pdfBuffer = signer.sign(pdfBuffer, p12Buffer, {
      passphrase: process.env.P12_PASSWORD,
    });

    fs.writeFileSync(filePath, pdfBuffer);

    console.log(`Stamp added to document.`);
  }

  /**
   * Export a PDF version of the document locally
   *
   * @param {*} name of the document to export
   * @param {*} fileId of the document
   * @param {*} needStamp tell if we need stamp
   */
  async exportPdf(name, fileId, needStamp) {
    const path = `./documents/${name}.pdf`;
    const dest = fs.createWriteStream(path);

    const { data } = await this.drive.files.export({
      fileId,
      mimeType: 'application/pdf',
    }, {
      responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
      data
        .on('end', async () => {
          console.log(`document save to ${path}`);

          if (needStamp) {
            await this.numericSignDocument(path);
          }

          resolve(path);
        })
        .on('error', (err) => {
          console.log('Error during download', err);
          reject();
        })
        .pipe(dest);
    });
  }
}