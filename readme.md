# electronic-signature-system

Ce bout de code est lié à l'article de blog sur SupraDev : https://supradev.co/blog/implementer-un-system-de-signature-electronique

Il présente une solution maison pour générer des documents, les faire signer, et les tamponner numériquement.

Je vous renvoie à l'article en question pour comprendre de quoi il en retourne.

## Utilisation

Pour lancer le projet, après un `npm i`, vous devrez lancer le serveur `node .`
Vous devez éditer le `.env` pour fournir des informations sur le path vers votre certificat P12 et aussi mettre à jour le fichie token.json avec votre json d'api google lié à votre compte de service.

Il vous faudra également produire un document de test, vous pouvez utiliser le miens comme base : https://docs.google.com/document/d/1XepPF4SkS3iVsO2xgPr_3HOPlTpjlK7nQ_RK3FaL0G4/edit?usp=sharing

Le reste coule de source, mais pensez à regarder la console node, j'ai mis quelques logs utiles ;)

Pour les besoins du projet, tout est sauvegardé en base Json local avec lowDB, libre à vous de faire évoluer tout ça.