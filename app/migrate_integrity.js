const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'db',
    database: process.env.DB_NAME || 'crm_db',
    password: process.env.DB_PASS || 'postgres',
    port: process.env.DB_PORT || 5432,
});

async function runMigration() {
    try {
        console.log('Starting Integrity Migration...');
        // In Docker, if app is at /usr/src/app, and db is at /usr/src/db?
        // Let's rely on relative path from where we run it.
        // If we run `docker exec ... node migrate_integrity.js`, cwd is /usr/src/app.
        // BUT the `db` folder might not be in the container if only `app` is COPYied or mounted?
        // Let's check if I can read the file content directly in this script to be safe.
        const sql = `
-- 1. Soft Deletes (Add deleted_at)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- 2. Indexes for Performance (CONCURRENTLY not allowed in transaction block easily, so standard create)
CREATE INDEX IF NOT EXISTS idx_vehicles_current_status ON vehicles(current_status_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON vehicles(created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_revisions_scheduled_date ON revisions(scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_revisions_plate ON revisions(plate) WHERE deleted_at IS NULL;
`;

        await pool.query(sql);

        console.log('Migration Applied Successfully.');
        console.log('- Added deleted_at columns');
        console.log('- Created performance indexes');
    } catch (err) {
        console.error('Migration Failed:', err);
    } finally {
        await pool.end();
    }
}

runMigration();
