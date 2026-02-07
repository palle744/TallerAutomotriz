const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'db',
    database: process.env.DB_NAME || 'crm_db',
    password: process.env.DB_PASS || 'postgres',
    port: process.env.DB_PORT || 5432,
});

async function migrate() {
    try {
        console.log('Migrating database...');

        await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_capacities (
          date DATE PRIMARY KEY,
          capacity INTEGER NOT NULL DEFAULT 20,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        console.log('Migration successful: daily_capacities table created.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
