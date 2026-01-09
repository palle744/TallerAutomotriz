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
        console.log('Creating vehicle_status_logs table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vehicle_status_logs (
                id SERIAL PRIMARY KEY,
                vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
                from_status_id INTEGER REFERENCES repair_statuses(id),
                to_status_id INTEGER REFERENCES repair_statuses(id),
                changed_by INTEGER REFERENCES users(id),
                changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT
            );
        `);
        console.log('Migration successful.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
