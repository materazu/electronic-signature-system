import express from 'express';
import nunjucks from 'nunjucks';
import bodyParser from 'body-parser';
import DocumentGeneratorService from './src/services/document-generator.js';
import dotenv from 'dotenv';

import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

dotenv.config();

const app = express();
const port = process.env.PORT;

const adapter = new JSONFile('./db.json');
const defaultData = { documents: [] };
const db = new Low(adapter, defaultData);

const documentGeneratorService = new DocumentGeneratorService(db);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

nunjucks.configure('views', {
  autoescape: true,
  express: app
});

/**
 * Step one, generate a document with this example body :
 *
 * {
 *  "documentId": "1XepPF4SkS3iVsO2xgPr_3HOPlTpjlK7nQ_RK3Faqsdqsd",
 *  "information": {
 *     "firstname": "Julien",
 *     "lastname": "Moulin",
 *     "date": "25/04/2023"
 *    }
 *  }
 */
app.post('/generate-document', async (req, res) => {
  await documentGeneratorService.generateDocument(req.body);

  res.json({ message: 'ok' });
});

/**
 * Step 2 : see log on your server, node give you the link
 */
app.get('/sign/:id', async (req, res) => {
  await db.read();
  const document = db.data.documents.find(document => document.id === +req.params.id);

  res.render('index.html', { id: document.id, port: process.env.PORT });
});

/**
 * Step 3 : handle by front page, send signature and generate doc + stamp
 */
app.post('/sign/:id', async (req, res) => {
  await db.read();
  const document = db.data.documents.find(document => document.id === +req.params.id);

  if (+req.body.smsCode !== document.smsCode) {
    return res.sendStatus(401);
  }

  await documentGeneratorService.handleSign(req.body.signature, document);

  res.json({ message: 'ok' });
});

app.listen(port, _ => console.log(`server start on port ${port}`));