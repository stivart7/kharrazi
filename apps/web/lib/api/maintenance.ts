import apiClient from './client';

export const maintenanceApi = {
  getAll: (params?: Record<string, any>) =>
    apiClient.get('/maintenance', { params }),
  getById: (id: string) =>
    apiClient.get(`/maintenance/${id}`),
  create: (data: Record<string, any>) =>
    apiClient.post('/maintenance', data),
  update: (id: string, data: Record<string, any>) =>
    apiClient.patch(`/maintenance/${id}`, data),
  delete: (id: string) =>
    apiClient.delete(`/maintenance/${id}`),
};
