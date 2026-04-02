import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { pool, testConnection } from './db.js';
import authRoutes from './routes/auth.js';
import tasksRoutes from './routes/tasks.js';
import financesRoutes from './routes/finances.js';
import agreementsRoutes from './routes/agreements.js';
import inspirationRoutes from './routes/inspiration.js';

const app = Fastify({ logger: true });

// CORS — frontend op Cloudflare Pages
await app.register(cors, {
  origin: [
    'https://verbouwing.nastoppos.app',
    'http://localhost:5173',
  ],
  credentials: true,
});

await app.register(cookie, {
  secret: process.env.COOKIE_SECRET,
});

// Health check
app.get('/health', async () => ({ status: 'ok' }));

// Routes
await app.register(authRoutes, { prefix: '/auth' });
await app.register(tasksRoutes, { prefix: '/tasks' });
await app.register(financesRoutes, { prefix: '/finances' });
await app.register(agreementsRoutes, { prefix: '/agreements' });
await app.register(inspirationRoutes, { prefix: '/inspiration' });

// Views / overzichten
app.get('/views/budget-summary', async (request, reply) => {
  const { rows } = await pool.query('SELECT * FROM budget_summary');
  return rows;
});

app.get('/views/tasks-progress', async (request, reply) => {
  const { rows } = await pool.query('SELECT * FROM tasks_progress');
  return rows;
});

app.get('/views/breached-agreements', async (request, reply) => {
  const { rows } = await pool.query('SELECT * FROM breached_agreements');
  return rows;
});

// Start
const port = parseInt(process.env.PORT || '3000');
try {
  await testConnection();
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
