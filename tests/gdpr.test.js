import request from 'supertest';

describe('GDPR routes', () => {
  let app;
  beforeAll(async () => {
    app = (await import('../src/index.js')).default;
  });
  it('should redirect to login if not authenticated', async () => {
    const res = await request(app).get('/gdpr');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});
