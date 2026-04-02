import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '7d';

export function signToken(profile) {
  return jwt.sign(
    { id: profile.id, email: profile.email, role: profile.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Fastify decorator: auth vereist
export async function requireAuth(request, reply) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : request.cookies?.token;

  if (!token) {
    return reply.code(401).send({ error: 'Niet ingelogd' });
  }

  try {
    const payload = verifyToken(token);
    // Haal actueel profiel op (rol kan gewijzigd zijn)
    const { rows } = await pool.query(
      'SELECT id, email, display_name, role FROM profiles WHERE id = $1',
      [payload.id]
    );
    if (!rows[0]) {
      return reply.code(401).send({ error: 'Gebruiker niet gevonden' });
    }
    request.user = rows[0];
  } catch {
    return reply.code(401).send({ error: 'Ongeldige sessie' });
  }
}

// Helper: is eigenaar of partner?
export function isOwnerOrPartner(user) {
  return user.role === 'eigenaar' || user.role === 'partner';
}
