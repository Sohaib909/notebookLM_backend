const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('./middleware/rateLimit');
const upload = require('./middleware/upload');
const errorHandler = require('./middleware/errorHandler');
require('dotenv').config();

const healthRoutes = require('./routes/health');
const pdfRoutes = require('./routes/pdf');
const chatRoutes = require('./routes/chat');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api/', rateLimit);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/upload-pdf', upload, pdfRoutes);
app.use('/api/chat', chatRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    success: false,
  });
});

module.exports = app; 