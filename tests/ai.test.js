const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../server/app');
const User = require('../server/models/User');
const LawFirm = require('../server/models/LawFirm');

let mongoServer;
let authCookie;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const firm = await LawFirm.create({
    name: 'Sharma & Associates',
    chamberNumber: 'Chamber 101',
  });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('TestPass@123', salt);
  const user = await User.create({
    name: 'Advocate Test User',
    email: 'advocate_test@digidiary.com',
    passwordHash,
    role: 'advocate',
    lawFirmId: firm._id,
  });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'advocate_test@digidiary.com', password: 'TestPass@123' });

  authCookie = loginRes.headers['set-cookie'];
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('AI Legal Assistant & Document Summarizer API', () => {
  test('POST /api/ai/chat should reject unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ prompt: 'Tell me about Section 138 NI Act' });

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/ai/chat should require prompt', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Cookie', authCookie)
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/ai/chat should return structured legal response', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Cookie', authCookie)
      .send({ prompt: 'Explain Section 138 of NI Act and limitation period' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('reply');
    expect(res.body.data.reply).toContain('Section 138');
    expect(res.body.data).toHaveProperty('source');
  });

  test('POST /api/ai/summarize should reject unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/ai/summarize')
      .attach('document', Buffer.from('%PDF-1.4 sample content'), 'test.pdf');

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/ai/summarize should require file upload', async () => {
    const res = await request(app)
      .post('/api/ai/summarize')
      .set('Cookie', authCookie)
      .send({ prompt: 'Summarize nothing' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/ai/summarize should process uploaded PDF and return summary', async () => {
    const fakePdfBuffer = Buffer.from('%PDF-1.4 Mock Legal Notice Document Content');

    const res = await request(app)
      .post('/api/ai/summarize')
      .set('Cookie', authCookie)
      .attach('document', fakePdfBuffer, 'Bail_Application_Draft.pdf')
      .field('prompt', 'Summarize key grounds and relief');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fileName).toBe('Bail_Application_Draft.pdf');
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data.summary).toContain('Document Analysis Report');
  });
});
