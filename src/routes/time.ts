import { Elysia } from 'elysia';
import { db } from '../db';
import { i18n } from '../i18n';
import { randomUUID } from 'crypto';
import { auth } from '../auth';

export const timeEntryRoutes = new Elysia({ prefix: '/time' })
  // Time entry form (GET)
  .get('/new', (ctx) => {
    // Render time entry form (SSR, EJS or HTML string for now)
    return `
      <form method="post" action="/time/new" class="max-w-md mx-auto mt-8 p-4 border rounded bg-white" aria-labelledby="timeentry-title">
        <h1 id="timeentry-title" class="text-2xl mb-4">${i18n.t('Add Time Entry')}</h1>
        <label class="block mb-2" for="date">Date</label>
        <input id="date" name="date" type="date" class="input input-bordered w-full" required autocomplete="off" />
        <label class="block mb-2" for="work_start_time">Work Start</label>
        <input id="work_start_time" name="work_start_time" type="time" class="input input-bordered w-full" required autocomplete="off" />
        <label class="block mb-2" for="work_end_time">Work End</label>
        <input id="work_end_time" name="work_end_time" type="time" class="input input-bordered w-full" required autocomplete="off" />
        <label class="block mb-2" for="travel_start_time">Travel Start</label>
        <input id="travel_start_time" name="travel_start_time" type="time" class="input input-bordered w-full" autocomplete="off" />
        <label class="block mb-2" for="travel_end_time">Travel End</label>
        <input id="travel_end_time" name="travel_end_time" type="time" class="input input-bordered w-full" autocomplete="off" />
        <label class="block mb-2" for="break_start_time">Break Start</label>
        <input id="break_start_time" name="break_start_time" type="time" class="input input-bordered w-full" autocomplete="off" />
        <label class="block mb-2" for="break_end_time">Break End</label>
        <input id="break_end_time" name="break_end_time" type="time" class="input input-bordered w-full" autocomplete="off" />
        <label class="block mb-2" for="extra_time">Extra Time</label>
        <input id="extra_time" name="extra_time" type="time" class="input input-bordered w-full" autocomplete="off" />
        <label class="block mb-2" for="comments">Comments</label>
        <textarea id="comments" name="comments" class="input input-bordered w-full" aria-multiline="true"></textarea>
        <button class="btn btn-primary w-full mt-4" type="submit">${i18n.t('submit')}</button>
      </form>
    `;
  })
  // Time entry handler (POST)
  .post('/new', async (ctx) => {
    // --- Auth check (simple cookie/session) ---
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const session = await auth.validateSession(sessionId);
    if (!session?.userId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    // --- Input validation ---
    const body = await ctx.request.json();
    const { date, work_start_time, work_end_time, travel_start_time, travel_end_time, break_start_time, break_end_time, extra_time, comments } = body as Record<string, string>;
    if (!date || !work_start_time || !work_end_time) {
      return ctx.set.status = 400, { error: i18n.t('Required fields missing') };
    }
    // --- Insert time entry ---
    await db.insertInto('time_entry').values({
      id: randomUUID(),
      user_id: session.userId,
      date: new Date(date),
      work_start_time,
      work_end_time,
      travel_start_time,
      travel_end_time,
      break_start_time,
      break_end_time,
      extra_time,
      comments,
      created_at: new Date(),
      updated_at: new Date(),
    }).execute();
    return { success: true };
  })
  // List time entries (GET)
  .get('/list', async (ctx) => {
    // --- Auth check (simple cookie/session) ---
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const session = await auth.validateSession(sessionId);
    if (!session?.userId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    // --- Fetch time entries for user ---
    const entries = await db.selectFrom('time_entry')
      .selectAll()
      .where('user_id', '=', session.userId)
      .orderBy('date desc')
      .execute();
    // Render as simple HTML table (SSR, EJS or HTML string for now)
    let html = `<table class="min-w-full table-auto border mt-8" aria-label="Time Entries">
      <thead><tr>
        <th scope="col">Date</th><th scope="col">Work Start</th><th scope="col">Work End</th><th scope="col">Travel Start</th><th scope="col">Travel End</th><th scope="col">Break Start</th><th scope="col">Break End</th><th scope="col">Extra</th><th scope="col">Comments</th>
      </tr></thead><tbody>`;
    for (const e of entries) {
      html += `<tr>
        <td>${e.date.toISOString().slice(0,10)}</td>
        <td>${e.work_start_time ?? ''}</td>
        <td>${e.work_end_time ?? ''}</td>
        <td>${e.travel_start_time ?? ''}</td>
        <td>${e.travel_end_time ?? ''}</td>
        <td>${e.break_start_time ?? ''}</td>
        <td>${e.break_end_time ?? ''}</td>
        <td>${e.extra_time ?? ''}</td>
        <td>${e.comments ?? ''}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    return html;
  })
  // Summary of flex time (GET)
  .get('/summary', async (ctx) => {
    // --- Auth check (simple cookie/session) ---
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const session = await auth.validateSession(sessionId);
    if (!session?.userId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    // --- Fetch time entries for user (last 30 days for demo) ---
    const entries = await db.selectFrom('time_entry')
      .selectAll()
      .where('user_id', '=', session.userId)
      .where('date', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .orderBy('date desc')
      .execute();
    // --- Calculate daily flex and totals ---
    let totalFlexMinutes = 0;
    let html = `<table class="min-w-full table-auto border mt-8" aria-label="Flex Time Summary">
      <thead><tr>
        <th scope="col">Date</th><th scope="col">Work</th><th scope="col">Travel</th><th scope="col">Break</th><th scope="col">Extra</th><th scope="col">Flex</th>
      </tr></thead><tbody>`;
    for (const e of entries) {
      // Calculate work, travel, break, extra, flex (simple demo logic)
      const workMinutes = (parseTime(e.work_end_time) - parseTime(e.work_start_time)) / 60_000;
      const travelMinutes = (e.travel_start_time && e.travel_end_time) ? (parseTime(e.travel_end_time) - parseTime(e.travel_start_time)) / 60_000 : 0;
      const breakMinutes = (e.break_start_time && e.break_end_time) ? (parseTime(e.break_end_time) - parseTime(e.break_start_time)) / 60_000 : 0;
      const extraMinutes = e.extra_time ? parseInterval(e.extra_time) : 0;
      // Assume normal work time is 8h (480 min) for demo
      const flex = workMinutes + travelMinutes + extraMinutes - breakMinutes - 480;
      totalFlexMinutes += flex;
      html += `<tr>
        <td>${e.date.toISOString().slice(0,10)}</td>
        <td>${workMinutes}</td>
        <td>${travelMinutes}</td>
        <td>${breakMinutes}</td>
        <td>${extraMinutes}</td>
        <td>${flex}</td>
      </tr>`;
    }
    html += `</tbody><tfoot><tr><td colspan="5">Total Flex</td><td>${totalFlexMinutes}</td></tr></tfoot></table>`;
    // --- Helper functions ---
    function parseTime(t: string | null | undefined): number { if (!t) return 0; const [h,m,s] = t.split(':').map(Number); return ((h||0)*60+(m||0))*60_000; }
    function parseInterval(i: string | null | undefined): number { if (!i) return 0; const [h,m,s] = i.split(':').map(Number); return ((h||0)*60+(m||0))*60_000; }
    return html;
  })
  // Export time entries as CSV (GET)
  .get('/export/csv', async (ctx) => {
    // --- Auth check (simple cookie/session) ---
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    const session = await auth.validateSession(sessionId);
    if (!session?.userId) {
      return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    }
    // --- Fetch all time entries for user ---
    const entries = await db.selectFrom('time_entry')
      .selectAll()
      .where('user_id', '=', session.userId)
      .orderBy('date desc')
      .execute();
    // --- Build CSV ---
    const header = [
      'date','work_start_time','work_end_time','travel_start_time','travel_end_time','break_start_time','break_end_time','extra_time','comments'
    ];
    const rows = entries.map(e => [
      e.date.toISOString().slice(0,10),
      e.work_start_time ?? '',
      e.work_end_time ?? '',
      e.travel_start_time ?? '',
      e.travel_end_time ?? '',
      e.break_start_time ?? '',
      e.break_end_time ?? '',
      e.extra_time ?? '',
      (e.comments ?? '').replace(/"/g, '""')
    ]);
    let csv = header.join(',') + '\n';
    for (const row of rows) {
      csv += row.map(v => `"${v}"`).join(',') + '\n';
    }
    ctx.set.headers['Content-Type'] = 'text/csv';
    ctx.set.headers['Content-Disposition'] = 'attachment; filename="time_entries.csv"';
    return csv;
  })
  // Edit time entry form (GET)
  .get('/edit/:id', async (ctx) => {
    // --- Auth check ---
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    const session = await auth.validateSession(sessionId);
    if (!session?.userId) return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    // --- Fetch entry ---
    const entry = await db.selectFrom('time_entry').selectAll().where('id', '=', ctx.params.id).where('user_id', '=', session.userId).executeTakeFirst();
    if (!entry) return ctx.set.status = 404, { error: i18n.t('Entry not found') };
    // --- Render edit form ---
    return `
      <form method="post" action="/time/edit/${entry.id}" class="max-w-md mx-auto mt-8 p-4 border rounded bg-white" aria-labelledby="editentry-title">
        <h1 id="editentry-title" class="text-2xl mb-4">${i18n.t('Edit Time Entry')}</h1>
        <label class="block mb-2" for="date">Date</label>
        <input id="date" name="date" type="date" class="input input-bordered w-full" required value="${entry.date.toISOString().slice(0,10)}" />
        <label class="block mb-2" for="work_start_time">Work Start</label>
        <input id="work_start_time" name="work_start_time" type="time" class="input input-bordered w-full" required value="${entry.work_start_time ?? ''}" />
        <label class="block mb-2" for="work_end_time">Work End</label>
        <input id="work_end_time" name="work_end_time" type="time" class="input input-bordered w-full" required value="${entry.work_end_time ?? ''}" />
        <label class="block mb-2" for="travel_start_time">Travel Start</label>
        <input id="travel_start_time" name="travel_start_time" type="time" class="input input-bordered w-full" value="${entry.travel_start_time ?? ''}" />
        <label class="block mb-2" for="travel_end_time">Travel End</label>
        <input id="travel_end_time" name="travel_end_time" type="time" class="input input-bordered w-full" value="${entry.travel_end_time ?? ''}" />
        <label class="block mb-2" for="break_start_time">Break Start</label>
        <input id="break_start_time" name="break_start_time" type="time" class="input input-bordered w-full" value="${entry.break_start_time ?? ''}" />
        <label class="block mb-2" for="break_end_time">Break End</label>
        <input id="break_end_time" name="break_end_time" type="time" class="input input-bordered w-full" value="${entry.break_end_time ?? ''}" />
        <label class="block mb-2" for="extra_time">Extra Time</label>
        <input id="extra_time" name="extra_time" type="time" class="input input-bordered w-full" value="${entry.extra_time ?? ''}" />
        <label class="block mb-2" for="comments">Comments</label>
        <textarea id="comments" name="comments" class="input input-bordered w-full" aria-multiline="true">${entry.comments ?? ''}</textarea>
        <button class="btn btn-primary w-full mt-4" type="submit">${i18n.t('submit')}</button>
      </form>
    `;
  })
  // Edit time entry handler (POST)
  .post('/edit/:id', async (ctx) => {
    // --- Auth check ---
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    const session = await auth.validateSession(sessionId);
    if (!session?.userId) return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    // --- Fetch entry ---
    const entry = await db.selectFrom('time_entry').select('id').where('id', '=', ctx.params.id).where('user_id', '=', session.userId).executeTakeFirst();
    if (!entry) return ctx.set.status = 404, { error: i18n.t('Entry not found') };
    // --- Update entry ---
    const body = await ctx.request.json();
    const { date, work_start_time, work_end_time, travel_start_time, travel_end_time, break_start_time, break_end_time, extra_time, comments } = body as Record<string, string>;
    if (!date || !work_start_time || !work_end_time) {
      return ctx.set.status = 400, { error: i18n.t('Required fields missing') };
    }
    await db.updateTable('time_entry').set({
      date: new Date(date),
      work_start_time,
      work_end_time,
      travel_start_time,
      travel_end_time,
      break_start_time,
      break_end_time,
      extra_time,
      comments,
      updated_at: new Date(),
    }).where('id', '=', ctx.params.id).where('user_id', '=', session.userId).execute();
    return { success: true };
  })
  // Delete time entry (POST)
  .post('/delete/:id', async (ctx) => {
    // --- Auth check ---
    const cookie = ctx.request.headers.get('cookie');
    const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionId) return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    const session = await auth.validateSession(sessionId);
    if (!session?.userId) return ctx.set.status = 401, { error: i18n.t('Not authenticated') };
    // --- Fetch entry ---
    const entry = await db.selectFrom('time_entry').select('id').where('id', '=', ctx.params.id).where('user_id', '=', session.userId).executeTakeFirst();
    if (!entry) return ctx.set.status = 404, { error: i18n.t('Entry not found') };
    // --- Delete entry ---
    await db.deleteFrom('time_entry').where('id', '=', ctx.params.id).where('user_id', '=', session.userId).execute();
    return { success: true };
  });
