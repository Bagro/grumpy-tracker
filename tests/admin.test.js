import request from 'supertest';

describe('Admin routes', () => {
  let app;
  beforeAll(async () => {
    app = (await import('../src/index.js')).default;
  });
  it('should return 401, 403 or 302 if not admin', async () => {
    const res = await request(app).get('/admin/users');
    expect([401, 403, 302]).toContain(res.statusCode);
  });
});
