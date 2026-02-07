-- 1. Soft Deletes (Add deleted_at)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- 2. Indexes for Performance

-- Dashboard filtering by status is frequent
CREATE INDEX IF NOT EXISTS idx_vehicles_current_status ON vehicles(current_status_id) WHERE deleted_at IS NULL;

-- Daily reports filter by created_at (Date)
CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON vehicles(created_at) WHERE deleted_at IS NULL;

-- Calendar queries filter by scheduled_date
CREATE INDEX IF NOT EXISTS idx_revisions_scheduled_date ON revisions(scheduled_date) WHERE deleted_at IS NULL;

-- Search by plate (frequent)
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_revisions_plate ON revisions(plate) WHERE deleted_at IS NULL;

-- 3. Modify Constraints (Safety)
-- We cannot easily change ON DELETE CASCADE to RESTRICT in one go without dropping constraints.
-- For now, we rely on Soft Deletes in the app layer.
-- But let's verify foreign keys exist (Init.sql handles creation, no need to alter if they exist).

-- 4. Constraint for Plate format (Uppercase, no spaces ideally, but let's just trigger UPPER)
-- Postgres doesn't strictly support "TRIGGER BEFORE INSERT" in simple SQL script without function defs.
-- Check constraint is easier:
-- ALTER TABLE vehicles ADD CONSTRAINT check_plate_upper CHECK (plate = UPPER(plate));
-- (Commented out to avoid breaking existing data if dirty. App should clean it).
