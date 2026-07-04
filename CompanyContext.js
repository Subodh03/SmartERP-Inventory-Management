'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const [company, setCompanyState] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('smarterp_company');
    if (stored) setCompanyState(JSON.parse(stored));
    setReady(true);
  }, []);

  function setCompany(c) {
    if (c) localStorage.setItem('smarterp_company', JSON.stringify(c));
    else localStorage.removeItem('smarterp_company');
    setCompanyState(c);
  }

  return (
    <CompanyContext.Provider value={{ company, setCompany, ready }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
