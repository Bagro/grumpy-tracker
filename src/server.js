import app from './index.js';
import { spawnSync } from 'child_process';

// Run migrations if not in test mode
if (process.env.NODE_ENV !== 'test') {
  // Use shell: true only on Windows for compatibility
  const isWindows = process.platform === 'win32';
  const result = isWindows
    ? spawnSync('npx prisma migrate deploy', { stdio: 'inherit', shell: true })
    : spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error('Failed to run database migrations. Exiting.');
    process.exit(result.status);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Grumpy Tracker running on http://localhost:${PORT}`);
});
