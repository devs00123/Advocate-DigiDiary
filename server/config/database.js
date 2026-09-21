const mongoose = require('mongoose');

let mongoMemoryServer = null;

const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  let uri = process.env.MONGODB_URI;

  if (isProduction) {
    if (!uri) {
      console.error('\n=============================================================');
      console.error('  [FATAL DATABASE ERROR] MONGODB_URI is missing in production!');
      console.error('=============================================================');
      console.error('  Please set the MONGODB_URI environment variable in your');
      console.error('  Render Dashboard (Environment tab).');
      console.error('  Example: mongodb+srv://user:pass@cluster.mongodb.net/advocate_digidiary?retryWrites=true&w=majority');
      console.error('=============================================================\n');
      if (process.env.ALLOW_FALLBACK_DB === 'true') {
        return startFallbackDB();
      }
      process.exit(1);
    }

    // Check for common placeholder errors like <password>
    if (uri.includes('<username>') || uri.includes('<password>') || uri.includes('<') || uri.includes('>')) {
      console.error('\n=============================================================');
      console.error('  [DATABASE CONFIGURATION WARNING] Unreplaced placeholders found in MONGODB_URI!');
      console.error('  Your URI contains literal "<" or ">" characters.');
      console.error('  Be sure to replace "<password>" with your real password,');
      console.error('  without the angle brackets.');
      console.error('=============================================================\n');
    }

    // Attempt connection with retries
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[DATABASE] Connecting to MongoDB Atlas (attempt ${attempt}/${maxRetries})...`);
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 8000,
          connectTimeoutMS: 10000,
        });
        console.log('[DATABASE] Successfully connected to production MongoDB Atlas.');
        return mongoose.connection;
      } catch (err) {
        console.error(`[DATABASE] Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
        if (attempt < maxRetries) {
          console.log('[DATABASE] Retrying in 3 seconds...');
          await new Promise((r) => setTimeout(r, 3000));
        } else {
          console.error('\n=============================================================');
          console.error('  [FATAL DATABASE ERROR] Failed to connect to MongoDB Atlas in production:');
          console.error(`  ${err.message}`);
          console.error('=============================================================');
          console.error('  HOW TO FIX IN MONGODB ATLAS (Top 3 Causes):');
          console.error('  1. IP WHITELIST (Most Common):');
          console.error('     Render instances have dynamic outbound IPs.');
          console.error('     In MongoDB Atlas -> Network Access -> "+ Add IP Address"');
          console.error('     Click "ALLOW ACCESS FROM ANYWHERE" (0.0.0.0/0) -> Confirm.');
          console.error('  2. SPECIAL CHARACTERS IN PASSWORD:');
          console.error('     If your DB password has characters like @, #, :, /, %, ?');
          console.error('     they MUST be URL-encoded (e.g. @ becomes %40).');
          console.error('  3. REMOVE ANGLE BRACKETS:');
          console.error('     Do not leave < > around the password or username.');
          console.error('  4. EMERGENCY FALLBACK:');
          console.error('     Set ALLOW_FALLBACK_DB=true in Render Environment variables');
          console.error('     to keep the website online while fixing Atlas settings.');
          console.error('=============================================================\n');

          if (process.env.ALLOW_FALLBACK_DB === 'true') {
            return startFallbackDB();
          }
          process.exit(1);
        }
      }
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
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 10000,
      });
      console.log('[DATABASE] Successfully connected to MongoDB.');
      return mongoose.connection;
    } catch (err) {
      console.warn('\n[DATABASE WARNING] Could not connect to configured MONGODB_URI in development mode.');
      console.warn(`Error: ${err.message}`);
      console.warn('[DATABASE WARNING] Starting embedded development database so you can test immediately...\n');
    }
  }

  // Fallback for development or emergency production mode
  return startFallbackDB();
};

const startFallbackDB = async () => {
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoMemoryServer = await MongoMemoryServer.create();
    const fallbackUri = mongoMemoryServer.getUri();
    await mongoose.connect(fallbackUri);
    console.log('\n=============================================================');
    console.log('  [DATABASE NOTICE] Running on embedded database fallback.');
    console.log('=============================================================\n');
    return mongoose.connection;
  } catch (err) {
    console.error('[DATABASE ERROR] Failed to start embedded fallback database:', err.message);
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
