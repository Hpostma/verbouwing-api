/**
 * Seed script — maak de eerste eigenaar-account aan.
 *
 * Gebruik:
 *   DATABASE_URL=postgresql://... node src/seed.js
 *
 * Of via Docker:
 *   docker compose exec verbouwing-api node src/seed.js
 */

import bcrypt from 'bcrypt';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const EMAIL = process.argv[2] || 'hendrik@nastoppos.app';
const PASSWORD = process.argv[3] || 'wijzig-dit-wachtwoord';
const NAME = process.argv[4] || 'Hendrik';

async function seed() {
  const hash = await bcrypt.hash(PASSWORD, 12);

  const { rows } = await pool.query(
    `INSERT INTO profiles (email, display_name, password_hash, role)
     VALUES ($1, $2, $3, 'eigenaar')
     ON CONFLICT (email) DO UPDATE SET password_hash = $3, role = 'eigenaar'
     RETURNING id, email, display_name, role`,
    [EMAIL, NAME, hash]
  );

  console.log('Eigenaar aangemaakt:', rows[0]);
  console.log('\nJe kunt nu inloggen met:');
  console.log(`  Email:      ${EMAIL}`);
  console.log(`  Wachtwoord: ${PASSWORD}`);
  console.log('\nWIJZIG HET WACHTWOORD NA EERSTE INLOG!');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
