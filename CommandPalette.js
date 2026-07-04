'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const ROUTES = [
  { name: 'Dashboard / Gateway of SmartERP', href: '/dashboard' },
  { name: 'Create Ledger', href: '/masters/ledgers?action=new' },
  { name: 'Create Group', href: '/masters/groups?action=new' },
  { name: 'Create Stock Item', href: '/masters/stock-items?action=new' },
  { name: 'Unit Creation', href: '/masters/units?action=new' },
  { name: 'Contra Voucher', href: '/vouchers/contra' },
  { name: 'Payment Voucher', href: '/vouchers/payment' },
  { name: 'Receipt Voucher', href: '/vouchers/receipt' },
  { name: 'New GST Invoice', href: '/billing/invoices/new' },
  { name: 'All Invoices', href: '/billing/invoices' },
  { name: 'Customers', href: '/customers' },
  { name: 'Suppliers', href: '/suppliers' },
  { name: 'Trial Balance', href: '/reports/trial-balance' },
  { name: 'Profit & Loss', href: '/reports/profit-loss' },
  { name: 'Balance Sheet', href: '/reports/balance-sheet' },
  { name: 'Stock Summary', href: '/reports/stock-summary' },
  { name: 'Low Stock Report', href: '/reports/low-stock' },
  { name: 'Sales Report', href: '/reports/sales' },
  { name: 'Purchase Register', href: '/reports/purchase-register' },
  { name: 'Company Selection', href: '/companies' },
  { name: 'Company Information', href: '/company-info' },
];

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;

  const filtered = ROUTES.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));

  function go(href) {
    router.push(href);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-28" onClick={onClose}>
      <div className="panel w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered[0]) go(filtered[0].href);
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Search command or menu… (Ctrl+K)"
          className="w-full input-field rounded-b-none border-b border-navy-lighter text-base"
        />
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 && <p className="px-4 py-3 text-sm text-ink-muted">No matches.</p>}
          {filtered.map((r) => (
            <button
              key={r.name}
              onClick={() => go(r.href)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-navy-lighter text-ink"
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
