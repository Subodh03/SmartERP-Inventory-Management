const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

async function assertOwnership(companyId, userId, res) {
  const { rows } = await pool.query('SELECT id FROM companies WHERE id=$1 AND owner_id=$2', [companyId, userId]);
  if (!rows.length) { res.status(403).json({ error: 'Not authorized for this company' }); return false; }
  return true;
}

async function nextVoucherNo(companyId, voucherType) {
  const { rows } = await pool.query(
    'SELECT COUNT(*) FROM vouchers WHERE company_id=$1 AND voucher_type=$2', [companyId, voucherType]
  );
  const n = Number(rows[0].count) + 1;
  const prefix = { contra: 'CN', payment: 'PV', receipt: 'RV', journal: 'JV' }[voucherType] || 'VN';
  return `${prefix}-${String(n).padStart(4, '0')}`;
}


router.get('/', async (req, res) => {
  const { company_id, voucher_type } = req.query;
  if (!company_id) return res.status(400).json({ error: 'company_id is required' });
  if (!(await assertOwnership(company_id, req.user.id, res))) return;

  let sql = `SELECT v.*,
      (SELECT json_agg(json_build_object('ledger_id', e.ledger_id, 'ledger_name', l.name, 'entry_type', e.entry_type, 'amount', e.amount))
       FROM voucher_entries e JOIN ledgers l ON l.id = e.ledger_id WHERE e.voucher_id = v.id) AS entries
     FROM vouchers v WHERE v.company_id=$1`;
  const params = [company_id];
  if (voucher_type) { params.push(voucher_type); sql += ` AND v.voucher_type=$${params.length}`; }
  sql += ' ORDER BY v.voucher_date DESC, v.id DESC';
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});


router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { company_id, voucher_type, voucher_date, narration, debit_ledger_id, credit_ledger_id, amount } = req.body;
    if (!company_id || !voucher_type || !debit_ledger_id || !credit_ledger_id || !amount) {
      return res.status(400).json({ error: 'company_id, voucher_type, debit_ledger_id, credit_ledger_id and amount are required' });
    }
    if (!(await assertOwnership(company_id, req.user.id, res))) return;
    if (!['contra', 'payment', 'receipt', 'journal'].includes(voucher_type)) {
      return res.status(400).json({ error: 'Invalid voucher_type' });
    }

    await client.query('BEGIN');
    const voucherNo = await nextVoucherNo(company_id, voucher_type);
    const { rows: vRows } = await client.query(
      `INSERT INTO vouchers (company_id,voucher_type,voucher_no,voucher_date,narration,total_amount)
       VALUES ($1,$2,$3,COALESCE($4,CURRENT_DATE),$5,$6) RETURNING *`,
      [company_id, voucher_type, voucherNo, voucher_date, narration, amount]
    );
    const voucher = vRows[0];

    await client.query(
      `INSERT INTO voucher_entries (voucher_id,ledger_id,entry_type,amount) VALUES ($1,$2,'Dr',$3)`,
      [voucher.id, debit_ledger_id, amount]
    );
    await client.query(
      `INSERT INTO voucher_entries (voucher_id,ledger_id,entry_type,amount) VALUES ($1,$2,'Cr',$3)`,
      [voucher.id, credit_ledger_id, amount]
    );

    await client.query('COMMIT');
    res.status(201).json(voucher);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  await pool.query('DELETE FROM vouchers WHERE id=$1 AND company_id=$2', [req.params.id, company_id]);
  res.json({ success: true });
});

module.exports = router;
