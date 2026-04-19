'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { carsApi } from '@/lib/api/cars';
import apiClient from '@/lib/api/client';
import { formatMAD, formatDate, CAR_STATUS_CONFIG, FUEL_TYPE_LABELS, TRANSMISSION_LABELS } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import {
  Search, Car, Fuel, Settings2, Users2, Loader2, Pencil, Trash2, RefreshCw,
  CalendarDays, User, AlertTriangle, CheckCircle, Clock, Wrench, XCircle,
} from 'lucide-react';
import { CarForm } from './car-form';
import { cn } from '@/lib/utils';

// ── Status badge config (extends existing) ─────────────────────────────
const STATUS_UI: Record<string, {
  label: string;
  badge: string;
  card: string;
  dot: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  AVAILABLE: {
    label: 'Disponible',
    badge: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
    card:  'border-green-200 dark:border-green-900',
    dot:   'bg-green-500',
    icon:  CheckCircle,
  },
  RENTED: {
    label: 'En location',
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    card:  'border-red-200 dark:border-red-900',
    dot:   'bg-red-500',
    icon:  Car,
  },
  RESERVED: {
    label: 'Réservée',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
    card:  'border-orange-200 dark:border-orange-900',
    dot:   'bg-orange-500',
    icon:  Clock,
  },
  MAINTENANCE: {
    label: 'Maintenance',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    card:  'border-blue-200 dark:border-blue-900',
    dot:   'bg-blue-500',
    icon:  Wrench,
  },
  OUT_OF_SERVICE: {
    label: 'Hors service',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-300',
    card:  'border-gray-200 dark:border-gray-700',
    dot:   'bg-gray-500',
    icon:  AlertTriangle,
  },
  PENDING: {
    label: 'Réservation en attente',
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
    card:  'border-yellow-200 dark:border-yellow-800',
    dot:   'bg-yellow-500',
    icon:  Clock,
  },
};

// Derive visible status from car + its active reservation
function getEffectiveStatus(car: any): 'AVAILABLE' | 'RENTED' | 'RESERVED' | 'PENDING' | 'MAINTENANCE' | 'OUT_OF_SERVICE' | 'OVERDUE' {
  const now = new Date();
  const res = car.reservations?.[0];
  if (car.status === 'RENTED') {
    if (res && new Date(res.endDate) < now) return 'OVERDUE';
    return 'RENTED';
  }
  if (res?.status === 'CONFIRMED') return 'RESERVED';
  if (res?.status === 'PENDING')   return 'PENDING';
  return car.status as any;
}

export function CarsContent() {
  const queryClient = useQueryClient();
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [editCar, setEditCar]         = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cars', { page, search, status: statusFilter }],
    queryFn: () => carsApi.getAll({ page, search: search || undefined, status: statusFilter || undefined }).then((r) => r.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['cars-stats'],
    queryFn: () => carsApi.getStats().then((r) => r.data.data),
  });

  // Auto-cleanup overdue rentals on mount
  useEffect(() => {
    apiClient.post('/reservations/cleanup-overdue').then((r) => {
      const updated = r.data?.data?.updated ?? 0;
      if (updated > 0) {
        queryClient.invalidateQueries({ queryKey: ['cars'] });
        queryClient.invalidateQueries({ queryKey: ['cars-stats'] });
        queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] });
      }
    }).catch(() => {});
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => carsApi.delete(id),
    onSuccess: () => {
      toast({ title: 'Véhicule supprimé' });
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      queryClient.invalidateQueries({ queryKey: ['cars-stats'] });
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.response?.data?.message, variant: 'destructive' });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      carsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      queryClient.invalidateQueries({ queryKey: ['cars-stats'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-dash'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.response?.data?.message, variant: 'destructive' });
    },
  });

  const cars = data?.data ?? [];
  const meta = data?.meta;

  // Count by effective status
  const statusCounts: Record<string, number> = {
    AVAILABLE:    statsData?.available    ?? 0,
    RENTED:       statsData?.rented       ?? 0,
    MAINTENANCE:  statsData?.maintenance  ?? 0,
    OUT_OF_SERVICE: statsData?.outOfService ?? 0,
  };

  const STATUS_FILTER_TABS = [
    { key: '',              label: 'Tous',         dot: 'bg-muted-foreground' },
    { key: 'AVAILABLE',     label: 'Disponibles',  dot: 'bg-green-500' },
    { key: 'RENTED',        label: 'En location',  dot: 'bg-red-500' },
    { key: 'MAINTENANCE',   label: 'Maintenance',  dot: 'bg-blue-500' },
    { key: 'OUT_OF_SERVICE',label: 'Hors service', dot: 'bg-gray-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flotte de véhicules</h1>
          <p className="text-muted-foreground">{statsData?.total ?? 0} véhicule(s) au total</p>
        </div>
        <CarForm />
      </div>

      {/* Status KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_UI).filter(([k]) => k !== 'RESERVED').map(([status, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button key={status}
              onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
              className={cn(
                'p-4 rounded-xl border text-left transition-all bg-card hover:shadow-sm',
                statusFilter === status ? 'ring-2 ring-primary' : 'hover:border-primary/40',
                cfg.card
              )}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                <span className="text-xs text-muted-foreground">{cfg.label}</span>
              </div>
              <p className="text-2xl font-bold">{statusCounts[status] ?? 0}</p>
            </button>
          );
        })}
      </div>

      {/* Search + filter tabs */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Marque, modèle, plaque…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {STATUS_FILTER_TABS.map(tab => (
            <button key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5',
                statusFilter === tab.key
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', tab.dot)} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Car Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : cars.length === 0 ? (
        <div className="text-center py-16">
          <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold">Aucun véhicule</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {search ? 'Aucun résultat pour votre recherche' : 'Commencez par ajouter votre premier véhicule'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cars.map((car: any) => {
            const effStatus = getEffectiveStatus(car);
            const ui = effStatus === 'OVERDUE'
              ? { label: 'En retard', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300', card: 'border-rose-300 dark:border-rose-800', dot: 'bg-rose-500', icon: AlertTriangle }
              : (STATUS_UI as any)[effStatus] ?? STATUS_UI.AVAILABLE;
            const res = car.reservations?.[0];
            const isOverdue  = effStatus === 'OVERDUE';
            const isRented   = effStatus === 'RENTED' || isOverdue;
            const isReserved = effStatus === 'RESERVED';
            const isPending  = effStatus === 'PENDING';
            const showInfo   = (isRented || isReserved || isPending) && res;
            const now = new Date();

            return (
              <Card key={car.id} className={cn('overflow-hidden hover:shadow-md transition-shadow border-2', ui.card)}>
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Car className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold leading-tight">{car.brand} {car.model}</h3>
                        <p className="text-xs text-muted-foreground font-mono">{car.licensePlate}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', ui.badge)}>
                        {isOverdue && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {ui.label}
                      </span>
                      {isOverdue && (
                        <span className="text-[10px] text-rose-500 font-medium">Retard de {Math.ceil((now.getTime() - new Date(res.endDate).getTime()) / 86400000)} j</span>
                      )}
                    </div>
                  </div>

                  {/* Rental / reservation info panel */}
                  {showInfo && (() => {
                    const startD = new Date(res.startDate);
                    const endD   = new Date(res.endDate);
                    const totalDays = Math.ceil((endD.getTime() - startD.getTime()) / 86400000);
                    const daysLeft  = isRented ? Math.ceil((endD.getTime() - now.getTime()) / 86400000) : null;
                    return (
                      <div className={cn(
                        'rounded-xl border overflow-hidden',
                        isOverdue  ? 'border-rose-300   dark:border-rose-700'   :
                        isRented   ? 'border-red-300    dark:border-red-700'    :
                        isReserved ? 'border-orange-300 dark:border-orange-700' :
                                     'border-yellow-300 dark:border-yellow-700'
                      )}>
                        {/* Client header */}
                        <div className={cn(
                          'px-3 py-2 flex items-center justify-between',
                          isOverdue  ? 'bg-rose-100   dark:bg-rose-500/20'   :
                          isRented   ? 'bg-red-100    dark:bg-red-500/20'    :
                          isReserved ? 'bg-orange-100 dark:bg-orange-500/20' :
                                       'bg-yellow-100 dark:bg-yellow-500/20'
                        )}>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 shrink-0" />
                            <span className="font-bold text-sm">
                              {res.client.firstName} {res.client.lastName}
                            </span>
                          </div>
                          {res.client.phone && (
                            <span className="text-xs font-mono font-medium">{res.client.phone}</span>
                          )}
                        </div>
                        {/* Dates + stats */}
                        <div className="px-3 py-2.5 space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-xs">Départ</span>
                            </div>
                            <span className="font-semibold">{formatDate(res.startDate)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-xs">Retour</span>
                            </div>
                            <span className={cn('font-semibold', isOverdue ? 'text-rose-600 dark:text-rose-400' : '')}>
                              {formatDate(res.endDate)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                            <span>{totalDays} jour{totalDays > 1 ? 's' : ''} au total</span>
                            {daysLeft !== null && (
                              <span className={cn(
                                'font-semibold',
                                isOverdue          ? 'text-rose-600 dark:text-rose-400' :
                                daysLeft <= 1      ? 'text-orange-600 dark:text-orange-400' :
                                                     'text-foreground'
                              )}>
                                {isOverdue
                                  ? `${Math.abs(daysLeft)} j de retard`
                                  : daysLeft === 0
                                    ? 'Retour aujourd\'hui'
                                    : `${daysLeft} j restant${daysLeft > 1 ? 's' : ''}`}
                              </span>
                            )}
                            {res.reservationNumber && !daysLeft && (
                              <span className="font-mono">{res.reservationNumber}</span>
                            )}
                          </div>
                          {res.reservationNumber && daysLeft !== null && (
                            <div className="text-xs text-muted-foreground font-mono text-right -mt-1">
                              {res.reservationNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-t pt-2.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Car className="w-3 h-3 flex-shrink-0" />
                      <span>Année : <span className="font-medium text-foreground">{car.year}</span></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Fuel className="w-3 h-3 flex-shrink-0" />
                      <span className="font-medium text-foreground">{FUEL_TYPE_LABELS[car.fuelType as keyof typeof FUEL_TYPE_LABELS]}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Settings2 className="w-3 h-3 flex-shrink-0" />
                      <span className="font-medium text-foreground">{TRANSMISSION_LABELS[car.transmission as keyof typeof TRANSMISSION_LABELS]}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users2 className="w-3 h-3 flex-shrink-0" />
                      <span className="font-medium text-foreground">{car.seats} places</span>
                    </div>
                    {car.mileage > 0 && (
                      <div className="col-span-2 text-muted-foreground">
                        Km : <span className="font-medium text-foreground">{car.mileage.toLocaleString('fr-MA')} km</span>
                      </div>
                    )}
                  </div>

                  {/* Price + actions */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-lg font-bold text-primary">{formatMAD(car.pricePerDay)}</span>
                      <span className="text-xs text-muted-foreground ml-1">/jour</span>
                    </div>
                    <div className="flex gap-1.5">
                      {/* Status quick-change — only for non-rented cars */}
                      {car.status !== 'RENTED' && (
                        <>
                          {car.status === 'MAINTENANCE' ? (
                            <Button
                              variant="outline" size="sm"
                              className="h-8 px-2 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                              title="Remettre disponible"
                              onClick={() => statusMutation.mutate({ id: car.id, status: 'AVAILABLE' })}
                              disabled={statusMutation.isPending}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />Dispo
                            </Button>
                          ) : car.status === 'OUT_OF_SERVICE' ? (
                            <Button
                              variant="outline" size="sm"
                              className="h-8 px-2 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                              title="Remettre disponible"
                              onClick={() => statusMutation.mutate({ id: car.id, status: 'AVAILABLE' })}
                              disabled={statusMutation.isPending}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />Dispo
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline" size="sm"
                                className="h-8 w-8 p-0 text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                title="Mettre en maintenance"
                                onClick={() => statusMutation.mutate({ id: car.id, status: 'MAINTENANCE' })}
                                disabled={statusMutation.isPending}
                              >
                                <Wrench className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                className="h-8 w-8 p-0 text-gray-500 border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                title="Mettre hors service"
                                onClick={() => statusMutation.mutate({ id: car.id, status: 'OUT_OF_SERVICE' })}
                                disabled={statusMutation.isPending}
                              >
                                <XCircle className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </>
                      )}
                      <Button variant="outline" size="sm" className="h-8 px-3"
                        onClick={() => setEditCar(car)}>
                        <Pencil className="w-3 h-3 mr-1" />Modifier
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => { if (confirm('Supprimer ce véhicule ?')) deleteMutation.mutate(car.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      {editCar && (
        <CarForm car={editCar} open={true} onOpenChange={(v) => { if (!v) setEditCar(null); }} />
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {meta.total} résultat(s) · Page {meta.page}/{meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" disabled={page === meta.totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}
    </div>
  );
}
