'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { formatMAD, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Car, Calendar,
  Users, CreditCard, BarChart3, Loader2,
  FileDown, Printer, Wrench, DollarSign,
  ArrowUpRight, CheckCircle, Clock, RefreshCw,
  FileText, Sheet,
} from 'lucide-react';

/* ── API ─────────────────────────────────────────────────────────── */
const analyticsApi = {
  dashboard:   ()           => apiClient.get('/analytics/dashboard').then((r) => r.data.data),
  revenueChart:(year:number)=> apiClient.get('/analytics/revenue-chart',{params:{year}}).then((r)=>r.data.data),
  vehicles:    ()           => apiClient.get('/analytics/vehicles').then((r) => r.data.data),
  financial:   ()           => apiClient.get('/analytics/financial').then((r) => r.data.data),
  clients:     ()           => apiClient.get('/analytics/clients').then((r) => r.data.data),
};

/* ── Constants ───────────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  PENDING:'#94a3b8', CONFIRMED:'#3b82f6', ACTIVE:'#22c55e',
  COMPLETED:'#a855f7', CANCELLED:'#ef4444', NO_SHOW:'#f97316',
};
const STATUS_LABELS: Record<string, string> = {
  PENDING:'En attente', CONFIRMED:'Confirmées', ACTIVE:'Actives',
  COMPLETED:'Terminées', CANCELLED:'Annulées', NO_SHOW:'No-show',
};
const METHOD_LABELS: Record<string, string> = {
  CASH:'Espèces', CARD:'Carte', BANK_TRANSFER:'Virement', CHEQUE:'Chèque',
};
const METHOD_COLORS: Record<string, string> = {
  CASH:'#22c55e', CARD:'#3b82f6', BANK_TRANSFER:'#a855f7', CHEQUE:'#f97316',
};
const TYPE_LABELS: Record<string, string> = {
  RENTAL:'Location', DEPOSIT:'Caution', EXTRA:'Extra', REFUND:'Remboursement',
};

const CAR_STATUS_LABEL: Record<string, string> = {
  AVAILABLE:'Disponible', RENTED:'En location', MAINTENANCE:'Maintenance', OUT_OF_SERVICE:'Hors service',
};

const TABS = ['Vue d\'ensemble', 'Véhicules', 'Financier', 'Clients'] as const;
type Tab = typeof TABS[number];

type Period = 'today' | 'week' | 'month' | 'year';
const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week',  label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'year',  label: 'Cette année' },
];

/* ── Download helpers ────────────────────────────────────────────── */
async function downloadReport(type: 'pdf' | 'excel', period: Period) {
  const res = await apiClient.get(`/reports/${type}`, {
    params:       { period },
    responseType: 'blob',
  });
  const blob = new Blob([res.data], {
    type: type === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href     = URL.createObjectURL(blob);
  link.download = `rapport-${period}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportCSV(rows: string[][], filename: string) {
  const content = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ── Main Component ──────────────────────────────────────────────── */
export function ReportsContent() {
  const [tab,        setTab]        = useState<Tab>('Vue d\'ensemble');
  const [year,       setYear]       = useState(new Date().getFullYear());
  const [period,     setPeriod]     = useState<Period>('month');
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null);
  const currentYear = new Date().getFullYear();

  const handleDownload = async (type: 'pdf' | 'excel') => {
    setDownloading(type);
    try { await downloadReport(type, period); }
    catch { /* silent */ }
    finally { setDownloading(null); }
  };

  const { data: dash,      isLoading: loadingDash  } = useQuery({ queryKey: ['analytics-dashboard'],        queryFn: analyticsApi.dashboard });
  const { data: chart,     isLoading: loadingChart  } = useQuery({ queryKey: ['revenue-chart', year],       queryFn: () => analyticsApi.revenueChart(year) });
  const { data: vehicles,  isLoading: loadingVeh    } = useQuery({ queryKey: ['analytics-vehicles'],         queryFn: analyticsApi.vehicles });
  const { data: financial, isLoading: loadingFin    } = useQuery({ queryKey: ['analytics-financial'],        queryFn: analyticsApi.financial });
  const { data: clients,   isLoading: loadingCli    } = useQuery({ queryKey: ['analytics-clients'],          queryFn: analyticsApi.clients });

  const kpis = dash?.kpis;

  const pieData = dash?.reservationsByStatus
    ? Object.entries(dash.reservationsByStatus)
        .filter(([, v]) => (v as number) > 0)
        .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, value: v as number, color: STATUS_COLORS[k] ?? '#94a3b8' }))
    : [];

  const methodPie = (financial?.byMethod ?? []).map((m: any) => ({
    name:  METHOD_LABELS[m.method] ?? m.method,
    value: m.amount,
    color: METHOD_COLORS[m.method] ?? '#94a3b8',
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rapports & Statistiques</h1>
          <p className="text-muted-foreground">Analyses complètes de votre agence</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Period filter */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  period === p.value
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Download buttons */}
          <Button
            variant="outline" size="sm"
            onClick={() => handleDownload('pdf')}
            disabled={downloading !== null}
          >
            {downloading === 'pdf'
              ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              : <FileText className="w-4 h-4 mr-1 text-red-500" />
            }
            PDF
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => handleDownload('excel')}
            disabled={downloading !== null}
          >
            {downloading === 'excel'
              ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              : <Sheet className="w-4 h-4 mr-1 text-green-600" />
            }
            Excel
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab: Vue d'ensemble ────────────────────────────── */}
      {tab === "Vue d'ensemble" && (
        <>
          {loadingDash ? <Loader /> : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={<CreditCard className="w-5 h-5 text-green-600" />} bg="bg-green-100"
                  label="Revenu ce mois" value={formatMAD(kpis?.thisMonthRevenue ?? 0)} growth={kpis?.revenueGrowth} />
                <KpiCard icon={<Calendar className="w-5 h-5 text-blue-600" />} bg="bg-blue-100"
                  label="Réservations ce mois" value={kpis?.thisMonthReservations ?? 0} growth={kpis?.reservationsGrowth} />
                <KpiCard icon={<Car className="w-5 h-5 text-purple-600" />} bg="bg-purple-100"
                  label="Taux d'utilisation" value={`${kpis?.utilizationRate ?? 0}%`} />
                <KpiCard icon={<Users className="w-5 h-5 text-orange-600" />} bg="bg-orange-100"
                  label="Locations actives" value={kpis?.activeReservations ?? 0} />
              </div>

              {/* Fleet summary */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Total', value: kpis?.totalCars ?? 0, color: 'text-foreground' },
                  { label: 'Disponibles', value: kpis?.availableCars ?? 0, color: 'text-green-600' },
                  { label: 'En location', value: kpis?.rentedCars ?? 0, color: 'text-blue-600' },
                  { label: 'Maintenance', value: kpis?.maintenanceCars ?? 0, color: 'text-yellow-600' },
                ].map((s) => (
                  <Card key={s.label}>
                    <CardContent className="p-4 text-center">
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Revenue Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-4 h-4" />Revenus & réservations — {year}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>←</Button>
                <span className="font-semibold text-sm w-12 text-center">{year}</span>
                <Button variant="outline" size="sm" disabled={year >= currentYear} onClick={() => setYear((y) => y + 1)}>→</Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  if (!chart) return;
                  exportCSV(
                    [['Mois', 'Revenus (MAD)', 'Réservations'], ...chart.map((r: any) => [r.month, r.revenue.toString(), r.reservations.toString()])],
                    `revenus-${year}.csv`
                  );
                }}>
                  <FileDown className="w-4 h-4 mr-1" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingChart ? <Loader /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chart ?? []} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: any, name: string) => name === 'Revenus (MAD)' ? formatMAD(value) : value} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" name="Revenus (MAD)" fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar yAxisId="right" dataKey="reservations" name="Réservations" fill="#22c55e" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Pie */}
            <Card>
              <CardHeader><CardTitle className="text-base">Répartition des réservations</CardTitle></CardHeader>
              <CardContent>
                {pieData.length === 0
                  ? <p className="text-center text-muted-foreground py-8 text-sm">Aucune donnée</p>
                  : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [`${v} réservation(s)`, '']} />
                        <Legend iconType="circle" iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
              </CardContent>
            </Card>

            {/* Top clients */}
            <Card>
              <CardHeader><CardTitle className="text-base">Top 5 clients</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Client</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Locations</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(dash?.topClients ?? []).length === 0
                      ? <tr><td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">Aucun client</td></tr>
                      : (dash?.topClients ?? []).map((c: any, i: number) => (
                        <tr key={c.id} className="hover:bg-muted/50">
                          <td className="p-3 text-muted-foreground font-mono text-xs">{i + 1}</td>
                          <td className="p-3 font-medium">{c.firstName} {c.lastName}</td>
                          <td className="p-3 text-right">{c.totalRentals}</td>
                          <td className="p-3 text-right font-medium text-primary">{formatMAD(c.totalSpent)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming returns */}
          {(dash?.upcomingReturns ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  Retours prévus dans les 3 prochains jours
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-3 font-medium text-muted-foreground">Client</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Véhicule</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Retour prévu</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Téléphone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(dash?.upcomingReturns ?? []).map((r: any) => (
                      <tr key={r.id} className="hover:bg-muted/50">
                        <td className="p-3 font-medium">{r.client.firstName} {r.client.lastName}</td>
                        <td className="p-3">{r.car.brand} {r.car.model} <span className="text-xs text-muted-foreground font-mono ml-1">{r.car.licensePlate}</span></td>
                        <td className="p-3"><span className="text-orange-600 font-medium">{formatDate(r.endDate)}</span></td>
                        <td className="p-3 text-muted-foreground">{r.client.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Tab: Véhicules ─────────────────────────────────── */}
      {tab === 'Véhicules' && (
        <>
          {loadingVeh ? <Loader /> : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Véhicules actifs" value={(vehicles ?? []).length} icon={<Car className="w-5 h-5 text-blue-600" />} bg="bg-blue-100" />
                <StatCard label="Total réservations" value={(vehicles ?? []).reduce((s: number, v: any) => s + v.totalReservations, 0)} icon={<Calendar className="w-5 h-5 text-purple-600" />} bg="bg-purple-100" />
                <StatCard label="Total revenus" value={formatMAD((vehicles ?? []).reduce((s: number, v: any) => s + v.totalRevenue, 0))} icon={<DollarSign className="w-5 h-5 text-green-600" />} bg="bg-green-100" />
              </div>

              {/* Vehicle performance bar chart */}
              {(vehicles ?? []).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" />Revenus par véhicule</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={(vehicles ?? []).slice(0, 10)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="licensePlate" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: any) => formatMAD(v)} />
                        <Bar dataKey="totalRevenue" name="Revenus (MAD)" fill="#3b82f6" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Vehicles table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Performance par véhicule</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => exportCSV(
                    [
                      ['Véhicule', 'Immatriculation', 'Statut', 'Prix/Jour', 'Réservations', 'Jours loués', 'Revenus (MAD)'],
                      ...(vehicles ?? []).map((v: any) => [
                        `${v.brand} ${v.model}`, v.licensePlate,
                        CAR_STATUS_LABEL[v.status] ?? v.status,
                        v.pricePerDay.toString(), v.totalReservations.toString(),
                        v.totalDays.toString(), v.totalRevenue.toFixed(2),
                      ]),
                    ],
                    'vehicules-performance.csv'
                  )}>
                    <FileDown className="w-4 h-4 mr-1" />CSV
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left p-3 font-medium text-muted-foreground">Véhicule</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Immat.</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Statut</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Rés.</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Jours loués</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Revenus</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Moy./jour loué</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(vehicles ?? []).length === 0
                          ? <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Aucun véhicule</td></tr>
                          : (vehicles ?? []).map((v: any) => (
                            <tr key={v.id} className="hover:bg-muted/50">
                              <td className="p-3 font-medium">{v.brand} {v.model}</td>
                              <td className="p-3 font-mono text-xs text-muted-foreground">{v.licensePlate}</td>
                              <td className="p-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  v.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                                  v.status === 'RENTED' ? 'bg-blue-100 text-blue-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>{CAR_STATUS_LABEL[v.status] ?? v.status}</span>
                              </td>
                              <td className="p-3 text-right">{v.totalReservations}</td>
                              <td className="p-3 text-right">{v.totalDays}j</td>
                              <td className="p-3 text-right font-medium text-primary">{formatMAD(v.totalRevenue)}</td>
                              <td className="p-3 text-right text-muted-foreground">
                                {v.totalDays > 0 ? formatMAD(v.totalRevenue / v.totalDays) : '—'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* ── Tab: Financier ─────────────────────────────────── */}
      {tab === 'Financier' && (
        <>
          {loadingFin ? <Loader /> : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={<CheckCircle className="w-5 h-5 text-green-600" />} bg="bg-green-100"
                  label="Total encaissé" value={formatMAD(financial?.totalPaid ?? 0)} />
                <KpiCard icon={<Clock className="w-5 h-5 text-yellow-600" />} bg="bg-yellow-100"
                  label="En attente" value={formatMAD(financial?.totalPending ?? 0)} />
                <KpiCard icon={<RefreshCw className="w-5 h-5 text-red-600" />} bg="bg-red-100"
                  label="Remboursements" value={formatMAD(financial?.totalRefunded ?? 0)} />
                <KpiCard icon={<ArrowUpRight className="w-5 h-5 text-blue-600" />} bg="bg-blue-100"
                  label="Transactions payées" value={financial?.totalPaidCount ?? 0} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment methods pie */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Répartition par mode de paiement</CardTitle></CardHeader>
                  <CardContent>
                    {methodPie.length === 0
                      ? <p className="text-center text-muted-foreground py-8 text-sm">Aucun paiement</p>
                      : (
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie data={methodPie} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                              {methodPie.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                            <Tooltip formatter={(v: any) => formatMAD(v)} />
                            <Legend iconType="circle" iconSize={8} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                  </CardContent>
                </Card>

                {/* Payment by method table */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base">Détail par mode</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => exportCSV(
                      [['Mode', 'Transactions', 'Montant (MAD)'],
                        ...(financial?.byMethod ?? []).map((m: any) => [METHOD_LABELS[m.method] ?? m.method, m.count.toString(), m.amount.toFixed(2)])],
                      'paiements-modes.csv'
                    )}>
                      <FileDown className="w-4 h-4 mr-1" />CSV
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left p-3 font-medium text-muted-foreground">Mode</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Transactions</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Montant</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(financial?.byMethod ?? []).length === 0
                          ? <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Aucun paiement</td></tr>
                          : (financial?.byMethod ?? []).map((m: any) => {
                            const pct = financial.totalPaid > 0 ? Math.round((m.amount / financial.totalPaid) * 100) : 0;
                            return (
                              <tr key={m.method} className="hover:bg-muted/50">
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: METHOD_COLORS[m.method] ?? '#94a3b8' }} />
                                    {METHOD_LABELS[m.method] ?? m.method}
                                  </div>
                                </td>
                                <td className="p-3 text-right">{m.count}</td>
                                <td className="p-3 text-right font-medium">{formatMAD(m.amount)}</td>
                                <td className="p-3 text-right text-muted-foreground">{pct}%</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>

              {/* By type */}
              <Card>
                <CardHeader><CardTitle className="text-base">Répartition par type de paiement</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Transactions</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Montant total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(financial?.byType ?? []).map((t: any) => (
                        <tr key={t.type} className="hover:bg-muted/50">
                          <td className="p-3 font-medium">{TYPE_LABELS[t.type] ?? t.type}</td>
                          <td className="p-3 text-right">{t.count}</td>
                          <td className="p-3 text-right font-medium text-primary">{formatMAD(t.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* ── Tab: Clients ───────────────────────────────────── */}
      {tab === 'Clients' && (
        <>
          {loadingCli ? <Loader /> : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={<Users className="w-5 h-5 text-blue-600" />} bg="bg-blue-100"
                  label="Total clients" value={clients?.total ?? 0} />
                <KpiCard icon={<ArrowUpRight className="w-5 h-5 text-green-600" />} bg="bg-green-100"
                  label="Nouveaux ce mois" value={clients?.newThisMonth ?? 0} />
                <KpiCard icon={<RefreshCw className="w-5 h-5 text-purple-600" />} bg="bg-purple-100"
                  label="Clients fidèles (2+ locations)" value={clients?.returning ?? 0} />
                <KpiCard icon={<Calendar className="w-5 h-5 text-orange-600" />} bg="bg-orange-100"
                  label="1 seule location" value={clients?.oneTime ?? 0} />
              </div>

              {/* Top clients table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Top 10 clients — Chiffre d'affaires</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => exportCSV(
                    [['Client', 'Ville', 'Téléphone', 'Locations', 'Total dépensé (MAD)'],
                      ...(clients?.top ?? []).map((c: any) => [
                        `${c.firstName} ${c.lastName}`, c.city ?? '', c.phone ?? '',
                        c.totalRentals.toString(), Number(c.totalSpent).toFixed(2),
                      ])],
                    'top-clients.csv'
                  )}>
                    <FileDown className="w-4 h-4 mr-1" />CSV
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Client</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Ville</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Locations</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Total dépensé</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Score risque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(clients?.top ?? []).length === 0
                        ? <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Aucun client</td></tr>
                        : (clients?.top ?? []).map((c: any, i: number) => (
                          <tr key={c.id} className="hover:bg-muted/50">
                            <td className="p-3 text-muted-foreground font-mono text-xs">{i + 1}</td>
                            <td className="p-3">
                              <p className="font-medium">{c.firstName} {c.lastName}</p>
                              <p className="text-xs text-muted-foreground">{c.phone}</p>
                            </td>
                            <td className="p-3 text-muted-foreground">{c.city ?? '—'}</td>
                            <td className="p-3 text-right font-medium">{c.totalRentals}</td>
                            <td className="p-3 text-right font-medium text-primary">{formatMAD(c.totalSpent)}</td>
                            <td className="p-3 text-right">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                c.riskScore === 0 ? 'bg-green-100 text-green-700' :
                                c.riskScore < 40  ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {c.riskScore === 0 ? 'Faible' : c.riskScore < 40 ? 'Moyen' : 'Élevé'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */
function Loader() {
  return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function KpiCard({ icon, bg, label, value, growth }: {
  icon: React.ReactNode; bg: string; label: string;
  value: string | number; growth?: number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>{icon}</div>
          {growth !== undefined && growth !== 0 && (
            <span className={`flex items-center text-xs font-medium ${growth > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {growth > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {Math.abs(growth)}%
            </span>
          )}
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function StatCard({ icon, bg, label, value }: {
  icon: React.ReactNode; bg: string; label: string; value: string | number;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>{icon}</div>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
