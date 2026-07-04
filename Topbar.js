'use client';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';

function fyLabel(company) {
  if (!company?.fy_start || !company?.fy_end) return '';
  const start = new Date(company.fy_start).getFullYear();
  const end = new Date(company.fy_end).getFullYear();
  return `FY ${start}-${String(end).slice(-2)}`;
}

export default function Topbar() {
  const { user } = useAuth();
  const { company } = useCompany();

  return (
    <header className="h-14 border-b border-navy-lighter flex items-center justify-between px-6 bg-navy/80 backdrop-blur sticky top-0 z-30">
      <div>
        <p className="text-sm font-semibold text-ink">{company?.name || 'No company selected'}</p>
        {company && <p className="text-[11px] text-ink-muted font-mono">{fyLabel(company)} · {company.state}</p>}
      </div>
      <div className="text-right">
        <p className="text-sm text-ink">{user?.name}</p>
        <p className="text-[11px] text-ink-muted">{user?.email}</p>
      </div>
    </header>
  );
}
