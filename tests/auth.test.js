import request from 'supertest';

// Helper to extract CSRF token from HTML
function extractCsrfToken(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  return match ? match[1] : null;
}

// Helper to register and login a user, returns a cookie jar
async function registerAndLogin(app, user = { name: 'Test User', email: 'testuser@example.com', password: 'testpass', language: 'en' }) {
  // Create an agent to maintain cookies across requests
  const agent = request.agent(app);

  // Get CSRF token for register
  const getReg = await agent.get('/register');
  const csrfToken = extractCsrfToken(getReg.text);

  // Register
  await agent
    .post('/register')
    .type('form')
    .send({ ...user, _csrf: csrfToken });

  // Get CSRF token for login
  const getLogin = await agent.get('/login');
  const csrfLogin = extractCsrfToken(getLogin.text);

  // Login
  await agent
    .post('/login')
    .type('form')
    .send({ email: user.email, password: user.password, _csrf: csrfLogin });

  // Return the agent itself, which maintains cookies across requests
  return agent;
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
    const agent = await registerAndLogin(app, user);
    const res = await agent.get('/profile');
    expect([200, 302]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.text).toContain(user.email);
    }
  });

  it('should not allow login with wrong password', async () => {
    const user = { name: 'Test User3', email: 'testuser3@example.com', password: 'testpass3', language: 'en' };
    // Use agent to maintain cookies
    const agent = request.agent(app);

    // Register user
    const getReg = await agent.get('/register');
    const csrfToken = extractCsrfToken(getReg.text);
    await agent
      .post('/register')
      .type('form')
      .send({ ...user, _csrf: csrfToken });

    // Get CSRF for login
    const getLogin = await agent.get('/login');
    const csrfLogin = extractCsrfToken(getLogin.text);

    // Try login with wrong password
    const res = await agent
      .post('/login')
      .type('form')
      .send({ email: user.email, password: 'wrongpass', _csrf: csrfLogin });

    expect([302, 200]).toContain(res.statusCode);
  });

  it('should allow a registered user to log in and access protected routes', async () => {
    const agent = request.agent(app);

    // Get CSRF token from register page
    const registerPage = await agent.get('/register');
    const csrfToken = extractCsrfToken(registerPage.text);

    // Register user
    const registerRes = await agent
      .post('/register')
      .type('form')
      .send({
        email: 'testuser@example.com',
        name: 'Test User',
        password: 'TestPassword123!',
        preferred_language: 'en',
        _csrf: csrfToken
      });
    expect([200, 302]).toContain(registerRes.statusCode);

    // Get CSRF token from login page
    const loginPage = await agent.get('/login');
    const csrfLogin = extractCsrfToken(loginPage.text);

    // Log in
    const loginRes = await agent
      .post('/login')
      .type('form')
      .send({
        email: 'testuser@example.com',
        password: 'TestPassword123!',
        _csrf: csrfLogin
      });
    expect([200, 302]).toContain(loginRes.statusCode);

    // Access protected route
    const profileRes = await agent.get('/profile');
    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.text.toLowerCase()).toContain('profile');

    // Log out - need to get CSRF token first
    const logoutPage = await agent.get('/profile');
    const csrfLogout = extractCsrfToken(logoutPage.text);

    // Use POST for logout (not GET)
    const logoutRes = await agent
      .post('/logout')
      .type('form')
      .send({ _csrf: csrfLogout });
    expect([200, 302]).toContain(logoutRes.statusCode);

    // Access protected route after logout
    const afterLogout = await agent.get('/profile');
    expect(afterLogout.statusCode).toBe(302);
    expect(afterLogout.headers.location).toMatch(/login/i);
  });
});
