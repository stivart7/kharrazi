'use client';

import { useState } from 'react';
import { downloadPdf } from '@/lib/pdf';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { formatDate, formatMAD } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, CreditCard, Clock, Trash2, Download, Printer } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth.store';

const paymentsApi = {
  getAll: (p: any) => apiClient.get('/payments', { params: p }),
  getSummary: (period: string) => apiClient.get('/payments/summary', { params: { period } }),
  remove: (id: string) => apiClient.delete(`/payments/${id}`),
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Caution',
  RENTAL: 'Location',
  EXTRA: 'Supplément',
  REFUND: 'Remboursement',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  CARD: 'Carte',
  BANK_TRANSFER: 'Virement',
  CHEQUE: 'Chèque',
};

export function PaymentsContent() {
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [downloading, setDownloading] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canDelete = user?.role === 'AGENCY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['payments', { page }],
    queryFn: () => paymentsApi.getAll({ page }).then((r) => r.data),
  });

  const { data: summary } = useQuery({
    queryKey: ['payments-summary', period],
    queryFn: () => paymentsApi.getSummary(period).then((r) => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.remove(id),
    onSuccess: () => {
      toast({ title: 'Paiement supprimé' });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['payments-summary'] });
    },
    onError: (err: any) => toast({ title: 'Erreur', description: err.response?.data?.message, variant: 'destructive' }),
  });

  const payments = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Paiements</h1>
          <p className="text-muted-foreground">Suivi financier de votre agence</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Année'}
            </button>
          ))}
          </div>
          {payments.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" />Imprimer
              </Button>
              <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50"
                disabled={downloading}
                onClick={async () => {
                  setDownloading(true);
                  try {
                    await downloadPdf('payments-pdf-table', `Paiements-${new Date().toLocaleDateString('fr-MA').replace(/\//g,'-')}.pdf`);
                  } finally {
                    setDownloading(false);
                  }
                }}>
                {downloading
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Download className="w-4 h-4 mr-2" />}
                {downloading ? 'Génération…' : 'Télécharger PDF'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenu total</p>
              <p className="text-2xl font-bold">{formatMAD(summary?.totalRevenue ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Locations perçues</p>
              <p className="text-2xl font-bold">{formatMAD(summary?.byType?.RENTAL?.total ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En attente</p>
              <p className="text-2xl font-bold">{formatMAD(summary?.pendingAmount ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card id="payments-pdf-table">
          <CardHeader>
            <CardTitle>Historique des paiements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Réservation</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Client</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Méthode</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Statut</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Montant</th>
                    {canDelete && <th className="p-4" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={canDelete ? 8 : 7} className="py-16 text-center text-muted-foreground">
                        Aucun paiement trouvé
                      </td>
                    </tr>
                  ) : payments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-mono text-xs">{p.reservation?.reservationNumber}</td>
                      <td className="p-4">
                        {p.reservation?.client?.firstName} {p.reservation?.client?.lastName}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.type === 'REFUND' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {PAYMENT_TYPE_LABELS[p.type] ?? p.type}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {p.paidAt ? formatDate(p.paidAt) : '—'}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === 'PAID' ? 'bg-green-100 text-green-800'
                          : p.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800'
                          : p.status === 'REFUNDED' ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                        }`}>
                          {p.status === 'PAID' ? 'Payé' : p.status === 'PENDING' ? 'En attente' : p.status === 'REFUNDED' ? 'Remboursé' : p.status}
                        </span>
                      </td>
                      <td className={`p-4 text-right font-bold ${p.type === 'REFUND' ? 'text-red-600' : 'text-green-600'}`}>
                        {p.type === 'REFUND' ? '-' : '+'}{formatMAD(p.amount)}
                      </td>
                      {canDelete && (
                        <td className="p-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (confirm('Supprimer ce paiement ?')) deleteMutation.mutate(p.id);
                            }}
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {meta.total} paiement(s) · Page {meta.page}/{meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <Button variant="outline" size="sm" disabled={page === meta.totalPages} onClick={() => setPage((p) => p + 1)}>
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

