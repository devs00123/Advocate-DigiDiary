const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../server/app');
const User = require('../server/models/User');
const LawFirm = require('../server/models/LawFirm');
const Case = require('../server/models/Case');
const Client = require('../server/models/Client');
const Hearing = require('../server/models/Hearing');
const AuditLog = require('../server/models/AuditLog');

let mongoServer;
let adminCookie;
let clerkCookie;
let testFirm;
let adminUser;
let clerkUser;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Setup test firm
  testFirm = await LawFirm.create({
    name: 'Singhania & Partners LLP',
    address: 'Saket District Courts Complex, New Delhi',
    barCouncilRegistration: 'D/1429/2011',
  });

  // Setup Admin user
  const adminRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Adv. Rajesh Singhania',
      email: 'rajesh.admin@singhania.law',
      password: 'SuperAdminPassword@2026',
      firmName: 'Singhania & Partners LLP',
      barCouncilRegistration: 'D/1429/2011',
    });

  // Elevate to admin role explicitly
  adminUser = await User.findOne({ email: 'rajesh.admin@singhania.law' });
  adminUser.role = 'admin';
  await adminUser.save();

  // Login as Admin
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'rajesh.admin@singhania.law',
      password: 'SuperAdminPassword@2026',
    });

  adminCookie = adminLogin.headers['set-cookie'];

  // Setup Clerk user
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  const clerkHash = await bcrypt.hash('ClerkPass@2026', salt);

  clerkUser = await User.create({
    lawFirmId: testFirm._id,
    name: 'Ramesh Clerk',
    email: 'ramesh.clerk@singhania.law',
    passwordHash: clerkHash,
    role: 'clerk',
  });

  const clerkLogin = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'ramesh.clerk@singhania.law',
      password: 'ClerkPass@2026',
    });

  clerkCookie = clerkLogin.headers['set-cookie'];

  // Setup sample client
  const sampleClient = await Client.create({
    lawFirmId: testFirm._id,
    name: 'Metro Rail Corporation',
    email: 'legal@metrorail.in',
    phone: '+91 98110 22334',
    clientType: 'Corporate',
    createdBy: adminUser._id,
  });

  // Populate some sample cases and audit logs
  const sampleCase = await Case.create({
    lawFirmId: testFirm._id,
    clientId: sampleClient._id,
    caseNumber: 'ARB/102/2026',
    cnrNumber: 'DLHC010022332026',
    title: 'Metro Rail Corp v. Infra Builders',
    court: 'High Court of Delhi',
    status: 'Active',
    agreedFee: 500000,
    createdBy: adminUser._id,
  });

  await Hearing.create({
    lawFirmId: testFirm._id,
    caseId: sampleCase._id,
    clientId: sampleClient._id,
    date: new Date('2026-10-15'),
    court: 'High Court of Delhi',
    purpose: 'Oral Arguments',
    status: 'Scheduled',
    createdBy: adminUser._id,
  });

  await AuditLog.create({
    lawFirmId: testFirm._id,
    userId: adminUser._id,
    userName: adminUser.name,
    userEmail: adminUser.email,
    action: 'CASE_CREATED',
    entityType: 'Case',
    entityId: sampleCase._id,
    description: 'Case registered by admin',
    ipAddress: '127.0.0.1',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Super Admin & Platform Telemetry Security & APIs', () => {
  it('1. Unauthenticated request to /api/admin/telemetry returns 401', async () => {
    const res = await request(app).get('/api/admin/telemetry');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('2. Authenticated Clerk request to /api/admin/telemetry returns 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/admin/telemetry')
      .set('Cookie', clerkCookie);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Forbidden/i);
  });

  it('3. Admin can retrieve platform telemetry and metrics', async () => {
    const res = await request(app)
      .get('/api/admin/telemetry')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('advocateRoster');
    expect(res.body.data.advocateRoster.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data).toHaveProperty('totalPlatformViews');
    expect(res.body.data).toHaveProperty('activeConcurrent');
    expect(res.body.data).toHaveProperty('dataFootprintGB');
    expect(res.body.data).toHaveProperty('moduleTraffic');
  });

  it('4. Admin can list advocates with pagination and search', async () => {
    const res = await request(app)
      .get('/api/admin/advocates?search=Rajesh')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].email).toBe('rajesh.admin@singhania.law');
    expect(res.body.pagination).toHaveProperty('total');
  });

  it('5. Admin can retrieve real-time live event feed from AuditLog', async () => {
    const res = await request(app)
      .get('/api/admin/live-feed')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('action');
    expect(res.body.data[0]).toHaveProperty('icon');
  });

  it('6. Admin can inspect system health and database status', async () => {
    const res = await request(app)
      .get('/api/admin/health-report')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('database');
    expect(res.body.data.database.engine).toBe('MongoDB Atlas');
    expect(res.body.data).toHaveProperty('documentCounts');
    expect(res.body.data.documentCounts.cases).toBeGreaterThanOrEqual(1);
  });

  it('7. Admin can invite and provision a new Chamber Head', async () => {
    const res = await request(app)
      .post('/api/admin/invite')
      .set('Cookie', adminCookie)
      .send({
        name: 'Adv. Meenakshi Lekhi',
        email: 'm.lekhi.test@supremecourt.org',
        firmName: 'Meenakshi Lekhi & Associates',
        enrollmentNumber: 'D/884/2004',
        role: 'advocate',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('m.lekhi.test@supremecourt.org');
    expect(res.body.data).toHaveProperty('temporaryPassword');

    // Verify user exists in database
    const created = await User.findOne({ email: 'm.lekhi.test@supremecourt.org' });
    expect(created).not.toBeNull();
    expect(created.name).toBe('Adv. Meenakshi Lekhi');
  });

  it('8. Admin can trigger purge of stale temporary records', async () => {
    const res = await request(app)
      .post('/api/admin/purge-stale')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('deletedCount');
  });

  it('9. Admin can stream full audit logs as CSV without file persistence', async () => {
    const res = await request(app)
      .get('/api/admin/export-audit')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/SuperAdmin_Audit_Trail\.csv/);
    expect(res.text).toContain('"Timestamp"');
    expect(res.text).toContain('"Action"');
  });
});
