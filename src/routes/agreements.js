import { pool } from '../db.js';
import { requireAuth, isOwnerOrPartner } from '../auth.js';

export default async function agreementsRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request) => {
    const user = request.user;

    if (isOwnerOrPartner(user)) {
      const { rows } = await pool.query('SELECT * FROM agreements ORDER BY created_at DESC');
      return rows;
    }

    const { rows } = await pool.query(
      'SELECT * FROM agreements WHERE $1::user_role = ANY(visible_to_roles) ORDER BY created_at DESC',
      [user.role]
    );
    return rows;
  });

  app.get('/:id', async (request, reply) => {
    const { rows } = await pool.query('SELECT * FROM agreements WHERE id = $1', [request.params.id]);
    if (!rows[0]) return reply.code(404).send({ error: 'Niet gevonden' });

    if (!isOwnerOrPartner(request.user) && !rows[0].visible_to_roles.includes(request.user.role)) {
      return reply.code(403).send({ error: 'Geen toegang' });
    }
    return rows[0];
  });

  app.post('/', async (request, reply) => {
    if (!isOwnerOrPartner(request.user)) {
      return reply.code(403).send({ error: 'Alleen eigenaar/partner kan afspraken aanmaken' });
    }

    const { title, party, type, agreement_date, status, honored, contact_person, phone, email, notes, visible_to_roles } = request.body;

    const { rows } = await pool.query(
      `INSERT INTO agreements (title, party, type, agreement_date, status, honored, contact_person, phone, email, notes, visible_to_roles, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        title, party, type || 'Mondeling', agreement_date, status || 'Actief',
        honored || 'Nog niet', contact_person, phone, email, notes,
        visible_to_roles || ['eigenaar', 'partner'], request.user.id,
      ]
    );
    return reply.code(201).send(rows[0]);
  });

  app.put('/:id', async (request, reply) => {
    if (!isOwnerOrPartner(request.user)) {
      return reply.code(403).send({ error: 'Geen toegang' });
    }

    const { title, party, type, agreement_date, status, honored, contact_person, phone, email, notes, visible_to_roles } = request.body;

    const { rows } = await pool.query(
      `UPDATE agreements SET
        title = COALESCE($1, title), party = $2, type = COALESCE($3, type),
        agreement_date = $4, status = COALESCE($5, status), honored = COALESCE($6, honored),
        contact_person = $7, phone = $8, email = $9, notes = $10,
        visible_to_roles = COALESCE($11, visible_to_roles), updated_by = $12
       WHERE id = $13
       RETURNING *`,
      [title, party, type, agreement_date, status, honored, contact_person, phone, email, notes, visible_to_roles, request.user.id, request.params.id]
    );

    if (!rows[0]) return reply.code(404).send({ error: 'Niet gevonden' });
    return rows[0];
  });

  app.delete('/:id', async (request, reply) => {
    if (!isOwnerOrPartner(request.user)) {
      return reply.code(403).send({ error: 'Geen toegang' });
    }
    const { rowCount } = await pool.query('DELETE FROM agreements WHERE id = $1', [request.params.id]);
    if (rowCount === 0) return reply.code(404).send({ error: 'Niet gevonden' });
    return { ok: true };
  });
}
