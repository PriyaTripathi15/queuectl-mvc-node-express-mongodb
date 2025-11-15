require('dotenv').config();

module.exports = {
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/queuectl',
  port: process.env.PORT || 3000,
  retryBase: parseFloat(process.env.RETRY_BASE || '2'),
  defaultMaxRetries: parseInt(process.env.DEFAULT_MAX_RETRIES || '3', 10),
};
