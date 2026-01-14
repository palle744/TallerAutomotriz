-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'employee', -- 'admin', 'employee'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Status Catalogue
CREATE TABLE IF NOT EXISTS repair_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'Ingreso', 'En Proceso', 'Pintura', 'Armado', 'Finalizado', 'Entregado'
    description TEXT
);

-- Seed Statuses
INSERT INTO repair_statuses (name, description) VALUES
('Ingreso', 'Vehículo registrado en el taller'),
('En Proceso', 'Reparación iniciada'),
('Pintura', 'En fase de pintura'),
('Armado', 'En fase de armado'),
('Finalizado', 'Reparación completada, listo para entrega'),
('Entregado', 'Entregado al cliente')
ON CONFLICT (name) DO NOTHING;

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    plate VARCHAR(20) UNIQUE NOT NULL,
    model VARCHAR(100),
    brand VARCHAR(100), -- New column
    year INTEGER,       -- New column
    color VARCHAR(50),
    is_insurance_claim BOOLEAN DEFAULT FALSE, -- New column
    insurance_company VARCHAR(150),           -- New column
    policy_number VARCHAR(50),                -- New column
    kilometers INTEGER,                       -- New column
    serial_number VARCHAR(50),                -- New column
    fuel_level VARCHAR(50),                   -- New column
    entry_reason TEXT,                        -- New column
    owner_name VARCHAR(150),                  -- New column
    contact_phone VARCHAR(50),                -- New column
    email VARCHAR(100),                       -- New column
    rfc VARCHAR(20),                          -- New column (Optional)
    registered_by INTEGER REFERENCES users(id),
    current_status_id INTEGER REFERENCES repair_statuses(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default User
INSERT INTO users (username, password_hash, role) 
VALUES ('recepcion', 'hash_placeholder', 'employee')
ON CONFLICT (username) DO NOTHING;


-- Revisions Table (Separate from Reviews/Vehicles)
CREATE TABLE IF NOT EXISTS revisions (
    id SERIAL PRIMARY KEY,
    revision_code VARCHAR(20) UNIQUE, -- New Custom ID
    plate VARCHAR(20) NOT NULL, -- Not unique here, a car can have multiple revisions
    model VARCHAR(100),
    brand VARCHAR(100),
    year INTEGER,
    color VARCHAR(50),
    is_insurance_claim BOOLEAN DEFAULT FALSE,
    insurance_company VARCHAR(150),
    policy_number VARCHAR(50),
    kilometers INTEGER,
    serial_number VARCHAR(50),
    fuel_level VARCHAR(50),
    entry_reason TEXT,
    owner_name VARCHAR(150),
    contact_phone VARCHAR(50),
    email VARCHAR(100),
    rfc VARCHAR(20),
    scheduled_date TIMESTAMP, -- For Calendar
    checked_in BOOLEAN DEFAULT FALSE, -- Flag for status view
    registered_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Estimates (Presupuestos)
CREATE TABLE IF NOT EXISTS estimates (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
    revision_id INTEGER REFERENCES revisions(id), -- Linked revision
    total_amount DECIMAL(10, 2),
    data JSONB, -- Stores the structured breakdown (categories, parts, costs)
    created_by INTEGER REFERENCES users(id) DEFAULT 1, -- Default to 'recepcion' for now
    approved_amount DECIMAL(10, 2) DEFAULT 0,
    approval_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Photos (Expediente Fotográfico)
CREATE TABLE IF NOT EXISTS vehicle_photos (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
    file_path VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Status Logs (History)
CREATE TABLE IF NOT EXISTS vehicle_status_logs (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
    from_status_id INTEGER REFERENCES repair_statuses(id),
    to_status_id INTEGER REFERENCES repair_statuses(id),
    changed_by INTEGER REFERENCES users(id), -- User who made the change
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50), -- Efectivo, Tarjeta, Transferencia, Cheque
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) DEFAULT 1
);
