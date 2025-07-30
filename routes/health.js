const express = require('express');
const router = express.Router();
const { getDocumentCount } = require('../utils/documentStore');

router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'PDF Chat Backend Server is running with OpenAI',
    timestamp: new Date().toISOString(),
    documentsInMemory: getDocumentCount(),
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    aiModel: 'OpenAI GPT-4',
  });
});

module.exports = router; 