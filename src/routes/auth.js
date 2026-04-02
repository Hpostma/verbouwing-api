import bcrypt from 'bcrypt';
import { pool } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

export default async function authRoutes(app) {
  // Registreren
  app.post('/register', async (request, reply) => {
    const { email, password, display_name } = request.body;

    if (!email || !password || !display_name) {
      return reply.code(400).send({ error: 'Email, wachtwoord en naam zijn verplicht' });
    }

    const existing = await pool.query('SELECT id FROM profiles WHERE email = $1', [email]);
    if (existing.rows[0]) {
      return reply.code(409).send({ error: 'Email is al in gebruik' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO profiles (email, display_name, password_hash, role)
       VALUES ($1, $2, $3, 'viewer')
       RETURNING id, email, display_name, role`,
      [email, display_name, password_hash]
    );

    const token = signToken(rows[0]);
    return { token, profile: rows[0] };
  });

  // Inloggen
  app.post('/login', async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email en wachtwoord zijn verplicht' });
    }

    const { rows } = await pool.query(
      'SELECT id, email, display_name, role, password_hash FROM profiles WHERE email = $1',
      [email]
    );

    if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return reply.code(401).send({ error: 'Ongeldige inloggegevens' });
    }

    const profile = { id: rows[0].id, email: rows[0].email, display_name: rows[0].display_name, role: rows[0].role };
    const token = signToken(profile);
    return { token, profile };
  });

  // Huidig profiel
  app.get('/me', { preHandler: [requireAuth] }, async (request) => {
    return request.user;
  });

  // Alle profielen (eigenaar/partner)
  app.get('/profiles', { preHandler: [requireAuth] }, async (request, reply) => {
    if (request.user.role !== 'eigenaar' && request.user.role !== 'partner') {
      return reply.code(403).send({ error: 'Geen toegang' });
    }
    const { rows } = await pool.query(
      'SELECT id, email, display_name, role, created_at FROM profiles ORDER BY created_at'
    );
    return rows;
  });

  // Rol wijzigen (alleen eigenaar)
  app.patch('/profiles/:id/role', { preHandler: [requireAuth] }, async (request, reply) => {
    if (request.user.role !== 'eigenaar') {
      return reply.code(403).send({ error: 'Alleen de eigenaar kan rollen wijzigen' });
    }

    const { role } = request.body;
    const validRoles = ['eigenaar', 'partner', 'aannemer', 'architect', 'viewer'];
    if (!validRoles.includes(role)) {
      return reply.code(400).send({ error: 'Ongeldige rol' });
    }

    const { rows } = await pool.query(
      'UPDATE profiles SET role = $1 WHERE id = $2 RETURNING id, email, display_name, role',
      [role, request.params.id]
    );

    if (!rows[0]) return reply.code(404).send({ error: 'Gebruiker niet gevonden' });
    return rows[0];
  });
}
