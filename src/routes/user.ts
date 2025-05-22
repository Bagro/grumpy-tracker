import { Elysia } from 'elysia';
import { db } from '../db';
import { i18n } from '../i18n';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { lucia } from '../auth';
import { renderPage } from '../templates/renderPage';

export const userRoutes = new Elysia({ prefix: '/user' })
  // Registration form (GET)
  .get('/register', (ctx) => {
    ctx.set.headers['Content-Type'] = 'text/html';
    return renderPage(`
      <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200">
        <div id="register-form-container" class="w-full max-w-md p-8 rounded-2xl shadow-xl bg-white/90 border border-gray-200">
          <form method="post" action="/user/register" class="space-y-6" aria-labelledby="register-title" hx-post="/user/register" hx-target="#register-form-container" hx-swap="outerHTML">
            <h1 id="register-title" class="text-3xl font-bold text-center text-indigo-700 mb-6">${i18n.t('register')}</h1>
            <div id="register-error" class="text-red-600 mb-2 text-center" style="display:none"></div>
            <div>
              <label class="block mb-1 font-medium text-gray-700" for="name">${i18n.t('name')}</label>
              <input id="name" name="name" class="input input-bordered w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-400" required autocomplete="name" />
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700" for="email">${i18n.t('email')}</label>
              <input id="email" name="email" type="email" class="input input-bordered w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-400" required autocomplete="email" />
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700" for="password">${i18n.t('password')}</label>
              <input id="password" name="password" type="password" class="input input-bordered w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-400" required autocomplete="new-password" />
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700" for="preferred_language">${i18n.t('language')}</label>
              <select id="preferred_language" name="preferred_language" class="input input-bordered w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-400" aria-label="${i18n.t('language')}">
                <option value="en">English</option>
                <option value="sv">Svenska</option>
                <option value="fi">Suomi</option>
                <option value="no">Norsk</option>
                <option value="lv">Latviešu</option>
                <option value="et">Eesti</option>
                <option value="lt">Lietuvių</option>
                <option value="da">Dansk</option>
              </select>
            </div>
            <button class="btn btn-primary w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow transition" type="submit">${i18n.t('submit')}</button>
          </form>
          <div class="mt-6 text-center">
            <a href="/user/login" class="text-indigo-600 hover:underline font-medium">${i18n.t('Already have an account? Login')}</a>
          </div>
        </div>
      </div>
    `);
  })
  // Registration handler (POST)
  .post('/register', async (ctx) => {
    const isHtmx = ctx.request.headers.get('hx-request') === 'true';
    const body = await ctx.request.json();
    const { name, email, password, preferred_language } = body as Record<string, string>;
    // Basic validation
    if (!name || !email || !password || !preferred_language) {
      if (isHtmx) {
        ctx.set.headers['Content-Type'] = 'text/html';
        return `
          <form method="post" action="/user/register" class="max-w-md mx-auto mt-8 p-4 border rounded bg-white" aria-labelledby="register-title" hx-post="/user/register" hx-target="#register-form-container" hx-swap="outerHTML">
            <h1 id="register-title" class="text-2xl mb-4">${i18n.t('register')}</h1>
            <div id="register-error" class="text-red-600 mb-2">${i18n.t('All fields are required')}</div>
            <label class="block mb-2" for="name">${i18n.t('name')}</label>
            <input id="name" name="name" class="input input-bordered w-full" required autocomplete="name" />
            <label class="block mb-2" for="email">${i18n.t('email')}</label>
            <input id="email" name="email" type="email" class="input input-bordered w-full" required autocomplete="email" />
            <label class="block mb-2" for="password">${i18n.t('password')}</label>
            <input id="password" name="password" type="password" class="input input-bordered w-full" required autocomplete="new-password" />
            <label class="block mb-2" for="preferred_language">${i18n.t('language')}</label>
            <select id="preferred_language" name="preferred_language" class="input input-bordered w-full" aria-label="${i18n.t('language')}">
              <option value="en">English</option>
              <option value="sv">Svenska</option>
              <option value="fi">Suomi</option>
              <option value="no">Norsk</option>
              <option value="lv">Latviešu</option>
              <option value="et">Eesti</option>
              <option value="lt">Lietuvių</option>
              <option value="da">Dansk</option>
            </select>
            <button class="btn btn-primary w-full mt-4" type="submit">${i18n.t('submit')}</button>
          </form>
        `;
      }
      return ctx.set.status = 400, { error: i18n.t('All fields are required') };
    }
    // Check if user exists
    const existing = await db.selectFrom('user').select('id').where('email', '=', email).executeTakeFirst();
    if (existing) {
      if (isHtmx) {
        ctx.set.headers['Content-Type'] = 'text/html';
        return `
          <form method="post" action="/user/register" class="max-w-md mx-auto mt-8 p-4 border rounded bg-white" aria-labelledby="register-title" hx-post="/user/register" hx-target="#register-form-container" hx-swap="outerHTML">
            <h1 id="register-title" class="text-2xl mb-4">${i18n.t('register')}</h1>
            <div id="register-error" class="text-red-600 mb-2">${i18n.t('Email already registered')}</div>
            <label class="block mb-2" for="name">${i18n.t('name')}</label>
            <input id="name" name="name" class="input input-bordered w-full" required autocomplete="name" />
            <label class="block mb-2" for="email">${i18n.t('email')}</label>
            <input id="email" name="email" type="email" class="input input-bordered w-full" required autocomplete="email" />
            <label class="block mb-2" for="password">${i18n.t('password')}</label>
            <input id="password" name="password" type="password" class="input input-bordered w-full" required autocomplete="new-password" />
            <label class="block mb-2" for="preferred_language">${i18n.t('language')}</label>
            <select id="preferred_language" name="preferred_language" class="input input-bordered w-full" aria-label="${i18n.t('language')}">
              <option value="en">English</option>
              <option value="sv">Svenska</option>
              <option value="fi">Suomi</option>
              <option value="no">Norsk</option>
              <option value="lv">Latviešu</option>
              <option value="et">Eesti</option>
              <option value="lt">Lietuvių</option>
              <option value="da">Dansk</option>
            </select>
            <button class="btn btn-primary w-full mt-4" type="submit">${i18n.t('submit')}</button>
          </form>
        `;
      }
      return ctx.set.status = 400, { error: i18n.t('Email already registered') };
    }
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    // Insert user
    await db.insertInto('user').values({
      id: randomUUID(),
      name,
      email,
      password_hash,
      preferred_language,
      created_at: new Date(),
      updated_at: new Date(),
    }).execute();
    if (isHtmx) {
      ctx.set.headers['HX-Redirect'] = '/user/login';
      return '';
    }
    return { success: true };
  })
  // Login form (GET)
  .get('/login', (ctx) => {
    ctx.set.headers['Content-Type'] = 'text/html';
    return renderPage(`
      <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200">
        <div id="login-form-container" class="w-full max-w-md p-8 rounded-2xl shadow-xl bg-white/90 border border-gray-200">
          <form method="post" action="/user/login" class="space-y-6" aria-labelledby="login-title" hx-post="/user/login" hx-target="#login-form-container" hx-swap="outerHTML">
            <h1 id="login-title" class="text-3xl font-bold text-center text-indigo-700 mb-6">${i18n.t('login')}</h1>
            <div id="login-error" class="text-red-600 mb-2 text-center" style="display:none"></div>
            <div>
              <label class="block mb-1 font-medium text-gray-700" for="login-email">${i18n.t('email')}</label>
              <input id="login-email" name="email" type="email" class="input input-bordered w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-400" required autocomplete="email" />
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700" for="login-password">${i18n.t('password')}</label>
              <input id="login-password" name="password" type="password" class="input input-bordered w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-400" required autocomplete="current-password" />
            </div>
            <button class="btn btn-primary w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow transition" type="submit">${i18n.t('submit')}</button>
          </form>
          <div class="mt-6 text-center">
            <a href="/user/register" class="text-indigo-600 hover:underline font-medium">${i18n.t("Don't have an account? Register")}</a>
          </div>
        </div>
      </div>
    `);
  })
  // Login handler (POST)
  .post('/login', async (ctx) => {
    const isHtmx = ctx.request.headers.get('hx-request') === 'true';
    const body = await ctx.request.json();
    const { email, password } = body as Record<string, string>;
    if (!email || !password) {
      if (isHtmx) {
        ctx.set.headers['Content-Type'] = 'text/html';
        return `
          <form method="post" action="/user/login" class="max-w-md mx-auto mt-8 p-4 border rounded bg-white" aria-labelledby="login-title" hx-post="/user/login" hx-target="#login-form-container" hx-swap="outerHTML">
            <h1 id="login-title" class="text-2xl mb-4">${i18n.t('login')}</h1>
            <div id="login-error" class="text-red-600 mb-2">${i18n.t('All fields are required')}</div>
            <label class="block mb-2" for="login-email">${i18n.t('email')}</label>
            <input id="login-email" name="email" type="email" class="input input-bordered w-full" required autocomplete="email" />
            <label class="block mb-2" for="login-password">${i18n.t('password')}</label>
            <input id="login-password" name="password" type="password" class="input input-bordered w-full" required autocomplete="current-password" />
            <button class="btn btn-primary w-full mt-4" type="submit">${i18n.t('submit')}</button>
          </form>
        `;
      }
      return ctx.set.status = 400, { error: i18n.t('All fields are required') };
    }
    const user = await db.selectFrom('user').selectAll().where('email', '=', email).executeTakeFirst();
    if (!user) {
      if (isHtmx) {
        ctx.set.headers['Content-Type'] = 'text/html';
        return `
          <form method="post" action="/user/login" class="max-w-md mx-auto mt-8 p-4 border rounded bg-white" aria-labelledby="login-title" hx-post="/user/login" hx-target="#login-form-container" hx-swap="outerHTML">
            <h1 id="login-title" class="text-2xl mb-4">${i18n.t('login')}</h1>
            <div id="login-error" class="text-red-600 mb-2">${i18n.t('Invalid email or password')}</div>
            <label class="block mb-2" for="login-email">${i18n.t('email')}</label>
            <input id="login-email" name="email" type="email" class="input input-bordered w-full" required autocomplete="email" />
            <label class="block mb-2" for="login-password">${i18n.t('password')}</label>
            <input id="login-password" name="password" type="password" class="input input-bordered w-full" required autocomplete="current-password" />
            <button class="btn btn-primary w-full mt-4" type="submit">${i18n.t('submit')}</button>
          </form>
        `;
      }
      return ctx.set.status = 401, { error: i18n.t('Invalid email or password') };
    }
    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      if (isHtmx) {
        ctx.set.headers['Content-Type'] = 'text/html';
        return `
          <form method="post" action="/user/login" class="max-w-md mx-auto mt-8 p-4 border rounded bg-white" aria-labelledby="login-title" hx-post="/user/login" hx-target="#login-form-container" hx-swap="outerHTML">
            <h1 id="login-title" class="text-2xl mb-4">${i18n.t('login')}</h1>
            <div id="login-error" class="text-red-600 mb-2">${i18n.t('Invalid email or password')}</div>
            <label class="block mb-2" for="login-email">${i18n.t('email')}</label>
            <input id="login-email" name="email" type="email" class="input input-bordered w-full" required autocomplete="email" />
            <label class="block mb-2" for="login-password">${i18n.t('password')}</label>
            <input id="login-password" name="password" type="password" class="input input-bordered w-full" required autocomplete="current-password" />
            <button class="btn btn-primary w-full mt-4" type="submit">${i18n.t('submit')}</button>
          </form>
        `;
      }
      return ctx.set.status = 401, { error: i18n.t('Invalid email or password') };
    }
    // Create session using lucia-auth
    const session = await lucia.createSession(user.id, {}, {});
    ctx.set.headers['Set-Cookie'] = `session=${session.id}; HttpOnly; Path=/; SameSite=Lax`;
    if (isHtmx) {
      // htmx: trigger redirect to dashboard
      ctx.set.headers['HX-Redirect'] = '/time/summary';
      return '';
    }
    return { success: true, user: { id: user.id, name: user.name, preferred_language: user.preferred_language } };
  })
  // Logout (GET)
  .get('/logout', async (ctx) => {
    // Remove session cookie
    ctx.set.headers['Set-Cookie'] = 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax';
    return { success: true };
  })
  // Profile view (GET)
  .get('/profile', async (ctx) => {
    ctx.set.headers['Content-Type'] = 'text/html';
    // Check for htmx request
    const isHtmx = ctx.request.headers.get('hx-request') === 'true';
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const session = await lucia.validateSession(sessionId);
    if (!session.user) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const user = await db.selectFrom('user').selectAll().where('id', '=', session.user.id).executeTakeFirst();
    if (!user) {
      return ctx.set.status = 404, { error: i18n.t('User not found') };
    }
    // Render profile form (SSR, EJS or HTML string for now)
    return renderPage(`
      <div id="profile-form-container">
      <form method="post" action="/user/profile" class="max-w-md mx-auto mt-8 p-4 border rounded bg-white" aria-labelledby="profile-title" hx-post="/user/profile" hx-target="#profile-form-container" hx-swap="outerHTML">
        <h1 id="profile-title" class="text-2xl mb-4">${i18n.t('Profile')}</h1>
        <div id="profile-error" class="text-red-600 mb-2" style="display:none"></div>
        <label class="block mb-2" for="profile-name">${i18n.t('name')}</label>
        <input id="profile-name" name="name" value="${user.name}" class="input input-bordered w-full" required autocomplete="name" />
        <label class="block mb-2" for="profile-email">${i18n.t('email')}</label>
        <input id="profile-email" name="email" type="email" value="${user.email}" class="input input-bordered w-full" required autocomplete="email" />
        <label class="block mb-2" for="profile-language">${i18n.t('language')}</label>
        <select id="profile-language" name="preferred_language" class="input input-bordered w-full" aria-label="${i18n.t('language')}">
          <option value="en"${user.preferred_language==='en'?' selected':''}>English</option>
          <option value="sv"${user.preferred_language==='sv'?' selected':''}>Svenska</option>
          <option value="fi"${user.preferred_language==='fi'?' selected':''}>Suomi</option>
          <option value="no"${user.preferred_language==='no'?' selected':''}>Norsk</option>
          <option value="lv"${user.preferred_language==='lv'?' selected':''}>Latviešu</option>
          <option value="et"${user.preferred_language==='et'?' selected':''}>Eesti</option>
          <option value="lt"${user.preferred_language==='lt'?' selected':''}>Lietuvių</option>
          <option value="da"${user.preferred_language==='da'?' selected':''}>Dansk</option>
        </select>
        <label class="block mb-2" for="profile-password">${i18n.t('password')}</label>
        <input id="profile-password" name="password" type="password" class="input input-bordered w-full" placeholder="(leave blank to keep current)" autocomplete="new-password" />
        <button class="btn btn-primary w-full mt-4" type="submit">${i18n.t('submit')}</button>
      </form>
      </div>
    `);
  })
  // Profile update handler (POST)
  .post('/profile', async (ctx) => {
    const isHtmx = ctx.request.headers.get('hx-request') === 'true';
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) {
      if (isHtmx) {
        ctx.set.headers['Content-Type'] = 'text/html';
        return `<div class='text-red-600'>${i18n.t('Not authenticated')}</div>`;
      }
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const session = await lucia.validateSession(sessionId);
    if (!session.user) {
      if (isHtmx) {
        ctx.set.headers['Content-Type'] = 'text/html';
        return `<div class='text-red-600'>${i18n.t('Not authenticated')}</div>`;
      }
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const body = await ctx.request.json();
    const { name, email, preferred_language, password } = body as Record<string, string>;
    if (!name || !email || !preferred_language) {
      if (isHtmx) {
        ctx.set.headers['Content-Type'] = 'text/html';
        return `<div class='text-red-600'>${i18n.t('All fields are required')}</div>`;
      }
      return ctx.set.status = 400, { error: i18n.t('All fields are required') };
    }
    // Check for email conflict
    const existing = await db.selectFrom('user').select('id').where('email', '=', email).where('id', '!=', session.user.id).executeTakeFirst();
    if (existing) {
      if (isHtmx) {
        ctx.set.headers['Content-Type'] = 'text/html';
        return `<div class='text-red-600'>${i18n.t('Email already registered')}</div>`;
      }
      return ctx.set.status = 400, { error: i18n.t('Email already registered') };
    }
    // Update user
    let update: any = { name, email, preferred_language, updated_at: new Date() };
    if (password) {
      const bcrypt = await import('bcryptjs');
      update.password_hash = await bcrypt.hash(password, 10);
    }
    await db.updateTable('user').set(update).where('id', '=', session.user.id).execute();
    if (isHtmx) {
      ctx.set.headers['HX-Redirect'] = '/user/profile';
      return '';
    }
    return { success: true };
  })
  // User data export (GET)
  .get('/export', async (ctx) => {
    // --- Auth check (simple cookie/session) ---
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const session = await lucia.validateSession(sessionId);
    if (!session.user) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    // --- Fetch user and all their data ---
    const user = await db.selectFrom('user').selectAll().where('id', '=', session.user.id).executeTakeFirst();
    const timeEntries = await db.selectFrom('time_entry').selectAll().where('user_id', '=', session.user.id).execute();
    const settings = await db.selectFrom('settings').selectAll().where('user_id', '=', session.user.id).execute();
    // --- Build export object ---
    const exportData = { user, timeEntries, settings };
    ctx.set.headers['Content-Type'] = 'application/json';
    ctx.set.headers['Content-Disposition'] = 'attachment; filename="user_data.json"';
    return JSON.stringify(exportData, null, 2);
  })
  // Account deletion (POST)
  .post('/delete', async (ctx) => {
    // --- Auth check (simple cookie/session) ---
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const session = await lucia.validateSession(sessionId);
    if (!session.user) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    // --- Delete user and cascade ---
    await db.deleteFrom('user').where('id', '=', session.user.id).execute();
    // Remove session cookie
    ctx.set.headers['Set-Cookie'] = 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax';
    // TODO: Notify admin (out of scope for now)
    return { success: true };
  });
