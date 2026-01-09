const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = 3000;

// Database connection
const isProduction = process.env.DB_HOST && process.env.DB_HOST.includes('amazonaws.com');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Endpoints

// Get all vehicles (with option filter by status)
app.get('/api/vehicles', async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT v.*, s.name as status_name, s.description as status_desc,
      (
        SELECT EXISTS (
          SELECT 1
          FROM estimates e, jsonb_array_elements(e.data) as elem
          WHERE e.vehicle_id = v.id
          AND lower(elem->>'name') LIKE '%pintura%'
          AND ((elem->>'enabled')::boolean IS NOT FALSE)
        )
      ) as has_paint_work,
      (
        SELECT EXISTS (
          SELECT 1
          FROM estimates e, jsonb_array_elements(e.data) as elem
          WHERE e.vehicle_id = v.id
          AND lower(elem->>'name') LIKE '%laminado%'
          AND ((elem->>'enabled')::boolean IS NOT FALSE)
        )
      ) as has_laminado_work,
      (
        SELECT approved_amount > 0 
        FROM estimates e 
        WHERE e.vehicle_id = v.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) as is_estimate_authorized,
      (
        SELECT revision_code 
        FROM revisions r 
        WHERE r.plate = v.plate 
        ORDER BY created_at DESC 
        LIMIT 1
      ) as last_revision_code
      FROM vehicles v 
      LEFT JOIN repair_statuses s ON v.current_status_id = s.id
    `;
    const params = [];

    if (status) {
      query += ` WHERE s.name = $1`;
      params.push(status);

      // Robustness: If filtering by 'Ingreso', also exclude vehicles that HAVE revisions 
      // (even if status wasn't updated correctly).
      // Logic: Exclude if a revision exists for this plate created AFTER or roughly same time as vehicle entry.
      // Logic: Exclude if a revision exists for this plate created AFTER or roughly same time as vehicle entry.
      // FIX: Removed incorrect DATE logic that was hiding vehicles entered on same day.
      if (status === 'Ingreso') {
        // Previously we filtered out vehicles that had revisions, but that caused issues 
        // when checking in from a revision on the same day.
        // For now, we trust the status 'Ingreso' is correct.
      }
    }

    query += ` ORDER BY v.updated_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Get Single Vehicle
app.get('/api/vehicles/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
            SELECT v.*, s.name as status_name,
            (SELECT revision_code FROM revisions r WHERE lower(r.plate) = lower(v.plate) ORDER BY r.created_at DESC LIMIT 1) as revision_code
            FROM vehicles v 
            LEFT JOIN repair_statuses s ON v.current_status_id = s.id 
            WHERE v.id = $1`;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Get Latest Estimate for Vehicle
app.get('/api/estimates/vehicle/:vehicle_id', async (req, res) => {
  const { vehicle_id } = req.params;
  try {
    // Get the latest estimate for this vehicle
    const query = `
            SELECT * FROM estimates 
            WHERE vehicle_id = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `;
    const result = await pool.query(query, [vehicle_id]);
    if (result.rows.length === 0) {
      return res.json(null); // No estimate found
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Create new vehicle
app.post('/api/vehicles', async (req, res) => {
  const { plate, model, brand, year, color, is_insurance_claim, insurance_company, policy_number, entry_reason, owner_name, contact_phone, email, rfc, revision_id } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Duplicate Check for Revision
    if (revision_id) {
      const checkRev = await client.query('SELECT checked_in FROM revisions WHERE id = $1', [revision_id]);
      if (checkRev.rows.length > 0 && checkRev.rows[0].checked_in) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El vehículo de esta revisión ya ha sido ingresado.' });
      }
    }

    // Default status: 'Ingreso'
    const statusResult = await client.query("SELECT id FROM repair_statuses WHERE name = 'Ingreso'");
    const statusId = statusResult.rows[0]?.id || 1;

    // Default user: 'recepcion' (ID 1 assumed from seed)
    const userId = 1;

    const query = `
      INSERT INTO vehicles (plate, model, brand, year, color, kilometers, serial_number, fuel_level, current_status_id, registered_by, is_insurance_claim, insurance_company, policy_number, entry_reason, owner_name, contact_phone, email, rfc) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
      RETURNING *
    `;
    const result = await client.query(query, [plate, model, brand, year, color, req.body.kilometers || null, req.body.serial_number || null, req.body.fuel_level || null, statusId, userId, is_insurance_claim || false, insurance_company, policy_number || null, entry_reason, owner_name, contact_phone, email, rfc]);

    // Mark Revision as Checked In
    if (revision_id) {
      await client.query('UPDATE revisions SET checked_in = TRUE WHERE id = $1', [revision_id]);
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    // Handle unique constraint violation more gracefully if needed
    if (err.code === '23505') { // unique_violation
      return res.status(400).json({ error: 'Error: Ya existe un vehículo registrado con esta placa o datos únicos.' });
    }
    res.status(500).json({ error: 'Database Error', details: err.message });
  } finally {
    client.release();
  }
});

// Helper to generate Revision Code
async function generateRevisionCode(brand, pool) {
  const months = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const now = new Date();
  const monthIndex = now.getMonth(); // 0-11
  const monthLetter = months[monthIndex];
  const monthNum = (monthIndex + 1).toString().padStart(2, '0');
  const brandInitial = brand ? brand.charAt(0).toUpperCase() : 'X';

  let code;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    const random4 = Math.floor(1000 + Math.random() * 9000); // 1000-9999
    code = `${monthLetter}${monthNum}${brandInitial}${random4}`;

    // Check uniqueness
    const check = await pool.query('SELECT id FROM revisions WHERE revision_code = $1', [code]);
    if (check.rows.length === 0) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) throw new Error('Could not generate unique Revision Code');
  return code;
}

// Create new revision
app.post('/api/revisions', async (req, res) => {
  const { plate, model, brand, year, color, is_insurance_claim, insurance_company, policy_number, entry_reason, owner_name, contact_phone, email, rfc, scheduled_date } = req.body;
  try {
    // Default user: 'recepcion' (ID 1 assumed from seed)
    const userId = 1;

    // Generate Custom ID
    const revisionCode = await generateRevisionCode(brand, pool);

    const query = `
      INSERT INTO revisions (revision_code, plate, model, brand, year, color, kilometers, serial_number, fuel_level, registered_by, is_insurance_claim, insurance_company, policy_number, entry_reason, owner_name, contact_phone, email, rfc, scheduled_date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) 
      RETURNING id, revision_code
    `;
    const result = await pool.query(query, [revisionCode, plate, model, brand, year, color, req.body.kilometers || null, req.body.serial_number || null, req.body.fuel_level || null, userId, is_insurance_claim || false, insurance_company, policy_number || null, entry_reason, owner_name, contact_phone, email, rfc, scheduled_date || null]);

    // Reliable Status Update:
    // 1. Get IDs dynamically to be safe.
    // 2. Use LOWER(plate) to ensure matches.
    // 3. Update ALL 'Ingreso' vehicles with this plate to 'En Proceso'.
    await pool.query(
      `UPDATE vehicles 
       SET current_status_id = (SELECT id FROM repair_statuses WHERE name = 'En Proceso') 
       WHERE LOWER(plate) = LOWER($1) 
       AND current_status_id = (SELECT id FROM repair_statuses WHERE name = 'Ingreso')`,
      [plate]
    );

    res.json({
      id: result.rows[0].id,
      revision_code: result.rows[0].revision_code,
      message: 'Revisión creada correctamente'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error', details: err.message });
  }
});

// Schedule Revision (Update Date)
app.put('/api/revisions/schedule', async (req, res) => {
  const { revision_code, scheduled_date } = req.body;
  try {
    const query = 'UPDATE revisions SET scheduled_date = $1 WHERE revision_code = $2 RETURNING id';
    const result = await pool.query(query, [scheduled_date, revision_code]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Revisión no encontrada' });
    }
    res.json({ message: 'Agendado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Unschedule Revision (Cancel Appointment)
app.put('/api/revisions/:id/unschedule', async (req, res) => {
  const { id } = req.params;
  try {
    const check = await pool.query('SELECT checked_in FROM revisions WHERE id = $1', [id]);
    if (check.rows.length > 0 && check.rows[0].checked_in) {
      return res.status(403).json({ error: 'No se puede cancelar una cita ya ingresada' });
    }

    const query = 'UPDATE revisions SET scheduled_date = NULL WHERE id = $1';
    await pool.query(query, [id]);
    res.json({ message: 'Cita cancelada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Check-in Revision (Create Vehicle Entry)
app.post('/api/revisions/:id/checkin', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Get Revision
    const revResult = await pool.query('SELECT * FROM revisions WHERE id = $1', [id]);
    if (revResult.rows.length === 0) return res.status(404).json({ error: 'Revisión no encontrada' });
    const rev = revResult.rows[0];

    // 1.5 Check if already checked in TODAY (by plate)
    const duplicateCheck = await pool.query(
      'SELECT id FROM vehicles WHERE plate = $1 AND created_at::date = CURRENT_DATE',
      [rev.plate]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Este vehículo ya tiene un ingreso registrado el día de hoy.' });
    }

    // 2. Insert into Vehicles (Ingreso)
    const insertQuery = `
      INSERT INTO vehicles (plate, model, brand, year, color, current_status_id, registered_by, owner_name, contact_phone, email, rfc)
      VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10)
      RETURNING id
    `;
    const result = await pool.query(insertQuery, [
      rev.plate, rev.model, rev.brand, rev.year, rev.color,
      rev.registered_by || 1,
      rev.owner_name, rev.contact_phone, rev.email, rev.rfc
    ]);

    // 3. Mark Revision as Checked-in
    await pool.query('UPDATE revisions SET checked_in = TRUE WHERE id = $1', [id]);

    res.json({ message: 'Vehículo ingresado correctamente', vehicle_id: result.rows[0].id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Get revision by ID (for Calendar Details)
app.get('/api/revisions/id/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'SELECT * FROM revisions WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Revisión no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Get revision by code for autofill
app.get('/api/revisions/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const query = 'SELECT * FROM revisions WHERE revision_code = $1';
    const result = await pool.query(query, [code]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Revisión no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Create new estimate
app.post('/api/estimates', async (req, res) => {
  let { vehicle_id, vehicle_details, total_amount, data, revision_id } = req.body;
  try {
    // If vehicle_id is missing, try to find or create the vehicle
    if (!vehicle_id && vehicle_details) {
      const { plate, brand, model, year, color, owner_name, contact_phone, email, rfc } = vehicle_details;

      // Double check if vehicle exists
      const checkq = await pool.query('SELECT id FROM vehicles WHERE plate = $1', [plate]);
      if (checkq.rows.length > 0) {
        vehicle_id = checkq.rows[0].id;
      } else {
        // Create new vehicle
        // Default status: 'Ingreso' (ID 1), User: 'recepcion' (ID 1)
        const createq = `
          INSERT INTO vehicles (plate, model, brand, year, color, current_status_id, registered_by, owner_name, contact_phone, email, rfc) 
          VALUES ($1, $2, $3, $4, $5, 1, 1, $6, $7, $8, $9) 
          RETURNING id
        `;
        const newVehicle = await pool.query(createq, [plate, model, brand, year, color, owner_name, contact_phone, email, rfc]);
        vehicle_id = newVehicle.rows[0].id;
      }
    }

    if (!vehicle_id) {
      return res.status(400).json({ error: 'Falta ID de Vehículo y no se proporcionaron detalles para crearlo.' });
    }

    const query = `
      INSERT INTO estimates (vehicle_id, total_amount, data, created_by, revision_id) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING id
    `;
    // Hardcoded user ID 1 (recepcion) for now, as auth isn't fully implemented in session
    const result = await pool.query(query, [vehicle_id, total_amount, JSON.stringify(data), 1, revision_id || null]);
    res.json({ id: result.rows[0].id, message: 'Presupuesto guardado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error', details: err.message });
  }
});

// Get all estimates
app.get('/api/estimates', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id, e.total_amount, e.approved_amount, e.approval_notes, e.created_at,
             v.plate, v.brand, v.model,
             u.username as created_by_user
      FROM estimates e
      JOIN vehicles v ON e.vehicle_id = v.id
      LEFT JOIN users u ON e.created_by = u.id
      ORDER BY e.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Update approval
app.put('/api/estimates/:id/approval', async (req, res) => {
  const { id } = req.params;
  const { approved_amount, approval_notes } = req.body;
  try {
    await pool.query(
      'UPDATE estimates SET approved_amount = $1, approval_notes = $2 WHERE id = $3',
      [approved_amount, approval_notes, id]
    );
    res.json({ message: 'Aprobación actualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Get single estimate (full details)
app.get('/api/estimates/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
            SELECT e.*, v.plate, v.brand, v.model, v.year, v.owner_name, v.contact_phone, v.email, v.rfc, v.color, r.revision_code
            FROM estimates e
            JOIN vehicles v ON e.vehicle_id = v.id
            LEFT JOIN revisions r ON e.revision_id = r.id
            WHERE e.id = $1
        `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Update full estimate content
app.put('/api/estimates/:id', async (req, res) => {
  const { id } = req.params;
  const { total_amount, data } = req.body;
  try {
    // Check if already approved
    const checkQuery = 'SELECT approved_amount FROM estimates WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }

    if (parseFloat(checkResult.rows[0].approved_amount) > 0) {
      return res.status(403).json({ error: 'No se puede modificar un presupuesto ya autorizado.' });
    }

    await pool.query(
      'UPDATE estimates SET total_amount = $1, data = $2 WHERE id = $3',
      [total_amount, JSON.stringify(data), id]
    );
    res.json({ message: 'Presupuesto actualizado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error', details: err.message });
  }
});

// Get vehicle by plate for search
app.get('/api/vehicles/search/:plate', async (req, res) => {
  const { plate } = req.params;
  try {
    const query = 'SELECT * FROM vehicles WHERE plate = $1';
    const result = await pool.query(query, [plate]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Get all revisions
app.get('/api/revisions', async (req, res) => {
  try {
    const query = `
      SELECT r.*, u.username as registered_by_name 
      FROM revisions r
      LEFT JOIN users u ON r.registered_by = u.id
      ORDER BY r.created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Get daily entries
app.get('/api/reports/daily', async (req, res) => {
  try {
    const query = `
      SELECT v.id, v.plate, v.model, v.brand, v.year, u.username as registered_by_name 
      FROM vehicles v
      LEFT JOIN users u ON v.registered_by = u.id
      WHERE v.created_at::date = CURRENT_DATE
      ORDER BY v.created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});


// Update vehicle status with logging
app.put('/api/vehicles/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status_id, user_id } = req.body; // user_id optional, default to 1
  const actingUser = user_id || 1;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current status
    const currentRes = await client.query('SELECT current_status_id FROM vehicles WHERE id = $1', [id]);
    const oldStatus = currentRes.rows[0]?.current_status_id;

    // Update Status
    await client.query('UPDATE vehicles SET current_status_id = $1, updated_at = NOW() WHERE id = $2', [status_id, id]);

    // Log History
    if (oldStatus !== status_id) {
      await client.query(
        'INSERT INTO vehicle_status_logs (vehicle_id, from_status_id, to_status_id, changed_by) VALUES ($1, $2, $3, $4)',
        [id, oldStatus, status_id, actingUser]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Estatus actualizado' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  } finally {
    client.release();
  }
});

// Get Paint History
app.get('/api/reports/paint-history', async (req, res) => {
  try {
    // 3 = Pintura status ID
    const query = `
      SELECT
        v.plate, v.brand, v.model, v.color,
        (SELECT revision_code FROM revisions r WHERE r.plate = v.plate ORDER BY created_at DESC LIMIT 1) as revision_code,
        l_in.changed_at as entry_date,
        u_in.username as entry_user,
        l_out.changed_at as exit_date,
        u_out.username as exit_user
      FROM vehicle_status_logs l_in
      JOIN vehicles v ON l_in.vehicle_id = v.id
      LEFT JOIN users u_in ON l_in.changed_by = u_in.id
      LEFT JOIN LATERAL (
        SELECT changed_at, changed_by
        FROM vehicle_status_logs
        WHERE vehicle_id = l_in.vehicle_id
        AND from_status_id = 3
        AND changed_at > l_in.changed_at
        ORDER BY changed_at ASC
        LIMIT 1
      ) l_out ON true
      LEFT JOIN users u_out ON l_out.changed_by = u_out.id
      WHERE l_in.to_status_id = 3
      ORDER BY l_in.changed_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Get Laminado History
app.get('/api/reports/laminado-history', async (req, res) => {
  try {
    // 7 = Laminado status ID
    const query = `
      SELECT
        v.plate, v.brand, v.model, v.color,
        (SELECT revision_code FROM revisions r WHERE r.plate = v.plate ORDER BY created_at DESC LIMIT 1) as revision_code,
        l_in.changed_at as entry_date,
        u_in.username as entry_user,
        l_out.changed_at as exit_date,
        u_out.username as exit_user
      FROM vehicle_status_logs l_in
// ... (rest of query)
      JOIN vehicles v ON l_in.vehicle_id = v.id
      LEFT JOIN users u_in ON l_in.changed_by = u_in.id
      LEFT JOIN LATERAL (
        SELECT changed_at, changed_by
        FROM vehicle_status_logs
        WHERE vehicle_id = l_in.vehicle_id
        AND from_status_id = 7
        AND changed_at > l_in.changed_at
        ORDER BY changed_at ASC
        LIMIT 1
      ) l_out ON true
      LEFT JOIN users u_out ON l_out.changed_by = u_out.id
      WHERE l_in.to_status_id = 7
      ORDER BY l_in.changed_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Get statuses
app.get('/api/statuses', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM repair_statuses ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database Error');
  }
});

app.listen(port, () => {
  console.log(`CRM App listening on port ${port}`);
});
