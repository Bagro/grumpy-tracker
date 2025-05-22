import { Elysia } from 'elysia';
import { db } from '../db';
import { i18n } from '../i18n';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { auth } from '../auth';

export const userRoutes = new Elysia({ prefix: '/user' })
  // Registration form (GET)
  .get('/register', (ctx) => {
    // Render registration form (SSR, EJS or HTML string for now)
    return `
      <form method="post" action="/user/register" class="max-w-md mx-auto mt-8 p-4 border rounded bg-white">
        <h1 class="text-2xl mb-4">${i18n.t('register')}</h1>
        <label class="block mb-2">${i18n.t('name')}<input name="name" class="input input-bordered w-full" required></label>
        <label class="block mb-2">${i18n.t('email')}<input name="email" type="email" class="input input-bordered w-full" required></label>
        <label class="block mb-2">${i18n.t('password')}<input name="password" type="password" class="input input-bordered w-full" required></label>
        <label class="block mb-2">${i18n.t('language')}
          <select name="preferred_language" class="input input-bordered w-full">
            <option value="en">English</option>
            <option value="sv">Svenska</option>
            <option value="fi">Suomi</option>
            <option value="no">Norsk</option>
            <option value="lv">Latviešu</option>
            <option value="et">Eesti</option>
            <option value="lt">Lietuvių</option>
            <option value="da">Dansk</option>
          </select>
        </label>
        <button class="btn btn-primary w-full" type="submit">${i18n.t('submit')}</button>
      </form>
    `;
  })
  // Registration handler (POST)
  .post('/register', async (ctx) => {
    const body = await ctx.request.json();
    const { name, email, password, preferred_language } = body as Record<string, string>;
    // Basic validation
    if (!name || !email || !password || !preferred_language) {
      return ctx.set.status = 400, { error: i18n.t('All fields are required') };
    }
    // Check if user exists
    const existing = await db.selectFrom('user').select('id').where('email', '=', email).executeTakeFirst();
    if (existing) {
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
    return { success: true };
  })
  // Login form (GET)
  .get('/login', (ctx) => {
    return `
      <form method="post" action="/user/login" class="max-w-md mx-auto mt-8 p-4 border rounded bg-white">
        <h1 class="text-2xl mb-4">${i18n.t('login')}</h1>
        <label class="block mb-2">${i18n.t('email')}<input name="email" type="email" class="input input-bordered w-full" required></label>
        <label class="block mb-2">${i18n.t('password')}<input name="password" type="password" class="input input-bordered w-full" required></label>
        <button class="btn btn-primary w-full" type="submit">${i18n.t('submit')}</button>
      </form>
    `;
  })
  // Login handler (POST)
  .post('/login', async (ctx) => {
    const body = await ctx.request.json();
    const { email, password } = body as Record<string, string>;
    if (!email || !password) {
      return ctx.set.status = 400, { error: i18n.t('All fields are required') };
    }
    const user = await db.selectFrom('user').selectAll().where('email', '=', email).executeTakeFirst();
    if (!user) {
      return ctx.set.status = 401, { error: i18n.t('Invalid email or password') };
    }
    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return ctx.set.status = 401, { error: i18n.t('Invalid email or password') };
    }
    // Create session using lucia-auth
    const session = await auth.createSession(user.id);
    ctx.set.headers['Set-Cookie'] = `session=${session.sessionId}; HttpOnly; Path=/; SameSite=Lax`;
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
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const session = await auth.validateSession(sessionId);
    if (!session?.userId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const user = await db.selectFrom('user').selectAll().where('id', '=', session.userId).executeTakeFirst();
    if (!user) {
      return ctx.set.status = 404, { error: i18n.t('User not found') };
    }
    // Render profile form (SSR, EJS or HTML string for now)
    return `
      <form method="post" action="/user/profile" class="max-w-md mx-auto mt-8 p-4 border rounded bg-white">
        <h1 class="text-2xl mb-4">${i18n.t('Profile')}</h1>
        <label class="block mb-2">${i18n.t('name')}<input name="name" value="${user.name}" class="input input-bordered w-full" required></label>
        <label class="block mb-2">${i18n.t('email')}<input name="email" type="email" value="${user.email}" class="input input-bordered w-full" required></label>
        <label class="block mb-2">${i18n.t('language')}
          <select name="preferred_language" class="input input-bordered w-full">
            <option value="en"${user.preferred_language==='en'?' selected':''}>English</option>
            <option value="sv"${user.preferred_language==='sv'?' selected':''}>Svenska</option>
            <option value="fi"${user.preferred_language==='fi'?' selected':''}>Suomi</option>
            <option value="no"${user.preferred_language==='no'?' selected':''}>Norsk</option>
            <option value="lv"${user.preferred_language==='lv'?' selected':''}>Latviešu</option>
            <option value="et"${user.preferred_language==='et'?' selected':''}>Eesti</option>
            <option value="lt"${user.preferred_language==='lt'?' selected':''}>Lietuvių</option>
            <option value="da"${user.preferred_language==='da'?' selected':''}>Dansk</option>
          </select>
        </label>
        <label class="block mb-2">${i18n.t('password')}<input name="password" type="password" class="input input-bordered w-full" placeholder="(leave blank to keep current)"></label>
        <button class="btn btn-primary w-full" type="submit">${i18n.t('submit')}</button>
      </form>
    `;
  })
  // Profile update handler (POST)
  .post('/profile', async (ctx) => {
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const session = await auth.validateSession(sessionId);
    if (!session?.userId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const body = await ctx.request.json();
    const { name, email, preferred_language, password } = body as Record<string, string>;
    if (!name || !email || !preferred_language) {
      return ctx.set.status = 400, { error: i18n.t('All fields are required') };
    }
    // Check for email conflict
    const existing = await db.selectFrom('user').select('id').where('email', '=', email).where('id', '!=', session.userId).executeTakeFirst();
    if (existing) {
      return ctx.set.status = 400, { error: i18n.t('Email already registered') };
    }
    // Update user
    let update: any = { name, email, preferred_language, updated_at: new Date() };
    if (password) {
      const bcrypt = await import('bcryptjs');
      update.password_hash = await bcrypt.hash(password, 10);
    }
    await db.updateTable('user').set(update).where('id', '=', session.userId).execute();
    return { success: true };
  });
