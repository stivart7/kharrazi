import apiClient from './client';

export const planRequestsApi = {
  /** Agency: send an upgrade request */
  create: (requestedPlan: 'pro' | 'enterprise', message?: string) =>
    apiClient.post('/plan-requests', { requestedPlan, message }),

  /** Agency: get own latest request */
  getMy: () =>
    apiClient.get('/plan-requests/my'),

  /** Super admin: get all requests */
  getAll: () =>
    apiClient.get('/plan-requests'),

  /** Super admin: pending count */
  getPendingCount: () =>
    apiClient.get('/plan-requests/pending-count'),

  /** Super admin: approve */
  approve: (id: string) =>
    apiClient.patch(`/plan-requests/${id}/approve`),

  /** Super admin: reject */
  reject: (id: string) =>
    apiClient.patch(`/plan-requests/${id}/reject`),
};
