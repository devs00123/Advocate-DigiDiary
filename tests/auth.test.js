/**
 * Test Suite: Authentication & Session Security
 */

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

describe('Authentication API', () => {
  const testUser = {
    firmName: 'Kapoor & Associates Law Chambers',
    name: 'Advocate Vikram Kapoor',
    email: 'vikram@kapoorlaw.com',
    password: 'Password@2026',
    barEnrollmentNumber: 'D/999/2015'
  };

  let authCookie;

  it('should register a new law firm and admin user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.password).toBeUndefined(); // Password hash must NEVER be returned

    // Verify Set-Cookie header is present with HttpOnly
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/token=/);
    expect(cookies[0]).toMatch(/HttpOnly/i);
  });

  it('should reject registration with duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should login successfully with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user.password).toBeUndefined();

    authCookie = res.headers['set-cookie'];
  });

  it('should reject login with wrong password (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'IncorrectPassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject unauthenticated request to protected endpoint (401)', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should permit access to protected endpoint with valid session cookie', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email);
  });

  it('should allow user to update their practitioner profile details', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Cookie', authCookie)
      .send({
        name: 'Senior Adv. Vikram Kapoor',
        designation: 'Managing Partner & Senior Counsel',
        enrollmentNumber: 'D/999/2015-DEL',
        phone: '+91 98111 22233',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Senior Adv. Vikram Kapoor');
    expect(res.body.data.designation).toBe('Managing Partner & Senior Counsel');
    expect(res.body.data.enrollmentNumber).toBe('D/999/2015-DEL');
    expect(res.body.data.phone).toBe('+91 98111 22233');
  });

  it('should reject password change with incorrect current password', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Cookie', authCookie)
      .send({
        currentPassword: 'WrongOldPassword',
        newPassword: 'BrandNewSecurePassword@2026',
        confirmPassword: 'BrandNewSecurePassword@2026',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Current password is incorrect/i);
  });

  it('should reject password change if new password is too short (< 6 chars)', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Cookie', authCookie)
      .send({
        currentPassword: testUser.password,
        newPassword: '123',
        confirmPassword: '123',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/at least 6 characters/i);
  });

  it('should reject password change if confirm password does not match', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Cookie', authCookie)
      .send({
        currentPassword: testUser.password,
        newPassword: 'BrandNewSecurePassword@2026',
        confirmPassword: 'DifferentPassword@2026',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/do not match/i);
  });

  it('should successfully change password and permit login with new password', async () => {
    const changeRes = await request(app)
      .put('/api/auth/change-password')
      .set('Cookie', authCookie)
      .send({
        currentPassword: testUser.password,
        newPassword: 'BrandNewSecurePassword@2026',
        confirmPassword: 'BrandNewSecurePassword@2026',
      });

    expect(changeRes.status).toBe(200);
    expect(changeRes.body.success).toBe(true);

    // Old password should fail now
    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });
    expect(oldLogin.status).toBe(401);

    // New password should succeed
    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'BrandNewSecurePassword@2026',
      });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.success).toBe(true);
  });

  it('should clear session on logout', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const cookies = res.headers['set-cookie'];
    expect(cookies[0]).toMatch(/token=none/);
  });
});
