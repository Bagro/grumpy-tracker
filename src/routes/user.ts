import { Elysia } from 'elysia';
import { db } from '../db';
import { i18n } from '../i18n';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

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
  });
