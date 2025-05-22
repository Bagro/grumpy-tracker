import { Elysia } from 'elysia';
import { db } from '../db';
import { i18n } from '../i18n';

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
    const body = await ctx.request.json();
    // TODO: Validate input, insert time entry for the user
    // For now, just return a success message
    return { success: true };
  });
