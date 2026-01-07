const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = 3000;

// Database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Endpoints

// Get all vehicles
app.get('/api/vehicles', async (req, res) => {
  try {
    const query = `
      SELECT v.*, s.name as status_name, s.description as status_desc 
      FROM vehicles v 
      LEFT JOIN repair_statuses s ON v.current_status_id = s.id
      ORDER BY v.updated_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  }
});

// Create new vehicle
app.post('/api/vehicles', async (req, res) => {
  const { plate, model, brand, year, color, is_insurance_claim, insurance_company, policy_number, entry_reason, owner_name, contact_phone, email, rfc } = req.body;
  try {
    // Default status: 'Ingreso'
    const statusResult = await pool.query("SELECT id FROM repair_statuses WHERE name = 'Ingreso'");
    const statusId = statusResult.rows[0]?.id || 1;

    // Default user: 'recepcion' (ID 1 assumed from seed)
    const userId = 1;

    const query = `
      INSERT INTO vehicles (plate, model, brand, year, color, kilometers, serial_number, fuel_level, current_status_id, registered_by, is_insurance_claim, insurance_company, policy_number, entry_reason, owner_name, contact_phone, email, rfc) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
      RETURNING *
    `;
    const result = await pool.query(query, [plate, model, brand, year, color, req.body.kilometers || null, req.body.serial_number || null, req.body.fuel_level || null, statusId, userId, is_insurance_claim || false, insurance_company, policy_number || null, entry_reason, owner_name, contact_phone, email, rfc]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error', details: err.message });
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
