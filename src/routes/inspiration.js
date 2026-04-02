import { pool } from '../db.js';
import { requireAuth, isOwnerOrPartner } from '../auth.js';

export default async function inspirationRoutes(app) {
  app.addHook('preHandler', requireAuth);

  // Alleen eigenaar/partner
  app.addHook('preHandler', async (request, reply) => {
    if (!isOwnerOrPartner(request.user)) {
      return reply.code(403).send({ error: 'Geen toegang tot inspiratie' });
    }
  });

  app.get('/', async () => {
    const { rows } = await pool.query('SELECT * FROM inspiration ORDER BY created_at DESC');
    return rows;
  });

  app.get('/:id', async (request, reply) => {
    const { rows } = await pool.query('SELECT * FROM inspiration WHERE id = $1', [request.params.id]);
    if (!rows[0]) return reply.code(404).send({ error: 'Niet gevonden' });
    return rows[0];
  });

  app.post('/', async (request, reply) => {
    const { title, category, room, link, added_by, status, estimated_cost, notes } = request.body;

    const { rows } = await pool.query(
      `INSERT INTO inspiration (title, category, room, link, added_by, status, estimated_cost, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [title, category || 'Materiaal', room || 'Overig', link, added_by, status || 'Idee', estimated_cost, notes, request.user.id]
    );
    return reply.code(201).send(rows[0]);
  });

  app.put('/:id', async (request) => {
    const { title, category, room, link, added_by, status, estimated_cost, notes } = request.body;

    const { rows } = await pool.query(
      `UPDATE inspiration SET
        title = COALESCE($1, title), category = COALESCE($2, category),
        room = COALESCE($3, room), link = $4, added_by = $5,
        status = COALESCE($6, status), estimated_cost = $7,
        notes = $8, updated_by = $9
       WHERE id = $10
       RETURNING *`,
      [title, category, room, link, added_by, status, estimated_cost, notes, request.user.id, request.params.id]
    );
    return rows[0];
  });

  app.delete('/:id', async (request, reply) => {
    const { rowCount } = await pool.query('DELETE FROM inspiration WHERE id = $1', [request.params.id]);
    if (rowCount === 0) return reply.code(404).send({ error: 'Niet gevonden' });
    return { ok: true };
  });
}
