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

describe('Calendar, Analytics Summary & Reminders Done/Toggle Verification', () => {
  let authCookie;
  let testCaseId;
  let testReminderId;

  it('registers an advocate and signs in', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Adv. Rajesh Khanna',
        email: 'rajesh.khanna@chambers.in',
        password: 'Password@123',
        firmName: 'Khanna & Co Law Chambers',
      });
    expect(res.status).toBe(201);
    authCookie = res.headers['set-cookie'];
  });

  it('creates test case with agreed fee', async () => {
    const res = await request(app)
      .post('/api/cases')
      .set('Cookie', authCookie)
      .send({
        title: 'State vs. Mehra Industries',
        caseNumber: 'CRL/2026/0991',
        court: 'High Court of Delhi',
        agreedFee: 50000,
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    testCaseId = res.body.data._id;
  });

  it('schedules a court hearing', async () => {
    const res = await request(app)
      .post('/api/hearings')
      .set('Cookie', authCookie)
      .send({
        caseId: testCaseId,
        date: new Date().toISOString(),
        time: '11:00 AM',
        court: 'High Court of Delhi',
        courtroom: 'Court Room 14',
        judge: 'Honble Justice S. Kaul',
        purpose: 'Final Arguments',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('creates a practice task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', authCookie)
      .send({
        title: 'Draft Rejoinder Affidavit',
        caseId: testCaseId,
        dueDate: new Date().toISOString(),
        priority: 'Urgent',
        status: 'To Do',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('creates a chamber reminder', async () => {
    const res = await request(app)
      .post('/api/reminders')
      .set('Cookie', authCookie)
      .send({
        title: 'Call Senior Counsel for Briefing',
        relatedCase: testCaseId,
        reminderDate: new Date().toISOString(),
        reminderTime: '04:00 PM',
        priority: 'High',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.completed).toBe(false);
    testReminderId = res.body.data._id;
  });

  it('records a fee payment', async () => {
    const res = await request(app)
      .post('/api/financial/payments')
      .set('Cookie', authCookie)
      .send({
        caseId: testCaseId,
        amount: 25000,
        paymentDate: new Date().toISOString(),
        paymentMode: 'NEFT',
        status: 'Realized',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('fetches analytics summary with accurate metrics', async () => {
    const res = await request(app)
      .get('/api/analytics/summary')
      .set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    expect(data.totalCases).toBeGreaterThanOrEqual(1);
    expect(data.totalActiveCases).toBeGreaterThanOrEqual(1);
    expect(data.todayHearingsCount).toBeGreaterThanOrEqual(1);
    expect(data.pendingTasksCount).toBeGreaterThanOrEqual(1);
    expect(data.urgentTasksCount).toBeGreaterThanOrEqual(1);
    expect(data.totalBilled).toBe(50000);
    expect(data.totalCollected).toBe(25000);
    expect(data.totalOutstanding).toBe(25000);
  });

  it('fetches analytics distribution and revenue charts data', async () => {
    const distRes = await request(app)
      .get('/api/analytics/case-distribution')
      .set('Cookie', authCookie);
    expect(distRes.status).toBe(200);
    expect(distRes.body.data.byCourt).toBeDefined();

    const outRes = await request(app)
      .get('/api/analytics/hearing-outcomes')
      .set('Cookie', authCookie);
    expect(outRes.status).toBe(200);
    expect(Array.isArray(outRes.body.data)).toBe(true);

    const revRes = await request(app)
      .get('/api/analytics/monthly-revenue')
      .set('Cookie', authCookie);
    expect(revRes.status).toBe(200);
    expect(revRes.body.data.length).toBe(6);
  });

  it('fetches calendar events with normalized lowercase types and start dates', async () => {
    const now = new Date();
    const startStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const res = await request(app)
      .get(`/api/calendar?start=${startStr}&end=${endStr}`)
      .set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const events = res.body.data;
    expect(events.length).toBeGreaterThanOrEqual(3);

    const hearingEv = events.find(e => e.type === 'hearing');
    expect(hearingEv).toBeDefined();
    expect(hearingEv.start).toBeDefined();
    expect(hearingEv.date).toBeDefined();
    expect(hearingEv.caseTitle).toBe('State vs. Mehra Industries');
    expect(hearingEv.court).toBe('High Court of Delhi');
    expect(hearingEv.currentDate).toBeDefined();
    expect(hearingEv.appearingFor).toBeDefined();
    expect(hearingEv.remarks).toBeDefined();

    const taskEv = events.find(e => e.type === 'task');
    expect(taskEv).toBeDefined();
    expect(taskEv.start).toBeDefined();

    const reminderEv = events.find(e => e.type === 'reminder');
    expect(reminderEv).toBeDefined();
    expect(reminderEv.start).toBeDefined();
  });

  it('registers a case with frontend aliases, stayed status, and opposite party representation', async () => {
    const res = await request(app)
      .post('/api/cases')
      .set('Cookie', authCookie)
      .send({
        title: 'Bansal Textiles vs. Union of India',
        caseNumber: 'WP(C) 1982/2026',
        court: 'High Court of Delhi',
        courtRoom: 'Court No. 12',
        caseType: 'Commercial',
        partyRole: 'Opposite Party',
        opponentParty: 'Union of India & Anr.',
        opponentAdvocate: 'Standing Counsel GoI',
        stage: 'Final Arguments',
        status: 'stayed',
        totalAgreedFee: 75000,
        description: 'Commercial writ challenging notification',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.clientRepresentation).toBe('Opposite Party');
    expect(res.body.data.status).toBe('Stayed');
    expect(res.body.data.oppositeParty).toBe('Union of India & Anr.');
    expect(res.body.data.oppositeCounsel).toBe('Standing Counsel GoI');
    expect(res.body.data.courtroom).toBe('Court No. 12');
    expect(res.body.data.currentStage).toBe('Final Arguments');
    expect(res.body.data.agreedFee).toBe(75000);
  });

  it('toggles reminder status (Mark Done)', async () => {
    const res = await request(app)
      .patch(`/api/reminders/${testReminderId}/toggle`)
      .set('Cookie', authCookie)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.completed).toBe(true);
  });

  it('toggles reminder back to active (Reopen)', async () => {
    const res = await request(app)
      .patch(`/api/reminders/${testReminderId}/toggle`)
      .set('Cookie', authCookie)
      .send({ completed: false });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.completed).toBe(false);
  });

  it('allows dismissing reminder via PATCH /dismiss', async () => {
    const res = await request(app)
      .patch(`/api/reminders/${testReminderId}/dismiss`)
      .set('Cookie', authCookie)
      .send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.completed).toBe(true);
  });

  it('updates reminder via PUT /:id', async () => {
    const res = await request(app)
      .put(`/api/reminders/${testReminderId}`)
      .set('Cookie', authCookie)
      .send({
        title: 'Updated Call with Senior Counsel',
        completed: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Updated Call with Senior Counsel');
    expect(res.body.data.completed).toBe(false);
  });
});
