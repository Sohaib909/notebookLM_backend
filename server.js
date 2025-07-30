const app = require('./app');
const OpenAIService = require('./services/openaiService');
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`🚀 PDF Chat Backend Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 AI Model: OpenAI GPT-4`);

  // Check for required environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  WARNING: OPENAI_API_KEY not found in environment variables');
    console.warn('   The app will work with basic responses. Add OpenAI API key for AI features.');
    console.warn('   Get your API key at: https://platform.openai.com/api-keys');
  } else {
    console.log('✅ OpenAI API key configured');
    
    // Test OpenAI service availability
    const openaiService = new OpenAIService();
    const testResult = await openaiService.testConnection();
    
    if (testResult.success) {
      console.log('✅ OpenAI service is available and responding');
    } else {
      console.warn('⚠️  OpenAI service test failed:', testResult.error);
    }
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
