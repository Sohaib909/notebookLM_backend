const multer = require('multer');

function errorHandler(error, req, res, next) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum size is 50MB.',
        success: false,
      });
    }
  }
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    success: false,
  });
}

module.exports = errorHandler; 