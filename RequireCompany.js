'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '../context/CompanyContext';

export default function RequireCompany({ children }) {
  const { company, ready } = useCompany();
  const router = useRouter();

  useEffect(() => {
    if (ready && !company) router.replace('/companies');
  }, [ready, company, router]);

  if (!ready) return <div className="min-h-screen flex items-center justify-center text-ink-muted">Loading…</div>;
  if (!company) return null;
  return children;
}
