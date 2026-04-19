import apiClient from './client';

export const carsApi = {
  getAll: (params?: Record<string, unknown>) =>
    apiClient.get('/cars', { params }),

  getById: (id: string) =>
    apiClient.get(`/cars/${id}`),

  create: (data: unknown) =>
    apiClient.post('/cars', data),

  update: (id: string, data: unknown) =>
    apiClient.patch(`/cars/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/cars/${id}`),

  checkAvailability: (id: string, startDate: string, endDate: string, excludeId?: string) =>
    apiClient.get(`/cars/${id}/availability`, {
      params: { startDate, endDate, excludeReservationId: excludeId },
    }),

  getStats: () =>
    apiClient.get('/cars/stats'),
};
