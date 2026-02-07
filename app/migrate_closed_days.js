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
        console.log('Migrating database: Adding is_closed to daily_capacities...');

        await pool.query(`
      ALTER TABLE daily_capacities 
      ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;
    `);

        console.log('Migration successful: is_closed column added.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
