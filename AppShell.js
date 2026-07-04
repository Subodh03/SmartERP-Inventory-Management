'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import FunctionKeyBar from './FunctionKeyBar';
import CommandPalette from './CommandPalette';
import Calculator from './Calculator';
import AuthGuard from './AuthGuard';
import RequireCompany from './RequireCompany';
import { useAuth } from '../context/AuthContext';

export default function AppShell({ children }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  const handleAction = useCallback((key) => {
    switch (key) {
      case 'F1': router.push('/companies'); break;
      case 'F2': router.push('/companies'); break; // Alter screen includes Financial Year
      case 'F3': router.push('/company-info'); break;
      case 'F4': setCalcOpen(true); break;
      case 'F5': router.refresh(); break;
      case 'Esc': router.back(); break;
      case '^Q': logout(); break;
      case '^H': router.push('/dashboard'); break;
      case '^K': setPaletteOpen(true); break;
      default: break;
    }
  }, [router, logout]);

  useEffect(() => {
    function onKeyDown(e) {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select';

      if (e.key === 'F1') { e.preventDefault(); handleAction('F1'); }
      else if (e.key === 'F2') { e.preventDefault(); handleAction('F2'); }
      else if (e.key === 'F3') { e.preventDefault(); handleAction('F3'); }
      else if (e.key === 'F4') { e.preventDefault(); handleAction('F4'); }
      else if (e.key === 'F5') { e.preventDefault(); handleAction('F5'); }
      else if (e.key === 'Escape' && !typing) { handleAction('Esc'); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'q') { e.preventDefault(); handleAction('^Q'); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'h') { e.preventDefault(); handleAction('^H'); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); handleAction('^K'); }
      else if (e.altKey && e.key.toLowerCase() === 'l') { e.preventDefault(); router.push('/masters/ledgers?action=new'); }
      else if (e.altKey && e.key.toLowerCase() === 'a') { e.preventDefault(); router.push('/masters/ledgers'); }
      else if (e.altKey && e.key.toLowerCase() === 'g') { e.preventDefault(); router.push('/masters/groups?action=new'); }
      else if (e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); router.push('/masters/stock-items?action=new'); }
      else if (e.altKey && e.key.toLowerCase() === 'u') { e.preventDefault(); router.push('/masters/units?action=new'); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAction, router]);

  return (
    <AuthGuard>
      <RequireCompany>
        <div className="flex min-h-screen bg-navy text-ink font-body">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Topbar />
            <main className="flex-1 p-6 pb-16">{children}</main>
          </div>
          <FunctionKeyBar onAction={handleAction} />
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
          <Calculator open={calcOpen} onClose={() => setCalcOpen(false)} />
        </div>
      </RequireCompany>
    </AuthGuard>
  );
}
