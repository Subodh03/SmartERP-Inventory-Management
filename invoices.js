const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { renderInvoicePdf } = require('../utils/pdfGenerator');
const { getOrCreateLedger } = require('../utils/accounting');

const router = express.Router();
router.use(requireAuth);

async function assertOwnership(companyId, userId, res) {
  const { rows } = await pool.query('SELECT id FROM companies WHERE id=$1 AND owner_id=$2', [companyId, userId]);
  if (!rows.length) { res.status(403).json({ error: 'Not authorized for this company' }); return false; }
  return true;
}

async function nextInvoiceNo(companyId, docType) {
  const { rows } = await pool.query(
    'SELECT COUNT(*) FROM invoices WHERE company_id=$1 AND doc_type=$2', [companyId, docType]
  );
  const n = Number(rows[0].count) + 1;
  const prefix = { gst_invoice: 'INV', proforma: 'PRO', quotation: 'QUO', estimate: 'EST', purchase: 'PUR' }[docType] || 'DOC';
  const year = new Date().getFullYear();
  return `${prefix}/${year}/${String(n).padStart(4, '0')}`;
}


router.get('/', async (req, res) => {
  const { company_id, doc_type } = req.query;
  if (!company_id) return res.status(400).json({ error: 'company_id is required' });
  if (!(await assertOwnership(company_id, req.user.id, res))) return;

  let sql = `SELECT i.*, l.name AS party_name FROM invoices i JOIN ledgers l ON l.id = i.party_ledger_id WHERE i.company_id=$1`;
  const params = [company_id];
  if (doc_type) { params.push(doc_type); sql += ` AND i.doc_type=$${params.length}`; }
  sql += ' ORDER BY i.invoice_date DESC, i.id DESC';
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});
router.get('/:id', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const inv = await pool.query(
    `SELECT i.*, l.name AS party_name, l.address AS party_address, l.gstin AS party_gstin, l.mobile AS party_mobile
     FROM invoices i JOIN ledgers l ON l.id = i.party_ledger_id WHERE i.id=$1 AND i.company_id=$2`,
    [req.params.id, company_id]
  );
  if (!inv.rows.length) return res.status(404).json({ error: 'Invoice not found' });
  const items = await pool.query(
    `SELECT ii.*, si.name AS stock_item_name FROM invoice_items ii
     LEFT JOIN stock_items si ON si.id = ii.stock_item_id WHERE ii.invoice_id=$1`, [req.params.id]
  );
  const company = await pool.query('SELECT * FROM companies WHERE id=$1', [company_id]);
  res.json({ ...inv.rows[0], items: items.rows, company: company.rows[0] });
});


router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { company_id, doc_type, invoice_date, party_ledger_id, items } = req.body;
    if (!company_id || !doc_type || !party_ledger_id || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'company_id, doc_type, party_ledger_id and items[] are required' });
    }
    if (!(await assertOwnership(company_id, req.user.id, res))) return;
    if (!['gst_invoice', 'proforma', 'quotation', 'estimate', 'purchase'].includes(doc_type)) {
      return res.status(400).json({ error: 'Invalid doc_type' });
    }

    let subtotal = 0, gstAmount = 0;
    const computed = items.map((it) => {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      const gstPct = Number(it.gst_percent) || 0;
      const lineBase = qty * rate;
      const lineGst = lineBase * (gstPct / 100);
      subtotal += lineBase;
      gstAmount += lineGst;
      return { ...it, qty, rate, gstPct, amount: lineBase + lineGst };
    });
    const total = subtotal + gstAmount;

    await client.query('BEGIN');
    const voucherNo = await nextInvoiceNo(company_id, doc_type);
    const { rows: invRows } = await client.query(
      `INSERT INTO invoices (company_id,doc_type,invoice_no,invoice_date,party_ledger_id,subtotal,gst_amount,total)
       VALUES ($1,$2,$3,COALESCE($4,CURRENT_DATE),$5,$6,$7,$8) RETURNING *`,
      [company_id, doc_type, voucherNo, invoice_date, party_ledger_id, subtotal, gstAmount, total]
    );
    const invoice = invRows[0];

    for (const it of computed) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id,stock_item_id,description,quantity,rate,gst_percent,amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [invoice.id, it.stock_item_id || null, it.description || null, it.qty, it.rate, it.gstPct, it.amount]
      );
      
      if (it.stock_item_id && doc_type === 'gst_invoice') {
        await client.query('UPDATE stock_items SET quantity = quantity - $1 WHERE id=$2', [it.qty, it.stock_item_id]);
        await client.query(
          `INSERT INTO stock_movements (company_id,stock_item_id,movement_type,quantity,reference)
           VALUES ($1,$2,'out',$3,$4)`, [company_id, it.stock_item_id, it.qty, voucherNo]
        );
      }
      if (it.stock_item_id && doc_type === 'purchase') {
        await client.query('UPDATE stock_items SET quantity = quantity + $1 WHERE id=$2', [it.qty, it.stock_item_id]);
        await client.query(
          `INSERT INTO stock_movements (company_id,stock_item_id,movement_type,quantity,reference)
           VALUES ($1,$2,'in',$3,$4)`, [company_id, it.stock_item_id, it.qty, voucherNo]
        );
      }
    }

  
    if (doc_type === 'gst_invoice') {
      const salesLedgerId = await getOrCreateLedger(company_id, 'Sales Account', 'Sales Accounts', 'Income', 'income');
      const gstLedgerId = gstAmount > 0
        ? await getOrCreateLedger(company_id, 'GST Output (Duties & Taxes)', 'Duties & Taxes', 'Liabilities', 'general')
        : null;
      const { rows: vRows } = await client.query(
        `INSERT INTO vouchers (company_id,voucher_type,voucher_no,voucher_date,narration,total_amount)
         VALUES ($1,'journal',$2,COALESCE($3,CURRENT_DATE),$4,$5) RETURNING id`,
        [company_id, `JV-${voucherNo}`, invoice_date, `Sales invoice ${voucherNo}`, total]
      );
      const journalId = vRows[0].id;
      await client.query(`INSERT INTO voucher_entries (voucher_id,ledger_id,entry_type,amount) VALUES ($1,$2,'Dr',$3)`, [journalId, party_ledger_id, total]);
      await client.query(`INSERT INTO voucher_entries (voucher_id,ledger_id,entry_type,amount) VALUES ($1,$2,'Cr',$3)`, [journalId, salesLedgerId, subtotal]);
      if (gstLedgerId) await client.query(`INSERT INTO voucher_entries (voucher_id,ledger_id,entry_type,amount) VALUES ($1,$2,'Cr',$3)`, [journalId, gstLedgerId, gstAmount]);
    } else if (doc_type === 'purchase') {
      const purchaseLedgerId = await getOrCreateLedger(company_id, 'Purchase Account', 'Purchase Accounts', 'Expenses', 'general');
      const gstLedgerId = gstAmount > 0
        ? await getOrCreateLedger(company_id, 'GST Input Credit (Duties & Taxes)', 'Duties & Taxes', 'Liabilities', 'general')
        : null;
      const { rows: vRows } = await client.query(
        `INSERT INTO vouchers (company_id,voucher_type,voucher_no,voucher_date,narration,total_amount)
         VALUES ($1,'journal',$2,COALESCE($3,CURRENT_DATE),$4,$5) RETURNING id`,
        [company_id, `JV-${voucherNo}`, invoice_date, `Purchase bill ${voucherNo}`, total]
      );
      const journalId = vRows[0].id;
      await client.query(`INSERT INTO voucher_entries (voucher_id,ledger_id,entry_type,amount) VALUES ($1,$2,'Dr',$3)`, [journalId, purchaseLedgerId, subtotal]);
      if (gstLedgerId) await client.query(`INSERT INTO voucher_entries (voucher_id,ledger_id,entry_type,amount) VALUES ($1,$2,'Dr',$3)`, [journalId, gstLedgerId, gstAmount]);
      await client.query(`INSERT INTO voucher_entries (voucher_id,ledger_id,entry_type,amount) VALUES ($1,$2,'Cr',$3)`, [journalId, party_ledger_id, total]);
    }
    
    await client.query('COMMIT');
    res.status(201).json(invoice);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


router.get('/:id/pdf', async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!(await assertOwnership(company_id, req.user.id, res))) return;
    const inv = await pool.query(
      `SELECT i.*, l.name AS party_name, l.address AS party_address, l.gstin AS party_gstin, l.mobile AS party_mobile
       FROM invoices i JOIN ledgers l ON l.id = i.party_ledger_id WHERE i.id=$1 AND i.company_id=$2`,
      [req.params.id, company_id]
    );
    if (!inv.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const items = await pool.query(
      `SELECT ii.*, si.name AS stock_item_name FROM invoice_items ii
       LEFT JOIN stock_items si ON si.id = ii.stock_item_id WHERE ii.invoice_id=$1`, [req.params.id]
    );
    const company = await pool.query('SELECT * FROM companies WHERE id=$1', [company_id]);
    renderInvoicePdf(res, { ...inv.rows[0], items: items.rows, company: company.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  const { company_id } = req.query;
  const { status } = req.body;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  if (!['unpaid', 'paid', 'partially_paid'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const { rows } = await pool.query('UPDATE invoices SET status=$1 WHERE id=$2 AND company_id=$3 RETURNING *', [status, req.params.id, company_id]);
  if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  await pool.query('DELETE FROM invoices WHERE id=$1 AND company_id=$2', [req.params.id, company_id]);
  res.json({ success: true });
});

module.exports = router;
