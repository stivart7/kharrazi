import apiClient from './client';

export interface LoginDto { email: string; password: string; }

export const authApi = {
  login: (dto: LoginDto) => apiClient.post('/auth/login', dto),
  logout: () => apiClient.post('/auth/logout', {}),
  refresh: () => apiClient.post('/auth/refresh', {}),
  me: () => apiClient.get('/auth/me'),
  getPlan: () => apiClient.get('/auth/plan'),
  changePassword: (dto: { currentPassword: string; newPassword: string }) =>
    apiClient.put('/auth/change-password', dto),
};
