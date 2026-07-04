const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { ledgerBalance } = require('../utils/accounting');

const router = express.Router();
router.use(requireAuth);

async function assertOwnership(companyId, userId, res) {
  const { rows } = await pool.query('SELECT id FROM companies WHERE id=$1 AND owner_id=$2', [companyId, userId]);
  if (!rows.length) { res.status(403).json({ error: 'Not authorized for this company' }); return false; }
  return true;
}

async function getOrCreateGroup(companyId, name, nature) {
  const { rows } = await pool.query('SELECT id FROM groups WHERE company_id=$1 AND name=$2', [companyId, name]);
  if (rows.length) return rows[0].id;
  const created = await pool.query(
    'INSERT INTO groups (company_id,name,nature,is_system) VALUES ($1,$2,$3,true) RETURNING id', [companyId, name, nature]
  );
  return created.rows[0].id;
}

/* ============== CUSTOMERS ============== */
router.get('/customers', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const { rows } = await pool.query(`SELECT * FROM ledgers WHERE company_id=$1 AND ledger_type='customer' ORDER BY name`, [company_id]);
  const withBalance = await Promise.all(rows.map(async (l) => ({ ...l, outstanding_balance: await ledgerBalance(l.id) })));
  res.json(withBalance);
});

router.post('/customers', async (req, res) => {
  try {
    const { company_id, name, mobile, address, gstin, opening_balance } = req.body;
    if (!(await assertOwnership(company_id, req.user.id, res))) return;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const groupId = await getOrCreateGroup(company_id, 'Sundry Debtors', 'Assets');
    const { rows } = await pool.query(
      `INSERT INTO ledgers (company_id,group_id,name,ledger_type,mobile,address,gstin,opening_balance,balance_type)
       VALUES ($1,$2,$3,'customer',$4,$5,$6,$7,'Dr') RETURNING *`,
      [company_id, groupId, name, mobile, address, gstin, opening_balance || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/customers/:id', async (req, res) => {
  try {
    const { company_id, name, mobile, address, gstin } = req.body;
    if (!(await assertOwnership(company_id, req.user.id, res))) return;
    const { rows } = await pool.query(
      `UPDATE ledgers SET name=$1, mobile=$2, address=$3, gstin=$4 WHERE id=$5 AND company_id=$6 AND ledger_type='customer' RETURNING *`,
      [name, mobile, address, gstin, req.params.id, company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/customers/:id', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  await pool.query(`DELETE FROM ledgers WHERE id=$1 AND company_id=$2 AND ledger_type='customer'`, [req.params.id, company_id]);
  res.json({ success: true });
});

// Customer ledger / statement: all invoices + voucher entries chronologically
router.get('/customers/:id/statement', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const invoices = await pool.query(
    `SELECT invoice_date AS date, invoice_no AS reference, 'Sales Invoice' AS particulars, total AS debit, 0 AS credit
     FROM invoices WHERE party_ledger_id=$1 AND doc_type='gst_invoice'`, [req.params.id]
  );
  const vouchers = await pool.query(
    `SELECT v.voucher_date AS date, v.voucher_no AS reference,
            CONCAT(UPPER(SUBSTRING(v.voucher_type,1,1)), SUBSTRING(v.voucher_type,2), ' Voucher') AS particulars,
            CASE WHEN e.entry_type='Dr' THEN e.amount ELSE 0 END AS debit,
            CASE WHEN e.entry_type='Cr' THEN e.amount ELSE 0 END AS credit
     FROM voucher_entries e JOIN vouchers v ON v.id = e.voucher_id WHERE e.ledger_id=$1`, [req.params.id]
  );
  const rows = [...invoices.rows, ...vouchers.rows].sort((a, b) => new Date(a.date) - new Date(b.date));
  res.json(rows);
});

/* ============== SUPPLIERS ============== */
router.get('/suppliers', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const { rows } = await pool.query(`SELECT * FROM ledgers WHERE company_id=$1 AND ledger_type='supplier' ORDER BY name`, [company_id]);
  const withBalance = await Promise.all(rows.map(async (l) => {
    const net = await ledgerBalance(l.id);
    return { ...l, outstanding_dues: net < 0 ? -net : 0 };
  }));
  res.json(withBalance);
});

router.post('/suppliers', async (req, res) => {
  try {
    const { company_id, name, mobile, address, gstin, opening_balance } = req.body;
    if (!(await assertOwnership(company_id, req.user.id, res))) return;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const groupId = await getOrCreateGroup(company_id, 'Sundry Creditors', 'Liabilities');
    const { rows } = await pool.query(
      `INSERT INTO ledgers (company_id,group_id,name,ledger_type,mobile,address,gstin,opening_balance,balance_type)
       VALUES ($1,$2,$3,'supplier',$4,$5,$6,$7,'Cr') RETURNING *`,
      [company_id, groupId, name, mobile, address, gstin, opening_balance || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/suppliers/:id', async (req, res) => {
  try {
    const { company_id, name, mobile, address, gstin } = req.body;
    if (!(await assertOwnership(company_id, req.user.id, res))) return;
    const { rows } = await pool.query(
      `UPDATE ledgers SET name=$1, mobile=$2, address=$3, gstin=$4 WHERE id=$5 AND company_id=$6 AND ledger_type='supplier' RETURNING *`,
      [name, mobile, address, gstin, req.params.id, company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Supplier not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/suppliers/:id', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  await pool.query(`DELETE FROM ledgers WHERE id=$1 AND company_id=$2 AND ledger_type='supplier'`, [req.params.id, company_id]);
  res.json({ success: true });
});

router.get('/suppliers/:id/history', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const purchases = await pool.query(
    `SELECT invoice_date AS date, invoice_no AS reference, total AS amount FROM invoices
     WHERE party_ledger_id=$1 AND doc_type='purchase' ORDER BY invoice_date DESC`, [req.params.id]
  );
  const payments = await pool.query(
    `SELECT v.voucher_date AS date, v.voucher_no AS reference, e.amount
     FROM voucher_entries e JOIN vouchers v ON v.id=e.voucher_id
     WHERE e.ledger_id=$1 AND v.voucher_type='payment' ORDER BY v.voucher_date DESC`, [req.params.id]
  );
  res.json({ purchase_history: purchases.rows, payment_history: payments.rows });
});

module.exports = router;
