// Elysia main entrypoint
import { Elysia } from 'elysia';
import { db } from './db';
import { i18n } from './i18n';
import { userRoutes } from './routes/user';
import { timeEntryRoutes } from './routes/time';
import { settingsRoutes } from './routes/settings';

const app = new Elysia();

app.get('/', (ctx) => {
  // Example: use i18n for welcome message
  return i18n.t('welcome');
});

app.use(userRoutes);
app.use(timeEntryRoutes);
app.use(settingsRoutes);

app.listen(3000);

console.log('Server started on http://localhost:3000');
