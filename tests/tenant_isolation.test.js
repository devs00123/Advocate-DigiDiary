/**
 * Test Suite: Multi-Tenant Data Isolation (Firm A vs Firm B)
 * Verifies that Firm A can NEVER read, update, delete, search or aggregate Firm B data.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_tenant_isolation_999';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server/app');

let mongoServer;
let cookieFirmA;
let cookieFirmB;
let caseFirmAId;
let clientFirmAId;
let hearingFirmAId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Register Firm A
  const resA = await request(app)
    .post('/api/auth/register')
    .send({
      firmName: 'Firm A Legal Partners',
      name: 'Advocate Alice',
      email: 'alice@firm-a.law',
      password: 'Password@FirmA2026'
    });
  cookieFirmA = resA.headers['set-cookie'];

  // Register Firm B
  const resB = await request(app)
    .post('/api/auth/register')
    .send({
      firmName: 'Firm B Chambers',
      name: 'Advocate Bob',
      email: 'bob@firm-b.law',
      password: 'Password@FirmB2026'
    });
  cookieFirmB = resB.headers['set-cookie'];
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Strict Tenant Isolation Verification', () => {
  it('Firm A creates a client, case, hearing and note', async () => {
    // 1. Client
    const clientRes = await request(app)
      .post('/api/clients')
      .set('Cookie', cookieFirmA)
      .send({
        name: 'Firm A Top Secret Client',
        clientType: 'Corporate',
        email: 'secret@clienta.com'
      });
    expect(clientRes.status).toBe(201);
    clientFirmAId = clientRes.body.data._id;

    // 2. Case
    const caseRes = await request(app)
      .post('/api/cases')
      .set('Cookie', cookieFirmA)
      .send({
        title: 'Firm A Confidential Dispute vs Union of India',
        caseNumber: 'FA-WP-9999/2026',
        court: 'Supreme Court of India',
        clientId: clientFirmAId,
        partyRole: 'Petitioner',
        totalAgreedFee: 500000
      });
    expect(caseRes.status).toBe(201);
    caseFirmAId = caseRes.body.data._id;

    // 3. Hearing
    const hearingRes = await request(app)
      .post('/api/hearings')
      .set('Cookie', cookieFirmA)
      .send({
        caseId: caseFirmAId,
        hearingDate: '2026-11-20',
        purpose: 'Final Hearing on Constitutional Validity'
      });
    expect(hearingRes.status).toBe(201);
    hearingFirmAId = hearingRes.body.data._id;

    // 4. Note
    const noteRes = await request(app)
      .post('/api/notes')
      .set('Cookie', cookieFirmA)
      .send({
        caseId: caseFirmAId,
        title: 'Firm A Confidential Legal Arguments',
        content: 'Article 14 and Article 21 violation grounds.'
      });
    expect(noteRes.status).toBe(201);
  });

  it('Firm B cannot retrieve Firm A case by ID (Must return 404)', async () => {
    const res = await request(app)
      .get(`/api/cases/${caseFirmAId}`)
      .set('Cookie', cookieFirmB);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('Firm B case list must not contain Firm A cases', async () => {
    const res = await request(app)
      .get('/api/cases')
      .set('Cookie', cookieFirmB);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  it('Firm B cannot update Firm A case (Must return 404)', async () => {
    const res = await request(app)
      .put(`/api/cases/${caseFirmAId}`)
      .set('Cookie', cookieFirmB)
      .send({
        title: 'Hacked by Firm B'
      });

    expect(res.status).toBe(404);

    // Verify Firm A case title was untouched
    const verifyRes = await request(app)
      .get(`/api/cases/${caseFirmAId}`)
      .set('Cookie', cookieFirmA);
    expect(verifyRes.body.data.title).toBe('Firm A Confidential Dispute vs Union of India');
  });

  it('Firm B cannot delete Firm A case (Must return 404)', async () => {
    const res = await request(app)
      .delete(`/api/cases/${caseFirmAId}`)
      .set('Cookie', cookieFirmB);

    expect(res.status).toBe(404);

    // Verify still exists in Firm A
    const verifyRes = await request(app)
      .get(`/api/cases/${caseFirmAId}`)
      .set('Cookie', cookieFirmA);
    expect(verifyRes.status).toBe(200);
  });

  it('Firm B global search (Ctrl+K) must never find Firm A records', async () => {
    const res = await request(app)
      .get('/api/search?q=Confidential')
      .set('Cookie', cookieFirmB);

    expect(res.status).toBe(200);
    expect(res.body.data.cases.length).toBe(0);
    expect(res.body.data.notes.length).toBe(0);
  });

  it('Firm B cannot see Firm A clients or hearings', async () => {
    const clientRes = await request(app)
      .get(`/api/clients/${clientFirmAId}`)
      .set('Cookie', cookieFirmB);
    expect(clientRes.status).toBe(404);

    const hearingRes = await request(app)
      .get(`/api/hearings/${hearingFirmAId}`)
      .set('Cookie', cookieFirmB);
    expect(hearingRes.status).toBe(404);
  });

  it('Firm B cannot see Firm A audit logs', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Cookie', cookieFirmB);

    expect(res.status).toBe(200);
    // Firm B should only see its own audit logs (e.g. registration)
    res.body.data.forEach(log => {
      expect(log.description).not.toMatch(/Firm A/);
    });
  });

  it('Server ignores spoofed lawFirmId in request body (Injected from authenticated session)', async () => {
    // Attempt to create a client with Firm B's fake lawFirmId while authenticated as Firm A
    const res = await request(app)
      .post('/api/clients')
      .set('Cookie', cookieFirmA)
      .send({
        name: 'Spoof Test Client',
        clientType: 'Individual',
        lawFirmId: '666666666666666666666666' // Spoofed ID
      });

    expect(res.status).toBe(201);
    // Should NOT have the spoofed ID; must have Firm A's real ID
    expect(res.body.data.lawFirmId).not.toBe('666666666666666666666666');
  });
});
