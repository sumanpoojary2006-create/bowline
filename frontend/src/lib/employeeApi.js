import axios from 'axios';

const employeeApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

employeeApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('bowline_employee_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default employeeApi;
