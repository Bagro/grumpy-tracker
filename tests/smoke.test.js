import request from 'supertest';

// Basic smoke test for Grumpy Tracker
describe('GET /', () => {
  let app;
  beforeAll(async () => {
    app = (await import('../src/index.js')).default;
  });
  it('should redirect to login if not authenticated', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});
