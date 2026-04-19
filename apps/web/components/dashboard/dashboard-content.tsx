'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics';
import { formatMAD, formatDate, RESERVATION_STATUS_CONFIG, CAR_STATUS_CONFIG } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import {
  Car, Users, Calendar, TrendingUp, TrendingDown,
  AlertTriangle, ArrowRight, DollarSign,
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

// ─── KPI Card ─────────────────────────────────

function KpiCard({
  title, value, icon: Icon, growth, prefix, suffix, color,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  growth?: number;
  prefix?: string;
  suffix?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">
              {prefix}{value}{suffix}
            </p>
            {growth !== undefined && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {growth >= 0
                  ? <TrendingUp className="w-3 h-3" />
                  : <TrendingDown className="w-3 h-3" />}
                {Math.abs(growth)}% vs mois dernier
              </p>
            )}
          </div>
          <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ────────────────────────────

export function DashboardContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => analyticsApi.getDashboard().then((r) => r.data.data),
  });

  const { data: chartData } = useQuery({
    queryKey: ['revenue-chart'],
    queryFn: () => analyticsApi.getRevenueChart(new Date().getFullYear()).then((r) => r.data.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const kpis = data?.kpis ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d'ensemble de votre agence</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Revenu du mois"
          value={formatMAD(kpis.thisMonthRevenue ?? 0)}
          icon={DollarSign}
          growth={kpis.revenueGrowth}
          color="bg-blue-600"
        />
        <KpiCard
          title="Réservations"
          value={kpis.thisMonthReservations ?? 0}
          icon={Calendar}
          growth={kpis.reservationsGrowth}
          suffix=" ce mois"
          color="bg-purple-600"
        />
        <KpiCard
          title="Véhicules actifs"
          value={kpis.rentedCars ?? 0}
          icon={Car}
          suffix={`/${kpis.totalCars ?? 0}`}
          color="bg-green-600"
        />
        <KpiCard
          title="Taux d'utilisation"
          value={kpis.utilizationRate ?? 0}
          icon={TrendingUp}
          suffix="%"
          color="bg-orange-600"
        />
      </div>

      {/* Fleet Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(CAR_STATUS_CONFIG).map(([status, config]) => {
          const count = status === 'AVAILABLE' ? kpis.availableCars
            : status === 'RENTED' ? kpis.rentedCars
            : status === 'MAINTENANCE' ? kpis.maintenanceCars
            : 0;
          return (
            <div key={status} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div className={`w-2 h-2 rounded-full ${config.dot}`} />
              <div>
                <p className="text-xs text-muted-foreground">{config.label}</p>
                <p className="text-lg font-bold">{count ?? 0}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenus mensuels {new Date().getFullYear()}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatMAD(v)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenus (MAD)" fill="hsl(221.2, 83.2%, 53.3%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Upcoming Returns */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Retours prévus</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.upcomingReturns?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun retour imminent</p>
            )}
            {data?.upcomingReturns?.map((r: any) => (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {r.client.firstName} {r.client.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.car.brand} {r.car.model} · {r.car.licensePlate}
                  </p>
                  <p className="text-xs text-orange-600 font-medium mt-1">
                    Retour: {formatDate(r.endDate)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Reservations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Réservations récentes</CardTitle>
          <Link href="/reservations" className="text-sm text-primary flex items-center gap-1 hover:underline">
            Voir tout <ArrowRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="pb-3 font-medium text-muted-foreground">Référence</th>
                  <th className="pb-3 font-medium text-muted-foreground">Client</th>
                  <th className="pb-3 font-medium text-muted-foreground">Véhicule</th>
                  <th className="pb-3 font-medium text-muted-foreground">Statut</th>
                  <th className="pb-3 font-medium text-muted-foreground text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.recentReservations?.map((r: any) => {
                  const statusConfig = RESERVATION_STATUS_CONFIG[r.status as keyof typeof RESERVATION_STATUS_CONFIG];
                  return (
                    <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                      <td className="py-3 font-mono text-xs">{r.reservationNumber}</td>
                      <td className="py-3">{r.client.firstName} {r.client.lastName}</td>
                      <td className="py-3 text-muted-foreground">{r.car.brand} {r.car.model}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig?.color}`}>
                          {statusConfig?.label}
                        </span>
                      </td>
                      <td className="py-3 text-right font-medium">{formatMAD(r.totalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
