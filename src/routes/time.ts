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
      <form method="post" action="/time/new" class="max-w-md mx-auto mt-8 p-4 border rounded bg-white">
        <h1 class="text-2xl mb-4">${i18n.t('Add Time Entry')}</h1>
        <label class="block mb-2">Date<input name="date" type="date" class="input input-bordered w-full" required></label>
        <label class="block mb-2">Work Start<input name="work_start_time" type="time" class="input input-bordered w-full" required></label>
        <label class="block mb-2">Work End<input name="work_end_time" type="time" class="input input-bordered w-full" required></label>
        <label class="block mb-2">Travel Start<input name="travel_start_time" type="time" class="input input-bordered w-full"></label>
        <label class="block mb-2">Travel End<input name="travel_end_time" type="time" class="input input-bordered w-full"></label>
        <label class="block mb-2">Break Start<input name="break_start_time" type="time" class="input input-bordered w-full"></label>
        <label class="block mb-2">Break End<input name="break_end_time" type="time" class="input input-bordered w-full"></label>
        <label class="block mb-2">Extra Time<input name="extra_time" type="time" class="input input-bordered w-full"></label>
        <label class="block mb-2">Comments<textarea name="comments" class="input input-bordered w-full"></textarea></label>
        <button class="btn btn-primary w-full" type="submit">${i18n.t('submit')}</button>
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
    let html = `<table class="min-w-full table-auto border mt-8">
      <thead><tr>
        <th>Date</th><th>Work Start</th><th>Work End</th><th>Travel Start</th><th>Travel End</th><th>Break Start</th><th>Break End</th><th>Extra</th><th>Comments</th>
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
    let html = `<table class="min-w-full table-auto border mt-8">
      <thead><tr>
        <th>Date</th><th>Work</th><th>Travel</th><th>Break</th><th>Extra</th><th>Flex</th>
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
  });
