import apiClient from './client';

export const analyticsApi = {
  getDashboard: () =>
    apiClient.get('/analytics/dashboard'),

  getRevenueChart: (year?: number) =>
    apiClient.get('/analytics/revenue-chart', { params: { year } }),
};
