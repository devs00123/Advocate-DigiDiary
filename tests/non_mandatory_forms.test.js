process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_super_secure_for_chambers_123';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server/app');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Non-Mandatory Forms & Smart Defaults Verification', () => {
  let authCookie;

  it('allows registering a firm with empty payload', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.name).toBe('Adv. Practice Admin');
    authCookie = res.headers['set-cookie'];
  });

  it('allows creating a client with empty payload', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Cookie', authCookie)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toMatch(/Client /);
  });

  it('allows creating a case with empty payload', async () => {
    const res = await request(app)
      .post('/api/cases')
      .set('Cookie', authCookie)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('General Legal Matter');
    expect(res.body.data.court).toBe('District Court');
    expect(res.body.data.caseNumber).toMatch(/MATTER-/);
  });

  it('allows creating a task with empty payload', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', authCookie)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Chamber Task');
  });

  it('allows scheduling a hearing with empty payload', async () => {
    const res = await request(app)
      .post('/api/hearings')
      .set('Cookie', authCookie)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.purpose).toBe('Regular Hearing');
  });

  it('allows creating a note with empty payload', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', authCookie)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Chamber Note');
  });

  it('allows recording an expense with empty payload', async () => {
    const res = await request(app)
      .post('/api/financial/expenses')
      .set('Cookie', authCookie)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.description).toBe('Chamber Expense');
    expect(res.body.data.amount).toBe(0);
  });

  it('allows recording a payment with empty payload', async () => {
    const res = await request(app)
      .post('/api/financial/payments')
      .set('Cookie', authCookie)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(0);
    expect(res.body.data.receiptNumber).toMatch(/REC-/);
  });

  it('allows setting a reminder with empty payload', async () => {
    const res = await request(app)
      .post('/api/reminders')
      .set('Cookie', authCookie)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Reminder');
  });

  it('allows adding a team member with empty payload', async () => {
    const res = await request(app)
      .post('/api/team')
      .set('Cookie', authCookie)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Chamber Counsel');
  });
});
