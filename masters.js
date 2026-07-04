const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function companyScope(req) {
  return req.query.company_id || req.body.company_id;
}

async function assertOwnership(req, res) {
  const companyId = companyScope(req);
  if (!companyId) { res.status(400).json({ error: 'company_id is required' }); return null; }
  const { rows } = await pool.query('SELECT id FROM companies WHERE id=$1 AND owner_id=$2', [companyId, req.user.id]);
  if (!rows.length) { res.status(403).json({ error: 'Not authorized for this company' }); return null; }
  return companyId;
}

router.get('/groups', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  const { rows } = await pool.query('SELECT * FROM groups WHERE company_id=$1 ORDER BY nature, name', [companyId]);
  res.json(rows);
});

router.post('/groups', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  try {
    const { name, nature, parent_id } = req.body;
    if (!name || !nature) return res.status(400).json({ error: 'name and nature are required' });
    const { rows } = await pool.query(
      'INSERT INTO groups (company_id,name,nature,parent_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [companyId, name, nature, parent_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/groups/:id', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  await pool.query('DELETE FROM groups WHERE id=$1 AND company_id=$2 AND is_system=false', [req.params.id, companyId]);
  res.json({ success: true });
});


router.get('/ledgers', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  const { type } = req.query;
  let sql = `SELECT l.*, g.name AS group_name, g.nature
             FROM ledgers l JOIN groups g ON g.id = l.group_id
             WHERE l.company_id=$1`;
  const params = [companyId];
  if (type) { params.push(type); sql += ` AND l.ledger_type=$${params.length}`; }
  sql += ' ORDER BY l.name';
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

router.get('/ledgers/:id', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  const { rows } = await pool.query(
    `SELECT l.*, g.name AS group_name, g.nature FROM ledgers l JOIN groups g ON g.id=l.group_id
     WHERE l.id=$1 AND l.company_id=$2`, [req.params.id, companyId]);
  if (!rows.length) return res.status(404).json({ error: 'Ledger not found' });
  res.json(rows[0]);
});

router.post('/ledgers', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  try {
    const { name, group_id, ledger_type, opening_balance, balance_type, mobile, address, gstin } = req.body;
    if (!name || !group_id) return res.status(400).json({ error: 'name and group_id are required' });
    const { rows } = await pool.query(
      `INSERT INTO ledgers (company_id,group_id,name,ledger_type,opening_balance,balance_type,mobile,address,gstin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [companyId, group_id, name, ledger_type || 'general', opening_balance || 0, balance_type || 'Dr', mobile, address, gstin]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/ledgers/:id', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  try {
    const { name, group_id, ledger_type, opening_balance, balance_type, mobile, address, gstin, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE ledgers SET name=$1, group_id=$2, ledger_type=$3, opening_balance=$4,
        balance_type=$5, mobile=$6, address=$7, gstin=$8, is_active=COALESCE($9,is_active)
       WHERE id=$10 AND company_id=$11 RETURNING *`,
      [name, group_id, ledger_type, opening_balance, balance_type, mobile, address, gstin, is_active, req.params.id, companyId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ledger not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/ledgers/:id', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  await pool.query('DELETE FROM ledgers WHERE id=$1 AND company_id=$2', [req.params.id, companyId]);
  res.json({ success: true });
});


router.get('/units', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  const { rows } = await pool.query('SELECT * FROM units WHERE company_id=$1 ORDER BY symbol', [companyId]);
  res.json(rows);
});

router.post('/units', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  try {
    const { symbol, name } = req.body;
    if (!symbol || !name) return res.status(400).json({ error: 'symbol and name are required' });
    const { rows } = await pool.query(
      'INSERT INTO units (company_id,symbol,name) VALUES ($1,$2,$3) RETURNING *', [companyId, symbol, name]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/units/:id', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  await pool.query('DELETE FROM units WHERE id=$1 AND company_id=$2', [req.params.id, companyId]);
  res.json({ success: true });
});


router.get('/stock-groups', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  const { rows } = await pool.query('SELECT * FROM stock_groups WHERE company_id=$1 ORDER BY name', [companyId]);
  res.json(rows);
});

router.post('/stock-groups', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      'INSERT INTO stock_groups (company_id,name) VALUES ($1,$2) RETURNING *', [companyId, name]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


router.get('/stock-items', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  const { rows } = await pool.query(
    `SELECT si.*, u.symbol AS unit_symbol, sg.name AS stock_group_name
     FROM stock_items si
     LEFT JOIN units u ON u.id = si.unit_id
     LEFT JOIN stock_groups sg ON sg.id = si.stock_group_id
     WHERE si.company_id=$1 ORDER BY si.name`, [companyId]);
  res.json(rows);
});

router.post('/stock-items', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  try {
    const { name, sku, stock_group_id, unit_id, purchase_price, selling_price, gst_percent, opening_qty, reorder_level } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      `INSERT INTO stock_items (company_id,name,sku,stock_group_id,unit_id,purchase_price,selling_price,gst_percent,opening_qty,quantity,reorder_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10) RETURNING *`,
      [companyId, name, sku, stock_group_id || null, unit_id || null, purchase_price || 0, selling_price || 0, gst_percent || 0, opening_qty || 0, reorder_level || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/stock-items/:id', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  try {
    const { name, sku, stock_group_id, unit_id, purchase_price, selling_price, gst_percent, reorder_level } = req.body;
    const { rows } = await pool.query(
      `UPDATE stock_items SET name=$1,sku=$2,stock_group_id=$3,unit_id=$4,purchase_price=$5,
        selling_price=$6,gst_percent=$7,reorder_level=$8 WHERE id=$9 AND company_id=$10 RETURNING *`,
      [name, sku, stock_group_id || null, unit_id || null, purchase_price, selling_price, gst_percent, reorder_level, req.params.id, companyId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Stock item not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/stock-items/:id', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  await pool.query('DELETE FROM stock_items WHERE id=$1 AND company_id=$2', [req.params.id, companyId]);
  res.json({ success: true });
});


router.post('/stock-items/:id/movement', async (req, res) => {
  const companyId = await assertOwnership(req, res); if (!companyId) return;
  try {
    const { movement_type, quantity, reference, notes } = req.body;
    if (!['in', 'out', 'transfer', 'adjustment', 'damaged'].includes(movement_type)) {
      return res.status(400).json({ error: 'Invalid movement_type' });
    }
    const qty = Number(quantity);
    const item = await pool.query('SELECT * FROM stock_items WHERE id=$1 AND company_id=$2', [req.params.id, companyId]);
    if (!item.rows.length) return res.status(404).json({ error: 'Stock item not found' });

    let { quantity: currentQty, damaged_qty } = item.rows[0];
    currentQty = Number(currentQty); damaged_qty = Number(damaged_qty);

    if (movement_type === 'in') currentQty += qty;
    else if (movement_type === 'out' || movement_type === 'transfer') currentQty -= qty;
    else if (movement_type === 'damaged') { currentQty -= qty; damaged_qty += qty; }
    else if (movement_type === 'adjustment') currentQty = qty; // set absolute value

    await pool.query('UPDATE stock_items SET quantity=$1, damaged_qty=$2 WHERE id=$3', [currentQty, damaged_qty, req.params.id]);
    await pool.query(
      `INSERT INTO stock_movements (company_id,stock_item_id,movement_type,quantity,reference,notes)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [companyId, req.params.id, movement_type, qty, reference, notes]
    );
    res.json({ success: true, quantity: currentQty, damaged_qty });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
