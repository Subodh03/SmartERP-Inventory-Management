const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { seedCompanyDefaults } = require('../utils/seedDefaults');

const router = express.Router();
router.use(requireAuth);

const MAX_COMPANIES = 5;

// GET /api/companies - list companies owned by the logged-in user
router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM companies WHERE owner_id=$1 ORDER BY id', [req.user.id]);
  res.json(rows);
});

// POST /api/companies - create (max 5 per account)
router.post('/', async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT COUNT(*) FROM companies WHERE owner_id=$1', [req.user.id]);
    if (Number(existing[0].count) >= MAX_COMPANIES) {
      return res.status(400).json({ error: `Each account can manage a maximum of ${MAX_COMPANIES} companies.` });
    }
    const { name, address, gst_number, state, phone, email, fy_start, fy_end } = req.body;
    if (!name) return res.status(400).json({ error: 'Company name is required' });

    const { rows } = await pool.query(
      `INSERT INTO companies (owner_id,name,address,gst_number,state,phone,email,fy_start,fy_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7,
         COALESCE($8::date, '2025-04-01'::date), COALESCE($9::date, '2026-03-31'::date))
       RETURNING *`,
      [req.user.id, name, address, gst_number, state, phone, email, fy_start, fy_end]
    );
    const company = rows[0];
    await seedCompanyDefaults(company.id);
    res.status(201).json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/companies/:id - alter company info
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const owned = await pool.query('SELECT id FROM companies WHERE id=$1 AND owner_id=$2', [id, req.user.id]);
    if (!owned.rows.length) return res.status(404).json({ error: 'Company not found' });

    const { name, address, gst_number, state, phone, email, fy_start, fy_end } = req.body;
    const { rows } = await pool.query(
      `UPDATE companies SET name=$1,address=$2,gst_number=$3,state=$4,phone=$5,email=$6,
         fy_start=COALESCE($7,fy_start), fy_end=COALESCE($8,fy_end)
       WHERE id=$9 RETURNING *`,
      [name, address, gst_number, state, phone, email, fy_start, fy_end, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/companies/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const owned = await pool.query('SELECT id FROM companies WHERE id=$1 AND owner_id=$2', [id, req.user.id]);
    if (!owned.rows.length) return res.status(404).json({ error: 'Company not found' });
    await pool.query('DELETE FROM companies WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
