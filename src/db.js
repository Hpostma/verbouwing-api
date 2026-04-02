import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function testConnection() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT NOW()');
    console.log('Database connected:', rows[0].now);
  } finally {
    client.release();
  }
}
