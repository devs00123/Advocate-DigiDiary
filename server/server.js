const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const { connectDB, disconnectDB } = require('./config/database');

const PORT = parseInt(process.env.PORT, 10) || 5050;

const startServer = async () => {
  try {
    await connectDB();

    if (process.env.SEED_ON_EMPTY === 'true') {
      const User = require('./models/User');
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        console.log('[SEED] Empty database detected with SEED_ON_EMPTY=true. Populating initial chamber data...');
        const seedData = require('./scripts/seed');
        await seedData();
      }
    }

    // Ensure Master Super Admin exists
    try {
      const User = require('./models/User');
      const LawFirm = require('./models/LawFirm');
      const bcrypt = require('bcryptjs');
      const superEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@digidiary.com').toLowerCase();
      let existingSuper = await User.findOne({ email: superEmail });
      if (!existingSuper) {
        let firm = await LawFirm.findOne();
        if (!firm) {
          firm = await LawFirm.create({
            name: 'Advocate DigiDiary Platform Administration',
            chamberNumber: 'Master Suite 001',
            address: 'Supreme Court Commercial Arcade, New Delhi',
            email: superEmail,
            barCouncilRegistration: 'D/ROOT/2026',
          });
        }
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@2026', salt);
        await User.create({
          name: 'Master Super Administrator',
          email: superEmail,
          phone: '+91 99999 00000',
          passwordHash,
          role: 'superadmin',
          designation: 'Platform Super Administrator',
          enrollmentNumber: 'D/ROOT/2026',
          lawFirmId: firm._id,
          emailVerified: true,
          lastLogin: new Date(),
        });
        console.log(`[SUPERADMIN] Master Super Administrator provisioned: ${superEmail}`);
      } else if (existingSuper.role !== 'superadmin') {
        existingSuper.role = 'superadmin';
        await existingSuper.save();
        console.log(`[SUPERADMIN] Role elevated to 'superadmin' for: ${superEmail}`);
      }
    } catch (adminErr) {
      console.warn('[SUPERADMIN] Notice provisioning superadmin:', adminErr.message);
    }

    const listenOnPort = (portToTry) => {
      const server = app.listen(portToTry, () => {
        console.log(`\n=============================================================`);
        console.log(`  ADVOCATE DIGIDIARY — Production Legal Practice System`);
        console.log(`  Mode:        ${process.env.NODE_ENV || 'development'}`);
        console.log(`  Server URL:  http://localhost:${portToTry}`);
        console.log(`  Health:      http://localhost:${portToTry}/api/health`);
        console.log(`  Admin:       http://localhost:${portToTry}/admin.html`);
        console.log(`=============================================================\n`);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[PORT NOTICE] Port ${portToTry} is already in use. Trying port ${portToTry + 1}...`);
          listenOnPort(portToTry + 1);
        } else {
          console.error('[SERVER ERROR]', err.message);
          process.exit(1);
        }
      });

      const shutdown = async (signal) => {
        console.log(`\n[SHUTDOWN] Received ${signal}. Closing server gracefully...`);
        server.close(async () => {
          console.log('[SHUTDOWN] HTTP server closed.');
          await disconnectDB();
          process.exit(0);
        });

        setTimeout(() => {
          console.error('[SHUTDOWN] Forcefully terminating after timeout.');
          process.exit(1);
        }, 10000);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    };

    listenOnPort(PORT);
  } catch (err) {
    console.error('[FATAL SERVER ERROR] Could not initialize server:', err.message);
    process.exit(1);
  }
};

startServer();
