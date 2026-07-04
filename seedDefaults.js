const pool = require('../db/pool');

const DEFAULT_GROUPS = [
  { name: 'Fixed Assets', nature: 'Assets' },
  { name: 'Current Assets', nature: 'Assets' },
  { name: 'Bank Accounts', nature: 'Assets' },
  { name: 'Cash-in-Hand', nature: 'Assets' },
  { name: 'Sundry Debtors', nature: 'Assets' },
  { name: 'Stock-in-Hand', nature: 'Assets' },
  { name: 'Loans (Liability)', nature: 'Liabilities' },
  { name: 'Sundry Creditors', nature: 'Liabilities' },
  { name: 'Duties & Taxes', nature: 'Liabilities' },
  { name: "Capital Account", nature: 'Liabilities' },
  { name: 'Sales Accounts', nature: 'Income' },
  { name: 'Direct Income', nature: 'Income' },
  { name: 'Purchase Accounts', nature: 'Expenses' },
  { name: 'Direct Expenses', nature: 'Expenses' },
  { name: 'Indirect Expenses', nature: 'Expenses' },
];

async function seedCompanyDefaults(companyId) {
  const groupIds = {};
  for (const g of DEFAULT_GROUPS) {
    const { rows } = await pool.query(
      `INSERT INTO groups (company_id, name, nature, is_system) VALUES ($1,$2,$3,true)
       ON CONFLICT (company_id, name) DO UPDATE SET nature = EXCLUDED.nature
       RETURNING id, name`,
      [companyId, g.name, g.nature]
    );
    groupIds[g.name] = rows[0].id;
  }


  await pool.query(
    `INSERT INTO ledgers (company_id, group_id, name, ledger_type, opening_balance, balance_type)
     VALUES ($1,$2,'Cash','cash',0,'Dr')
     ON CONFLICT (company_id, name) DO NOTHING`,
    [companyId, groupIds['Cash-in-Hand']]
  );

  
  const defaultUnits = [['PCS', 'Pieces'], ['KG', 'Kilograms'], ['BOX', 'Box'], ['LTR', 'Litres']];
  for (const [symbol, name] of defaultUnits) {
    await pool.query(
      `INSERT INTO units (company_id, symbol, name) VALUES ($1,$2,$3)
       ON CONFLICT (company_id, symbol) DO NOTHING`,
      [companyId, symbol, name]
    );
  }

  return groupIds;
}

module.exports = { seedCompanyDefaults, DEFAULT_GROUPS };
