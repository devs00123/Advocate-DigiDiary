const mongoose = require('mongoose');

let mongoMemoryServer = null;

const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  let uri = process.env.MONGODB_URI;

  if (isProduction) {
    if (!uri) {
      console.error('\n[FATAL DATABASE ERROR] MONGODB_URI environment variable is missing in production!');
      console.error('Advocate DigiDiary strictly requires a configured MongoDB Atlas URI in production mode.\n');
      process.exit(1);
    }

    try {
      console.log('[DATABASE] Connecting to MongoDB Atlas in production mode...');
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
      });
      console.log('[DATABASE] Successfully connected to production MongoDB Atlas.');
      return mongoose.connection;
    } catch (err) {
      console.error('\n[FATAL DATABASE ERROR] Failed to connect to MongoDB Atlas in production:');
      console.error(err.message);
      console.error('Application cannot start without a healthy production database connection.\n');
      process.exit(1);
    }
  }

  if (isTest) {
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoMemoryServer = await MongoMemoryServer.create();
      uri = mongoMemoryServer.getUri();
      await mongoose.connect(uri);
      console.log('[DATABASE] Connected to isolated in-memory MongoDB for testing.');
      return mongoose.connection;
    } catch (err) {
      console.error('[DATABASE] Test memory server error:', err.message);
      throw err;
    }
  }

  // Development environment
  if (uri) {
    try {
      console.log(`[DATABASE] Connecting to MongoDB in development (${uri.replace(/:([^:@]{3,})@/, ':****@')})...`);
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 4000,
      });
      console.log('[DATABASE] Successfully connected to MongoDB.');
      return mongoose.connection;
    } catch (err) {
      console.warn('\n[DATABASE WARNING] Could not connect to configured MONGODB_URI in development mode.');
      console.warn(`Error: ${err.message}`);
      console.warn('[DATABASE WARNING] Starting embedded development database so you can test immediately...\n');
    }
  }

  // Fallback for development if local mongod is not installed/running
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoMemoryServer = await MongoMemoryServer.create();
    const fallbackUri = mongoMemoryServer.getUri();
    await mongoose.connect(fallbackUri);
    console.log('[DATABASE NOTICE] Running on local development embedded database.');
    return mongoose.connection;
  } catch (err) {
    console.error('[DATABASE ERROR] Failed to start embedded development database:', err.message);
    throw err;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
    }
    console.log('[DATABASE] Disconnected.');
  } catch (err) {
    console.error('[DATABASE] Disconnect error:', err.message);
  }
};

module.exports = { connectDB, disconnectDB };
