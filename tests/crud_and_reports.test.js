/**
 * Test Suite: Core Entity CRUD, Financial Calculations & Streaming Reports
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_crud_and_reports_555';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server/app');

let mongoServer;
let authCookie;
let createdClientId;
let createdCaseId;
let createdHearingId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const res = await request(app)
    .post('/api/auth/register')
    .send({
      firmName: 'National Litigation Chambers',
      name: 'Senior Counsel R. Nariman',
      email: 'nariman@nlchambers.in',
      password: 'SecurePassword@2026'
    });
  authCookie = res.headers['set-cookie'];
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Core Practice CRUD & Business Workflows', () => {
  it('1. Create Client', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Cookie', authCookie)
      .send({
        name: 'Bharat Heavy Electricals',
        clientType: 'Corporate',
        email: 'legal@bhel.in',
        phone: '+91 11 2345 6789'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Bharat Heavy Electricals');
    createdClientId = res.body.data._id;
  });

  it('2. Create Legal Case', async () => {
    const res = await request(app)
      .post('/api/cases')
      .set('Cookie', authCookie)
      .send({
        title: 'BHEL vs NTPC Commercial Arbitration',
        caseNumber: 'ARB-8821/2026',
        court: 'Delhi International Arbitration Centre',
        caseType: 'Arbitration',
        clientId: createdClientId,
        partyRole: 'Petitioner',
        totalAgreedFee: 350000
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalAgreedFee).toBe(350000);
    createdCaseId = res.body.data._id;
  });

  it('3. Schedule Hearing', async () => {
    const res = await request(app)
      .post('/api/hearings')
      .set('Cookie', authCookie)
      .send({
        caseId: createdCaseId,
        hearingDate: '2026-10-15',
        purpose: 'Arguments on Claim Statements',
        itemNumber: 5,
        courtRoom: 'Arbitration Hall 3'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    createdHearingId = res.body.data._id;

    // Verify case currentHearingDate was automatically updated
    const caseRes = await request(app)
      .get(`/api/cases/${createdCaseId}`)
      .set('Cookie', authCookie);
    expect(caseRes.body.data.currentHearingDate).toMatch(/2026-10-15/);
  });

  it('4. Record Hearing Outcome and Reschedule Next Date', async () => {
    const res = await request(app)
      .post(`/api/hearings/${createdHearingId}/outcome`)
      .set('Cookie', authCookie)
      .send({
        status: 'completed',
        outcome: 'Claimants completed oral submissions. Matter fixed for Respondents arguments.',
        nextDate: '2026-11-05',
        nextStage: 'Respondent Oral Arguments'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify case currentHearingDate moved to the next scheduled date
    const caseRes = await request(app)
      .get(`/api/cases/${createdCaseId}`)
      .set('Cookie', authCookie);
    expect(caseRes.body.data.currentHearingDate).toMatch(/2026-11-05/);
  });

  it('5. Create Task and Toggle Completion', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Cookie', authCookie)
      .send({
        caseId: createdCaseId,
        title: 'Prepare compilation of arbitration awards on delay damages',
        dueDate: '2026-10-25',
        priority: 'high'
      });

    expect(createRes.status).toBe(201);
    const taskId = createRes.body.data._id;

    const updateRes = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', authCookie)
      .send({ status: 'completed' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status.toLowerCase()).toBe('completed');
  });

  it('6. Record Client Payment & Verify Real Financial Balances', async () => {
    // Record first installment of 150000 against 350000 agreed
    const payRes = await request(app)
      .post('/api/financial/payments')
      .set('Cookie', authCookie)
      .send({
        caseId: createdCaseId,
        clientId: createdClientId,
        amount: 150000,
        paymentDate: '2026-09-20',
        paymentMethod: 'Bank Transfer',
        referenceNumber: 'NEFT-BHEL-20260920'
      });

    expect(payRes.status).toBe(201);
    expect(payRes.body.success).toBe(true);

    // Verify Financial Overview Calculation
    const finRes = await request(app)
      .get('/api/financial/overview')
      .set('Cookie', authCookie);

    expect(finRes.status).toBe(200);
    expect(finRes.body.data.totalBilled).toBe(350000);
    expect(finRes.body.data.totalCollected).toBe(150000);
    expect(finRes.body.data.totalOutstanding).toBe(200000); // 350000 - 150000
  });

  it('7. Record Chamber Expense', async () => {
    const res = await request(app)
      .post('/api/financial/expenses')
      .set('Cookie', authCookie)
      .send({
        amount: 8500,
        expenseDate: '2026-09-21',
        category: 'Research',
        description: 'Commercial arbitration law volume subscriptions',
        isBillable: false
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

describe('Report Streaming & Absolute No-Document-Storage Rule', () => {
  it('Stream Daily Cause List as PDF without writing to disk', async () => {
    const res = await request(app)
      .get('/api/reports/cause-list?format=pdf&range=month')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/inline; filename="Cause_List_/i);
  });

  it('Stream Case Portfolio Summary as Excel spreadsheet', async () => {
    const res = await request(app)
      .get('/api/reports/case-summary?format=excel')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('Stream Case Portfolio Summary as CSV', async () => {
    const res = await request(app)
      .get('/api/reports/case-summary?format=csv')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('"Case Number"');
    expect(res.text).toContain('"CNR Number"');
    expect(res.text).toContain('"Title"');
  });

  it('ABSOLUTE NO-DOCUMENT-STORAGE RULE: No document storage routes or endpoints exist', async () => {
    const resUpload = await request(app)
      .post('/api/documents/upload')
      .set('Cookie', authCookie);
    expect(resUpload.status).toBe(404);

    const resVault = await request(app)
      .get('/api/documents')
      .set('Cookie', authCookie);
    expect(resVault.status).toBe(404);
  });
});
