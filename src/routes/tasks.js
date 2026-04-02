import { pool } from '../db.js';
import { requireAuth, isOwnerOrPartner } from '../auth.js';

export default async function tasksRoutes(app) {
  // Alle hooks: auth vereist
  app.addHook('preHandler', requireAuth);

  // GET /tasks
  app.get('/', async (request) => {
    const user = request.user;

    if (isOwnerOrPartner(user)) {
      const { rows } = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
      return rows;
    }

    // Aannemer/architect: alleen zichtbare taken
    const { rows } = await pool.query(
      'SELECT * FROM tasks WHERE $1::user_role = ANY(visible_to_roles) ORDER BY created_at DESC',
      [user.role]
    );
    return rows;
  });

  // GET /tasks/:id
  app.get('/:id', async (request, reply) => {
    const user = request.user;
    const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [request.params.id]);

    if (!rows[0]) return reply.code(404).send({ error: 'Taak niet gevonden' });

    const task = rows[0];
    if (!isOwnerOrPartner(user) && !task.visible_to_roles.includes(user.role)) {
      return reply.code(403).send({ error: 'Geen toegang' });
    }

    return task;
  });

  // POST /tasks
  app.post('/', async (request, reply) => {
    if (!isOwnerOrPartner(request.user)) {
      return reply.code(403).send({ error: 'Alleen eigenaar/partner kan taken aanmaken' });
    }

    const { title, status, category, priority, assigned_to, deadline, estimated_cost, notes, checklist, visible_to_roles } = request.body;

    const { rows } = await pool.query(
      `INSERT INTO tasks (title, status, category, priority, assigned_to, deadline, estimated_cost, notes, checklist, visible_to_roles, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        title,
        status || 'Te doen',
        category || 'Overig',
        priority || 'Midden',
        assigned_to || 'Samen',
        deadline || null,
        estimated_cost || null,
        notes || null,
        JSON.stringify(checklist || []),
        visible_to_roles || ['eigenaar', 'partner'],
        request.user.id,
      ]
    );
    return reply.code(201).send(rows[0]);
  });

  // PUT /tasks/:id
  app.put('/:id', async (request, reply) => {
    const user = request.user;

    // Aannemer mag alleen status updaten
    if (user.role === 'aannemer') {
      const { status } = request.body;
      const { rows } = await pool.query(
        `UPDATE tasks SET status = $1, updated_by = $2
         WHERE id = $3 AND 'aannemer' = ANY(visible_to_roles)
         RETURNING *`,
        [status, user.id, request.params.id]
      );
      if (!rows[0]) return reply.code(403).send({ error: 'Geen toegang' });
      return rows[0];
    }

    if (!isOwnerOrPartner(user)) {
      return reply.code(403).send({ error: 'Geen toegang' });
    }

    const { title, status, category, priority, assigned_to, deadline, estimated_cost, notes, checklist, visible_to_roles } = request.body;

    const { rows } = await pool.query(
      `UPDATE tasks SET
        title = COALESCE($1, title),
        status = COALESCE($2, status),
        category = COALESCE($3, category),
        priority = COALESCE($4, priority),
        assigned_to = COALESCE($5, assigned_to),
        deadline = $6,
        estimated_cost = $7,
        notes = $8,
        checklist = COALESCE($9, checklist),
        visible_to_roles = COALESCE($10, visible_to_roles),
        updated_by = $11
       WHERE id = $12
       RETURNING *`,
      [
        title, status, category, priority, assigned_to,
        deadline, estimated_cost, notes,
        checklist ? JSON.stringify(checklist) : null,
        visible_to_roles,
        user.id,
        request.params.id,
      ]
    );

    if (!rows[0]) return reply.code(404).send({ error: 'Taak niet gevonden' });
    return rows[0];
  });

  // DELETE /tasks/:id
  app.delete('/:id', async (request, reply) => {
    if (!isOwnerOrPartner(request.user)) {
      return reply.code(403).send({ error: 'Alleen eigenaar/partner kan taken verwijderen' });
    }

    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [request.params.id]);
    if (rowCount === 0) return reply.code(404).send({ error: 'Taak niet gevonden' });
    return { ok: true };
  });
}
