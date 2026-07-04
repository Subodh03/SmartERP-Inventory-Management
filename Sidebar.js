'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
  {
    label: 'Masters',
    items: [
      { name: 'Groups', href: '/masters/groups' },
      { name: 'Ledgers', href: '/masters/ledgers' },
      { name: 'Units of Measure', href: '/masters/units' },
      { name: 'Stock Items', href: '/masters/stock-items' },
    ],
  },
  {
    label: 'Accounting / Transactions',
    items: [
      { name: 'Contra Voucher', href: '/vouchers/contra' },
      { name: 'Payment Voucher', href: '/vouchers/payment' },
      { name: 'Receipt Voucher', href: '/vouchers/receipt' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { name: 'New Invoice / Bill', href: '/billing/invoices/new' },
      { name: 'All Invoices', href: '/billing/invoices' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { name: 'Stock Items', href: '/masters/stock-items' },
      { name: 'Stock Summary', href: '/reports/stock-summary' },
      { name: 'Low Stock', href: '/reports/low-stock' },
    ],
  },
  {
    label: 'Customers & Suppliers',
    items: [
      { name: 'Customers', href: '/customers' },
      { name: 'Suppliers', href: '/suppliers' },
    ],
  },
  {
    label: 'Banking',
    items: [
      { name: 'Bank Ledgers', href: '/masters/ledgers?type=bank' },
      { name: 'Contra (Cash ⇄ Bank)', href: '/vouchers/contra' },
    ],
  },
  {
    label: 'Purchases',
    items: [
      { name: 'New Purchase Bill', href: '/purchases/new' },
      { name: 'Purchase Register', href: '/reports/purchase-register' },
    ],
  },
  {
    label: 'GST',
    items: [
      { name: 'Sales (GST Invoices)', href: '/billing/invoices?doc_type=gst_invoice' },
      { name: 'Purchases', href: '/reports/purchase-register' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { name: 'Trial Balance', href: '/reports/trial-balance' },
      { name: 'Profit & Loss', href: '/reports/profit-loss' },
      { name: 'Balance Sheet', href: '/reports/balance-sheet' },
      { name: 'Sales Report', href: '/reports/sales' },
      { name: 'Purchase Register', href: '/reports/purchase-register' },
    ],
  },
  {
    label: 'Utilities',
    items: [
      { name: 'Payroll (coming soon)', href: '#', disabled: true },
      { name: 'GST Returns (coming soon)', href: '#', disabled: true },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 bg-navy-light border-r border-navy-lighter h-screen overflow-y-auto sticky top-0 shrink-0">
      <div className="px-5 py-5 border-b border-navy-lighter">
        <Link href="/dashboard" className="font-display text-lg font-700 text-amber tracking-tight">
          SmartERP
        </Link>
        <p className="text-[11px] text-ink-muted mt-0.5">Gateway of SmartERP</p>
      </div>
      <nav className="py-3">
        {SECTIONS.map((section) => (
          <div key={section.label} className="mb-3">
            <p className="px-5 text-[10px] uppercase tracking-wider text-ink-muted font-mono mb-1">{section.label}</p>
            {section.items.map((item) => {
              const active = pathname === item.href.split('?')[0];
              if (item.disabled) {
                return (
                  <span key={item.name} className="block px-5 py-1.5 text-sm text-ink-muted/50 cursor-not-allowed">
                    {item.name}
                  </span>
                );
              }
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block px-5 py-1.5 text-sm transition-colors ${
                    active ? 'text-amber bg-navy border-r-2 border-amber' : 'text-ink hover:text-amber'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
