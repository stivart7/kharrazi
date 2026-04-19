'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '@/lib/api/reservations';
import { formatDate, formatMAD, RESERVATION_STATUS_CONFIG } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, Calendar, Loader2, CheckCircle, XCircle, Trash2, Pencil } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { ReservationForm } from './reservation-form';
import { ReservationEditForm } from './reservation-edit-form';

// Reservations = upcoming/future only (not yet started)
const STATUS_TABS = [
  { label: 'Toutes',      value: '' },
  { label: 'En attente',  value: 'PENDING' },
  { label: 'Confirmées',  value: 'CONFIRMED' },
  { label: 'Annulées',    value: 'CANCELLED' },
];

export function ReservationsContent() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canDelete = user?.role === 'AGENCY_ADMIN' || user?.role === 'SUPER_ADMIN';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [editReservation, setEditReservation] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', { page, search, status }],
    queryFn: () =>
      reservationsApi.getAll({ page, search: search || undefined, status: status || undefined, isContract: false })
        .then((r) => r.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['reservations-stats'],
    queryFn: () => reservationsApi.getStats().then((r) => r.data.data),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => reservationsApi.confirm(id),
    onSuccess: () => {
      toast({ title: 'Réservation confirmée' });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    onError: (err: any) => toast({ title: 'Erreur', description: err.response?.data?.message, variant: 'destructive' }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => reservationsApi.cancel(id),
    onSuccess: () => {
      toast({ title: 'Réservation annulée' });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    onError: (err: any) => toast({ title: 'Erreur', description: err.response?.data?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reservationsApi.remove(id),
    onSuccess: () => {
      toast({ title: 'Réservation supprimée' });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-stats'] });
    },
    onError: (err: any) => toast({ title: 'Erreur', description: err.response?.data?.message, variant: 'destructive' }),
  });

  const reservations = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Réservations à venir</h1>
          <p className="text-muted-foreground">
            Réservations futures · {statsData?.thisMonth ?? 0} ce mois
          </p>
        </div>
        <ReservationForm />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-full overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatus(tab.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              status === tab.value
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Référence, client, plaque…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Reservations Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Référence</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Client</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Véhicule</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Période</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Statut</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Montant</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reservations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-muted-foreground">
                        <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                        Aucune réservation trouvée
                      </td>
                    </tr>
                  ) : reservations.map((r: any) => {
                    const statusConfig = RESERVATION_STATUS_CONFIG[r.status as keyof typeof RESERVATION_STATUS_CONFIG];
                    return (
                      <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                        <td className="p-4 font-mono text-xs">{r.reservationNumber}</td>
                        <td className="p-4">
                          <p className="font-medium">{r.client.firstName} {r.client.lastName}</p>
                          <p className="text-xs text-muted-foreground">{r.client.cin}</p>
                        </td>
                        <td className="p-4">
                          <p>{r.car.brand} {r.car.model}</p>
                          <p className="text-xs text-muted-foreground font-mono">{r.car.licensePlate}</p>
                        </td>
                        <td className="p-4 text-sm">
                          <p>{formatDate(r.startDate)}</p>
                          <p className="text-muted-foreground">→ {formatDate(r.endDate)}</p>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig?.color}`}>
                            {statusConfig?.label}
                          </span>
                        </td>
                        <td className="p-4 text-right font-medium">{formatMAD(r.totalAmount)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            {/* Modifier */}
                            {!['COMPLETED', 'CANCELLED'].includes(r.status) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                                onClick={() => setEditReservation(r)}
                                title="Modifier"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {/* Confirmer */}
                            {r.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600"
                                onClick={() => confirmMutation.mutate(r.id)}
                                title="Confirmer"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {/* Annuler */}
                            {['PENDING', 'CONFIRMED'].includes(r.status) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-600"
                                onClick={() => {
                                  if (confirm('Annuler cette réservation ?')) cancelMutation.mutate(r.id);
                                }}
                                title="Annuler"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {/* Supprimer */}
                            {canDelete && r.status !== 'ACTIVE' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm('Supprimer définitivement cette réservation ?')) deleteMutation.mutate(r.id);
                                }}
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit modal */}
      {editReservation && (
        <ReservationEditForm
          reservation={editReservation}
          open={!!editReservation}
          onOpenChange={(v) => { if (!v) setEditReservation(null); }}
        />
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {meta.total} réservation(s) · Page {meta.page}/{meta.totalPages}
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
