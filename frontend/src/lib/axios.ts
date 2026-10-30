import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const match = document.cookie.match(/(^|;)\s*csrf_token=([^;]+)/);
  if (match) {
    config.headers['X-CSRF-Token'] = match[2];
  }
  return config;
});
