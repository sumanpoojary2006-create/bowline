import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bowline_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// An explicitly launched development preview never connects to the real API.
if (import.meta.env.DEV && import.meta.env.VITE_ADMIN_PREVIEW === 'true') {
  const { installAdminPreview } = await import('./adminPreview');
  installAdminPreview(api);
}

export default api;
