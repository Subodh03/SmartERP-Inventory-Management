'use client';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('smarterp_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (typeof window !== 'undefined' && err?.response?.status === 401) {
      localStorage.removeItem('smarterp_token');
      localStorage.removeItem('smarterp_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
export { API_URL };
