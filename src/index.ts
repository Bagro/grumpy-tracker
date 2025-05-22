// Elysia main entrypoint
import { Elysia } from 'elysia';
import staticPlugin from '@elysiajs/static';
import { db } from './db';
import { i18n } from './i18n';
import { userRoutes } from './routes/user';
import { timeEntryRoutes } from './routes/time';
import { settingsRoutes } from './routes/settings';
import { renderPage } from './templates/renderPage';

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const app = new Elysia();

// Serve static files from /static
app.use(staticPlugin({
  assets: './src/static',
  prefix: '/static'
}));

// Error handler middleware
app.onError(({ code, error }) => {
  console.error('Elysia error:', code, error);
  return 'Internal server error';
});

app.get('/', async (ctx) => {
  const cookie = ctx.request.headers.get('cookie');
  const sessionId = cookie?.split(';').find((c) => c.trim().startsWith('session='))?.split('=')[1];
  if (!sessionId) {
    ctx.set.status = 302;
    ctx.set.headers['Location'] = '/user/login';
    return '';
  }
  const { lucia } = await import('./auth');
  const session = await lucia.validateSession(sessionId);
  if (!session.user) {
    ctx.set.status = 302;
    ctx.set.headers['Location'] = '/user/login';
    return '';
  }
  ctx.set.status = 302;
  ctx.set.headers['Location'] = '/time/summary';
  return '';
});

app.use(userRoutes);
app.use(timeEntryRoutes);
app.use(settingsRoutes);

app.listen(3000);

console.log('Server started on http://localhost:3000');
