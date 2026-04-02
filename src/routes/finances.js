import { pool } from '../db.js';
import { requireAuth, isOwnerOrPartner } from '../auth.js';

export default async function financesRoutes(app) {
  app.addHook('preHandler', requireAuth);

  // Alleen eigenaar/partner heeft toegang tot financien
  app.addHook('preHandler', async (request, reply) => {
    if (!isOwnerOrPartner(request.user)) {
      return reply.code(403).send({ error: 'Geen toegang tot financiën' });
    }
  });

  app.get('/', async () => {
    const { rows } = await pool.query('SELECT * FROM finances ORDER BY created_at DESC');
    return rows;
  });

  app.get('/:id', async (request, reply) => {
    const { rows } = await pool.query('SELECT * FROM finances WHERE id = $1', [request.params.id]);
    if (!rows[0]) return reply.code(404).send({ error: 'Niet gevonden' });
    return rows[0];
  });

  app.post('/', async (request, reply) => {
    const { description, category, budgeted, actual, vendor, invoice_number, date, paid, notes } = request.body;

    const { rows } = await pool.query(
      `INSERT INTO finances (description, category, budgeted, actual, vendor, invoice_number, date, paid, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [description, category || 'Overig', budgeted, actual, vendor, invoice_number, date, paid || false, notes, request.user.id]
    );
    return reply.code(201).send(rows[0]);
  });

  app.put('/:id', async (request) => {
    const { description, category, budgeted, actual, vendor, invoice_number, date, paid, notes } = request.body;

    const { rows } = await pool.query(
      `UPDATE finances SET
        description = COALESCE($1, description),
        category = COALESCE($2, category),
        budgeted = $3, actual = $4,
        vendor = $5, invoice_number = $6,
        date = $7, paid = COALESCE($8, paid),
        notes = $9, updated_by = $10
       WHERE id = $11
       RETURNING *`,
      [description, category, budgeted, actual, vendor, invoice_number, date, paid, notes, request.user.id, request.params.id]
    );
    return rows[0];
  });

  app.delete('/:id', async (request, reply) => {
    const { rowCount } = await pool.query('DELETE FROM finances WHERE id = $1', [request.params.id]);
    if (rowCount === 0) return reply.code(404).send({ error: 'Niet gevonden' });
    return { ok: true };
  });
}
