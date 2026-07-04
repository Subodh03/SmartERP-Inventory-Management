'use client';
import { useEffect, useState } from 'react';
import AppShell from './AppShell';
import PageHeader from './PageHeader';
import DataTable from './DataTable';
import { useCompany } from '../context/CompanyContext';
import api from '../lib/api';

export default function VoucherPage({ voucherType, title, subtitle, debitLabel, creditLabel }) {
  const { company } = useCompany();
  const [ledgers, setLedgers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ debit_ledger_id: '', credit_ledger_id: '', amount: '', narration: '', voucher_date: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    if (!company) return;
    setLoading(true);
    const [l, v] = await Promise.all([
      api.get(`/masters/ledgers?company_id=${company.id}`),
      api.get(`/vouchers?company_id=${company.id}&voucher_type=${voucherType}`),
    ]);
    setLedgers(l.data);
    setVouchers(v.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [company, voucherType]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const { data } = await api.post('/vouchers', { ...form, voucher_type: voucherType, company_id: company.id });
      setSuccess(`Saved as ${data.voucher_no}`);
      setForm({ debit_ledger_id: '', credit_ledger_id: '', amount: '', narration: '', voucher_date: '' });
      load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not save voucher.');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this voucher?')) return;
    await api.delete(`/vouchers/${id}?company_id=${company.id}`);
    load();
  }

  return (
    <AppShell>
      <PageHeader title={title} subtitle={subtitle} />

      <form onSubmit={handleSubmit} className="panel p-5 mb-6 space-y-3 max-w-xl">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-ink-muted mb-1">{debitLabel} (Dr) *</label>
            <select required value={form.debit_ledger_id} onChange={(e) => setForm({ ...form, debit_ledger_id: e.target.value })} className="input-field w-full">
              <option value="">Select ledger</option>
              {ledgers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">{creditLabel} (Cr) *</label>
            <select required value={form.credit_ledger_id} onChange={(e) => setForm({ ...form, credit_ledger_id: e.target.value })} className="input-field w-full">
              <option value="">Select ledger</option>
              {ledgers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Amount *</label>
            <input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Date</label>
            <input type="date" value={form.voucher_date} onChange={(e) => setForm({ ...form, voucher_date: e.target.value })} className="input-field w-full" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-ink-muted mb-1">Narration</label>
            <input value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} className="input-field w-full" />
          </div>
        </div>
        {error && <p className="text-bad text-sm">{error}</p>}
        {success && <p className="text-ok text-sm">{success}</p>}
        <button type="submit" className="btn-primary">Save Voucher</button>
      </form>

      {loading ? <p className="text-ink-muted">Loading…</p> : (
        <DataTable
          columns={[
            { key: 'voucher_no', header: 'Voucher No' },
            { key: 'voucher_date', header: 'Date', render: (r) => new Date(r.voucher_date).toLocaleDateString('en-IN') },
            { key: 'narration', header: 'Narration' },
            { key: 'total_amount', header: 'Amount', numeric: true, render: (r) => Number(r.total_amount).toFixed(2) },
            { key: 'actions', header: '', render: (r) => (
              <button onClick={() => handleDelete(r.id)} className="text-bad text-xs hover:underline">Delete</button>
            ) },
          ]}
          rows={vouchers}
          emptyText="No vouchers recorded yet."
        />
      )}
    </AppShell>
  );
}
