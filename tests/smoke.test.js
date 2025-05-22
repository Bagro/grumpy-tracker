// Basic smoke test for Grumpy Tracker
import request from 'supertest';
import app from '../src/index.js';

describe('GET /', () => {
  it('should return 200 and render home page', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('Grumpy Tracker');
  });
});
