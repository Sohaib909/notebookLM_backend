const express = require('express');
const router = express.Router();
const PDFService = require('../services/pdfService');
const { addDocument, getDocument, hasDocument } = require('../utils/documentStore');
const path = require('path');

// Upload PDF endpoint
router.post('/', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No PDF file provided',
        success: false,
      });
    }

    console.log(`Processing PDF: ${req.file.originalname} (${req.file.size} bytes)`);

    // Parse PDF with enhanced functionality from saved file
    const pdfData = await PDFService.parsePDFFromFile(req.file.path);
    
    // Generate unique document ID
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store document with page information and file path
    const document = {
      filename: req.file.originalname,
      filePath: req.file.path, // Store file path for serving
      content: pdfData.text,
      pages: pdfData.pages,
      numPages: pdfData.numPages,
      uploadedAt: new Date(),
      size: req.file.size,
      info: pdfData.info,
      metadata: pdfData.metadata,
    };

    addDocument(documentId, document);

    console.log(`PDF processed successfully: ${pdfData.text.length} characters extracted, ${pdfData.numPages} pages`);

    // Return response with document info
    res.json({
      success: true,
      documentId: documentId,
      filename: req.file.originalname,
      contentLength: pdfData.text.length,
      numPages: pdfData.numPages,
      preview: pdfData.text.substring(0, 500) + (pdfData.text.length > 500 ? '...' : ''),
      fullContent: pdfData.text,
      pages: pdfData.pages,
    });
  } catch (error) {
    console.error('Error processing PDF:', error.message);
    res.status(500).json({
      error: 'Failed to process PDF',
      details: error.message,
      success: false,
    });
  }
});

// Get document information endpoint
router.get('/:id', (req, res) => {
  const documentId = req.params.id;

  if (hasDocument(documentId)) {
    const doc = getDocument(documentId);
    res.json({
      success: true,
      document: {
        id: documentId,
        filename: doc.filename,
        uploadedAt: doc.uploadedAt,
        size: doc.size,
        contentLength: doc.content.length,
        numPages: doc.numPages,
        preview: doc.content.substring(0, 500),
        pages: doc.pages,
      },
    });
  } else {
    res.status(404).json({
      error: 'Document not found',
      success: false,
    });
  }
});

// Get specific page content
router.get('/:id/page/:pageNumber', (req, res) => {
  const documentId = req.params.id;
  const pageNumber = parseInt(req.params.pageNumber);

  if (hasDocument(documentId)) {
    const doc = getDocument(documentId);
    
    if (pageNumber >= 1 && pageNumber <= doc.numPages) {
      const page = doc.pages[pageNumber - 1];
      res.json({
        success: true,
        page: {
          pageNumber: pageNumber,
          content: page.text,
          documentId: documentId,
        },
      });
    } else {
      res.status(400).json({
        error: 'Invalid page number',
        success: false,
      });
    }
  } else {
    res.status(404).json({
      error: 'Document not found',
      success: false,
    });
  }
});

// Serve the actual PDF file
router.get('/:id/file', (req, res) => {
  const documentId = req.params.id;

  if (hasDocument(documentId)) {
    const doc = getDocument(documentId);
    
    if (doc.filePath && require('fs').existsSync(doc.filePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
      res.sendFile(doc.filePath);
    } else {
      res.status(404).json({
        error: 'PDF file not found',
        success: false,
      });
    }
  } else {
    res.status(404).json({
      error: 'Document not found',
      success: false,
    });
  }
});

module.exports = router; 