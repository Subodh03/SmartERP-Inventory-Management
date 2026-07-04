const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { allLedgerBalances } = require('../utils/accounting');
const { streamExcel } = require('../utils/excelExporter');

const router = express.Router();
router.use(requireAuth);

async function assertOwnership(companyId, userId, res) {
  const { rows } = await pool.query('SELECT id FROM companies WHERE id=$1 AND owner_id=$2', [companyId, userId]);
  if (!rows.length) { res.status(403).json({ error: 'Not authorized for this company' }); return false; }
  return true;
}

/* =================== FINANCIAL REPORTS =================== */

// Trial Balance: every ledger with its Dr/Cr closing balance
router.get('/trial-balance', async (req, res) => {
  const { company_id, format } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const balances = await allLedgerBalances(company_id);
  const totalDebit = balances.reduce((s, b) => s + b.debit, 0);
  const totalCredit = balances.reduce((s, b) => s + b.credit, 0);

  if (format === 'excel') {
    return streamExcel(res, 'trial-balance.xlsx', 'Trial Balance',
      [{ header: 'Ledger', key: 'name', width: 30 }, { header: 'Group', key: 'group_name', width: 22 },
       { header: 'Debit', key: 'debit', width: 16 }, { header: 'Credit', key: 'credit', width: 16 }],
      balances.map((b) => ({ name: b.name, group_name: b.group_name, debit: b.debit.toFixed(2), credit: b.credit.toFixed(2) })));
  }
  res.json({ ledgers: balances, total_debit: totalDebit, total_credit: totalCredit });
});

// Profit & Loss: Income vs Expenses grouped by nature
router.get('/profit-loss', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const balances = await allLedgerBalances(company_id);
  const income = balances.filter((b) => b.nature === 'Income').map((b) => ({ name: b.name, amount: -b.net }));
  const expenses = balances.filter((b) => b.nature === 'Expenses').map((b) => ({ name: b.name, amount: b.net }));
  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  res.json({ income, expenses, total_income: totalIncome, total_expenses: totalExpenses, net_profit: totalIncome - totalExpenses });
});

// Balance Sheet: Assets vs Liabilities (+ retained profit balancing figure)
router.get('/balance-sheet', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const balances = await allLedgerBalances(company_id);
  const assets = balances.filter((b) => b.nature === 'Assets').map((b) => ({ name: b.name, amount: b.net }));
  const liabilities = balances.filter((b) => b.nature === 'Liabilities').map((b) => ({ name: b.name, amount: -b.net }));
  const income = balances.filter((b) => b.nature === 'Income').reduce((s, b) => s - b.net, 0);
  const expenses = balances.filter((b) => b.nature === 'Expenses').reduce((s, b) => s + b.net, 0);
  const netProfit = income - expenses;
  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
  res.json({
    assets, liabilities, net_profit_current_year: netProfit,
    total_assets: totalAssets, total_liabilities_and_capital: totalLiabilities + netProfit,
  });
});

// Cash Flow Statement (simplified): inflow/outflow through Cash & Bank ledgers, by voucher type
router.get('/cash-flow', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const { rows } = await pool.query(
    `SELECT v.voucher_type, e.entry_type, SUM(e.amount) AS total
     FROM voucher_entries e
     JOIN vouchers v ON v.id = e.voucher_id
     JOIN ledgers l ON l.id = e.ledger_id
     WHERE v.company_id=$1 AND l.ledger_type IN ('cash','bank')
     GROUP BY v.voucher_type, e.entry_type`,
    [company_id]
  );
  const inflow = rows.filter((r) => r.entry_type === 'Dr').reduce((s, r) => s + Number(r.total), 0);
  const outflow = rows.filter((r) => r.entry_type === 'Cr').reduce((s, r) => s + Number(r.total), 0);
  res.json({ breakdown: rows, total_inflow: inflow, total_outflow: outflow, net_cash_flow: inflow - outflow });
});

/* =================== INVENTORY REPORTS =================== */

router.get('/stock-summary', async (req, res) => {
  const { company_id, format } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const { rows } = await pool.query(
    `SELECT si.name, si.sku, u.symbol AS unit, si.quantity, si.reserved_qty, si.damaged_qty,
            (si.quantity - si.reserved_qty) AS available_qty, si.purchase_price, si.selling_price,
            (si.quantity * si.purchase_price) AS stock_value
     FROM stock_items si LEFT JOIN units u ON u.id = si.unit_id
     WHERE si.company_id=$1 ORDER BY si.name`, [company_id]);

  if (format === 'excel') {
    return streamExcel(res, 'stock-summary.xlsx', 'Stock Summary',
      [{ header: 'Item', key: 'name', width: 28 }, { header: 'SKU', key: 'sku', width: 16 },
       { header: 'Unit', key: 'unit', width: 10 }, { header: 'Qty', key: 'quantity', width: 12 },
       { header: 'Available', key: 'available_qty', width: 12 }, { header: 'Damaged', key: 'damaged_qty', width: 12 },
       { header: 'Stock Value', key: 'stock_value', width: 16 }],
      rows);
  }
  res.json(rows);
});

router.get('/low-stock', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const { rows } = await pool.query(
    `SELECT si.name, si.sku, u.symbol AS unit, si.quantity, si.reorder_level
     FROM stock_items si LEFT JOIN units u ON u.id = si.unit_id
     WHERE si.company_id=$1 AND si.quantity <= si.reorder_level ORDER BY si.quantity ASC`, [company_id]);
  res.json(rows);
});

router.get('/item-movement', async (req, res) => {
  const { company_id, stock_item_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  let sql = `SELECT sm.*, si.name AS item_name FROM stock_movements sm
             JOIN stock_items si ON si.id = sm.stock_item_id WHERE sm.company_id=$1`;
  const params = [company_id];
  if (stock_item_id) { params.push(stock_item_id); sql += ` AND sm.stock_item_id=$${params.length}`; }
  sql += ' ORDER BY sm.created_at DESC';
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

/* =================== SALES REPORTS =================== */

router.get('/sales-daily', async (req, res) => {
  const { company_id, date } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const day = date || new Date().toISOString().slice(0, 10);
  const { rows } = await pool.query(
    `SELECT i.invoice_no, i.invoice_date, l.name AS customer, i.subtotal, i.gst_amount, i.total
     FROM invoices i JOIN ledgers l ON l.id = i.party_ledger_id
     WHERE i.company_id=$1 AND i.doc_type='gst_invoice' AND i.invoice_date=$2
     ORDER BY i.id`, [company_id, day]);
  const total = rows.reduce((s, r) => s + Number(r.total), 0);
  res.json({ date: day, invoices: rows, total_sales: total });
});

router.get('/sales-monthly', async (req, res) => {
  const { company_id, year } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const yr = year || new Date().getFullYear();
  const { rows } = await pool.query(
    `SELECT TO_CHAR(invoice_date, 'YYYY-MM') AS month, SUM(total) AS total_sales, COUNT(*) AS invoice_count
     FROM invoices WHERE company_id=$1 AND doc_type='gst_invoice' AND EXTRACT(YEAR FROM invoice_date)=$2
     GROUP BY month ORDER BY month`, [company_id, yr]);
  res.json(rows);
});

router.get('/top-customers', async (req, res) => {
  const { company_id, limit } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const { rows } = await pool.query(
    `SELECT l.name AS customer, SUM(i.total) AS total_purchased, COUNT(*) AS invoice_count
     FROM invoices i JOIN ledgers l ON l.id = i.party_ledger_id
     WHERE i.company_id=$1 AND i.doc_type='gst_invoice'
     GROUP BY l.name ORDER BY total_purchased DESC LIMIT $2`, [company_id, Number(limit) || 10]);
  res.json(rows);
});

/* =================== PURCHASE REPORTS =================== */

router.get('/purchase-register', async (req, res) => {
  const { company_id, format } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const { rows } = await pool.query(
    `SELECT i.invoice_no, i.invoice_date, l.name AS supplier, i.subtotal, i.gst_amount, i.total
     FROM invoices i JOIN ledgers l ON l.id = i.party_ledger_id
     WHERE i.company_id=$1 AND i.doc_type='purchase' ORDER BY i.invoice_date DESC`, [company_id]);

  if (format === 'excel') {
    return streamExcel(res, 'purchase-register.xlsx', 'Purchase Register',
      [{ header: 'Bill No', key: 'invoice_no', width: 18 }, { header: 'Date', key: 'invoice_date', width: 14 },
       { header: 'Supplier', key: 'supplier', width: 26 }, { header: 'Subtotal', key: 'subtotal', width: 14 },
       { header: 'GST', key: 'gst_amount', width: 12 }, { header: 'Total', key: 'total', width: 14 }],
      rows);
  }
  const total = rows.reduce((s, r) => s + Number(r.total), 0);
  res.json({ bills: rows, total_purchases: total });
});

router.get('/supplier-summary', async (req, res) => {
  const { company_id } = req.query;
  if (!(await assertOwnership(company_id, req.user.id, res))) return;
  const { rows } = await pool.query(
    `SELECT l.name AS supplier, SUM(i.total) AS total_purchased, COUNT(*) AS bill_count
     FROM invoices i JOIN ledgers l ON l.id = i.party_ledger_id
     WHERE i.company_id=$1 AND i.doc_type='purchase'
     GROUP BY l.name ORDER BY total_purchased DESC`, [company_id]);
  res.json(rows);
});

module.exports = router;
