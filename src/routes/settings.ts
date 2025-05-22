import { Elysia } from 'elysia';
import { db } from '../db';
import { i18n } from '../i18n';
import { lucia } from '../auth';

export const settingsRoutes = new Elysia({ prefix: '/settings' })
  // Settings form (GET)
  .get('/', async (ctx) => {
    // --- Auth check ---
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    const session = await lucia.validateSession(sessionId);
    if (!session.user) return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    // Fetch settings for user
    let settings = await db.selectFrom('settings').selectAll().where('user_id', '=', session.user.id).executeTakeFirst();
    if (!settings) {
      settings = {
        id: '',
        user_id: session.user.id,
        normal_work_time: '08:00',
        summer_work_time: '07:15'
      };
    }
    return `
      <form method="post" action="/settings" class="max-w-md mx-auto mt-8 p-4 border rounded bg-white" aria-labelledby="settings-title">
        <h1 id="settings-title" class="text-2xl mb-4">${i18n.t('Settings')}</h1>
        <label class="block mb-2" for="normal_work_time">${i18n.t('Normal Work Time')}</label>
        <input id="normal_work_time" name="normal_work_time" type="time" class="input input-bordered w-full" required value="${settings.normal_work_time}" />
        <label class="block mb-2" for="summer_work_time">${i18n.t('Summer Work Time')}</label>
        <input id="summer_work_time" name="summer_work_time" type="time" class="input input-bordered w-full" required value="${settings.summer_work_time}" />
        <button class="btn btn-primary w-full mt-4" type="submit">${i18n.t('submit')}</button>
      </form>
    `;
  })
  // Settings update (POST)
  .post('/', async (ctx) => {
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    const session = await lucia.validateSession(sessionId);
    if (!session.user) return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    const body = await ctx.request.json() as Record<string, string>;
    const { normal_work_time, summer_work_time } = body;
    if (!normal_work_time || !summer_work_time) {
      return ctx.set.status = 400, { error: i18n.t('All fields are required') };
    }
    // Upsert settings
    const existing = await db.selectFrom('settings').select('id').where('user_id', '=', session.user.id).executeTakeFirst();
    if (existing) {
      await db.updateTable('settings').set({ normal_work_time, summer_work_time }).where('user_id', '=', session.user.id).execute();
    } else {
      await db.insertInto('settings').values({
        id: (await import('crypto')).randomUUID(),
        user_id: session.user.id,
        normal_work_time,
        summer_work_time,
      }).execute();
    }
    return { success: true };
  });
