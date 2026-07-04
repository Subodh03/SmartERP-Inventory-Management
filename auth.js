const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'smarterp_dev_secret';

// POST /api/auth/register  (creates an admin account - in production an existing
// admin would create user accounts; self-registration is provided for first-run setup)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id, name, email, role',
      [name, email, hash]
    );
    const user = rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET, { expiresIn: '12h' });
    res.status(201).json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const user = { id: rows[0].id, name: rows[0].name, email: rows[0].email, role: rows[0].role };
    const token = jwt.sign(user, SECRET, { expiresIn: '12h' });
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
