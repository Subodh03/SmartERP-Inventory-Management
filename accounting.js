const pool = require('../db/pool');

// Finds an existing ledger by name within a company, or creates it under the given group
// (creating the group too if needed). Used to auto-post Sales/Purchase/GST control ledgers.
async function getOrCreateLedger(companyId, ledgerName, groupName, nature, ledgerType = 'general') {
  const existing = await pool.query('SELECT id FROM ledgers WHERE company_id=$1 AND name=$2', [companyId, ledgerName]);
  if (existing.rows.length) return existing.rows[0].id;

  let group = await pool.query('SELECT id FROM groups WHERE company_id=$1 AND name=$2', [companyId, groupName]);
  let groupId;
  if (group.rows.length) {
    groupId = group.rows[0].id;
  } else {
    const created = await pool.query(
      'INSERT INTO groups (company_id,name,nature,is_system) VALUES ($1,$2,$3,true) RETURNING id', [companyId, groupName, nature]
    );
    groupId = created.rows[0].id;
  }
  const balanceType = nature === 'Income' || nature === 'Liabilities' ? 'Cr' : 'Dr';
  const ledger = await pool.query(
    `INSERT INTO ledgers (company_id,group_id,name,ledger_type,opening_balance,balance_type)
     VALUES ($1,$2,$3,$4,0,$5) RETURNING id`,
    [companyId, groupId, ledgerName, ledgerType, balanceType]
  );
  return ledger.rows[0].id;
}

// Returns the net balance of a ledger in "Dr-positive" convention:
// positive => the ledger carries a debit balance (e.g. a customer who owes money)
// negative => the ledger carries a credit balance (e.g. a supplier we owe money to)
async function ledgerBalance(ledgerId) {
  const { rows } = await pool.query(
    `SELECT
       l.opening_balance, l.balance_type,
       COALESCE((SELECT SUM(amount) FROM voucher_entries WHERE ledger_id=l.id AND entry_type='Dr'),0) AS dr_vouchers,
       COALESCE((SELECT SUM(amount) FROM voucher_entries WHERE ledger_id=l.id AND entry_type='Cr'),0) AS cr_vouchers
     FROM ledgers l WHERE l.id=$1`,
    [ledgerId]
  );
  if (!rows.length) return 0;
  const r = rows[0];
  const opening = r.balance_type === 'Dr' ? Number(r.opening_balance) : -Number(r.opening_balance);
  return opening + Number(r.dr_vouchers) - Number(r.cr_vouchers);
}

// Batch version for many ledgers at once (used in Trial Balance / reports to avoid N+1 queries)
async function allLedgerBalances(companyId) {
  const { rows } = await pool.query(
    `SELECT
       l.id, l.name, l.ledger_type, l.opening_balance, l.balance_type, g.name AS group_name, g.nature,
       COALESCE((SELECT SUM(amount) FROM voucher_entries WHERE ledger_id=l.id AND entry_type='Dr'),0) AS dr_vouchers,
       COALESCE((SELECT SUM(amount) FROM voucher_entries WHERE ledger_id=l.id AND entry_type='Cr'),0) AS cr_vouchers
     FROM ledgers l JOIN groups g ON g.id = l.group_id
     WHERE l.company_id=$1 ORDER BY l.name`,
    [companyId]
  );
  return rows.map((r) => {
    const opening = r.balance_type === 'Dr' ? Number(r.opening_balance) : -Number(r.opening_balance);
    const net = opening + Number(r.dr_vouchers) - Number(r.cr_vouchers);
    return {
      id: r.id, name: r.name, ledger_type: r.ledger_type, group_name: r.group_name, nature: r.nature,
      net, debit: net >= 0 ? net : 0, credit: net < 0 ? -net : 0,
    };
  });
}

module.exports = { ledgerBalance, allLedgerBalances, getOrCreateLedger };
