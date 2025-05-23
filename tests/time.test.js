import request from 'supertest';

describe('Time routes', () => {
  let app;
  beforeAll(async () => {
    app = (await import('../src/index.js')).default;
  });
  it('should redirect to login if not authenticated', async () => {
    const res = await request(app).get('/time');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});
