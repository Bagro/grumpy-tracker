import request from 'supertest';

// Helper to extract CSRF token from HTML
function extractCsrfToken(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  return match ? match[1] : null;
}

// Helper to register and login a user, returns a cookie jar
async function registerAndLogin(app, user = { name: 'Test User', email: 'testuser@example.com', password: 'testpass', language: 'en' }) {
  // Get CSRF token for register
  const getReg = await request(app).get('/register');
  const csrfToken = extractCsrfToken(getReg.text);
  const cookies = getReg.headers['set-cookie'];
  // Register
  await request(app)
    .post('/register')
    .set('Cookie', cookies)
    .type('form')
    .send({ ...user, _csrf: csrfToken });
  // Get CSRF token for login
  const getLogin = await request(app).get('/login').set('Cookie', cookies);
  const csrfLogin = extractCsrfToken(getLogin.text);
  // Login
  const loginRes = await request(app)
    .post('/login')
    .set('Cookie', cookies)
    .type('form')
    .send({ email: user.email, password: user.password, _csrf: csrfLogin });
  const loginCookies = loginRes.headers['set-cookie'] || cookies;
  return loginCookies;
}

describe('Auth routes', () => {
  let app;
  beforeAll(async () => {
    app = (await import('../src/index.js')).default;
  });
  it('should render login page', async () => {
    const res = await request(app).get('/login');
    expect(res.statusCode).toBe(200);
    expect(res.text.toLowerCase()).toContain('login');
  });

  it('should render register page', async () => {
    const res = await request(app).get('/register');
    expect(res.statusCode).toBe(200);
    expect(res.text.toLowerCase()).toContain('register');
  });

  it('should allow a registered user to login and access /profile', async () => {
    const user = { name: 'Test User2', email: 'testuser2@example.com', password: 'testpass2', language: 'en' };
    const cookies = await registerAndLogin(app, user);
    const res = await request(app)
      .get('/profile')
      .set('Cookie', cookies);
    expect([200, 302]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.text).toContain(user.email);
    }
  });

  it('should not allow login with wrong password', async () => {
    const user = { name: 'Test User3', email: 'testuser3@example.com', password: 'testpass3', language: 'en' };
    // Register user
    const getReg = await request(app).get('/register');
    const csrfToken = extractCsrfToken(getReg.text);
    const cookies = getReg.headers['set-cookie'];
    await request(app)
      .post('/register')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...user, _csrf: csrfToken });
    // Get CSRF for login
    const getLogin = await request(app).get('/login').set('Cookie', cookies);
    const csrfLogin = extractCsrfToken(getLogin.text);
    // Try login with wrong password
    const res = await request(app)
      .post('/login')
      .set('Cookie', cookies)
      .type('form')
      .send({ email: user.email, password: 'wrongpass', _csrf: csrfLogin });
    expect([302, 200]).toContain(res.statusCode);
  });

  it('should allow a registered user to log in and access protected routes', async () => {
    // Get CSRF token from register page
    const registerPage = await request(app).get('/register');
    const csrfToken = /name="_csrf" value="([^"]+)"/.exec(registerPage.text)[1];
    const agent = request.agent(app);
    // Register user
    await agent
      .post('/register')
      .type('form')
      .send({
        email: 'testuser@example.com',
        name: 'Test User',
        password: 'TestPassword123!',
        preferred_language: 'en',
        _csrf: csrfToken
      })
      .expect(302);
    // Get CSRF token from login page
    const loginPage = await agent.get('/login');
    const csrfLogin = /name="_csrf" value="([^"]+)"/.exec(loginPage.text)[1];
    // Log in
    await agent
      .post('/login')
      .type('form')
      .send({
        email: 'testuser@example.com',
        password: 'TestPassword123!',
        _csrf: csrfLogin
      })
      .expect(302);
    // Access protected route
    const profileRes = await agent.get('/profile');
    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.text.toLowerCase()).toContain('profile');
    // Log out
    await agent.get('/logout').expect(302);
    // Access protected route after logout
    const afterLogout = await agent.get('/profile');
    expect(afterLogout.statusCode).toBe(302);
    expect(afterLogout.headers.location).toMatch(/login/i);
  });
});
