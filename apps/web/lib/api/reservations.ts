import apiClient from './client';

export const reservationsApi = {
  getAll: (params?: Record<string, unknown>) =>
    apiClient.get('/reservations', { params }),

  getById: (id: string) =>
    apiClient.get(`/reservations/${id}`),

  create: (data: unknown) =>
    apiClient.post('/reservations', data),

  confirm: (id: string) =>
    apiClient.post(`/reservations/${id}/confirm`),

  activate: (id: string, startMileage?: number) =>
    apiClient.post(`/reservations/${id}/activate`, { startMileage }),

  complete: (id: string, data: unknown) =>
    apiClient.post(`/reservations/${id}/complete`, data),

  cancel: (id: string, reason?: string) =>
    apiClient.post(`/reservations/${id}/cancel`, { reason }),

  getStats: () =>
    apiClient.get('/reservations/stats'),

  update: (id: string, data: unknown) =>
    apiClient.patch(`/reservations/${id}`, data),

  remove: (id: string) =>
    apiClient.delete(`/reservations/${id}`),
};
