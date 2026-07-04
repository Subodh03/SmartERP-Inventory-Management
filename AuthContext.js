'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('smarterp_user');
    if (stored) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('smarterp_token', data.token);
    localStorage.setItem('smarterp_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  async function register(name, email, password) {
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('smarterp_token', data.token);
    localStorage.setItem('smarterp_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('smarterp_token');
    localStorage.removeItem('smarterp_user');
    localStorage.removeItem('smarterp_company');
    setUser(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
