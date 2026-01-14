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
        console.log('Migrating database: Adding checked_in to revisions...');

        await pool.query(`
      ALTER TABLE revisions 
      ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT FALSE;
    `);

        console.log('Migration successful: checked_in column added.');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1); // Exit with error code to fail the startup script
    } finally {
        await pool.end();
    }
}

migrate();
