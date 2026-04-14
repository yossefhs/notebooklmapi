const express = require('express');

const app = express();
app.use(express.json());

require('./notebooklm-route')(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur web NotebookLM démarré sur le port ${PORT}`);
});
