// Elysia main entrypoint
import { Elysia } from 'elysia';

const app = new Elysia();

app.get('/', () => 'Grumpy Tracker is running!');

app.listen(3000);

console.log('Server started on http://localhost:3000');
