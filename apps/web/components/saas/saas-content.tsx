'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import apiClient from '@/lib/api/client';
import { formatDate, formatMAD } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Building2, TrendingUp, DollarSign, Users, AlertTriangle,
  CheckCircle, XCircle, Pencil, Loader2, CreditCard, Clock,
  ArrowUpRight, ArrowDownRight, Activity, Percent,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

// ── API ───────────────────────────────────────────
const saasApi = {
  overview:      () => apiClient.get('/agencies/saas/overview').then((r) => r.data.data),
  revenueChart:  () => apiClient.get('/agencies/saas/revenue-chart').then((r) => r.data.data),
  updateAgency:  (id: string, data: any) => apiClient.patch(`/agencies/${id}`, data),
};

// ── Plan config ───────────────────────────────────
const PLAN_CONFIG: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  basic:      { label: 'Basic',      color: 'text-slate-600 dark:text-slate-300',   bg: 'bg-slate-100 dark:bg-slate-800',   bar: '#94a3b8' },
  pro:        { label: 'Pro',        color: 'text-blue-700 dark:text-blue-300',     bg: 'bg-blue-100 dark:bg-blue-900/40',  bar: '#3b82f6' },
  enterprise: { label: 'Enterprise', color: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-100 dark:bg-violet-900/40', bar: '#7c3aed' },
};

const editSchema = z.object({
  plan:            z.enum(['basic', 'pro', 'enterprise']),
  monthlyFee:      z.coerce.number().min(0),
  subscriptionEnd: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

// ── Custom Tooltip for charts ─────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold mb-1 text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.name === 'MRR' ? formatMAD(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────
export function SaasContent() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState<any>(null);

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['saas-overview'],
    queryFn:  saasApi.overview,
    staleTime: 60_000,
  });

  const { data: chartData, isLoading: loadingChart } = useQuery({
    queryKey: ['saas-revenue-chart'],
    queryFn:  saasApi.revenueChart,
    staleTime: 60_000,
  });

  const editMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: EditForm }) =>
      saasApi.updateAgency(id, {
        plan:            form.plan,
        monthlyFee:      form.monthlyFee,
        subscriptionEnd: form.subscriptionEnd || null,
      }),
    onSuccess: () => {
      toast({ title: '✅ Abonnement mis à jour' });
      queryClient.invalidateQueries({ queryKey: ['saas-overview'] });
      queryClient.invalidateQueries({ queryKey: ['saas-revenue-chart'] });
      setEditTarget(null);
    },
    onError: (err: any) =>
      toast({ title: 'Erreur', description: err.response?.data?.message, variant: 'destructive' }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const openEdit = (a: any) => {
    setEditTarget(a);
    reset({
      plan:            a.plan,
      monthlyFee:      Number(a.monthlyFee ?? 0),
      subscriptionEnd: a.subscriptionEnd ? a.subscriptionEnd.split('T')[0] : '',
    });
  };

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Accès réservé au Super Administrateur
      </div>
    );
  }

  const summary  = overview?.summary;
  const agencies = overview?.agencies ?? [];
  const months   = chartData?.months   ?? [];

  const churnRate = summary?.total > 0
    ? (((summary.total - summary.activeCount) / summary.total) * 100).toFixed(1)
    : '0.0';
  const avgRevenue = summary?.activeCount > 0
    ? (summary.totalMRR / summary.activeCount)
    : 0;

  // Plan distribution
  const planDist = (['basic', 'pro', 'enterprise'] as const).map((plan) => ({
    plan,
    count: agencies.filter((a: any) => a.plan === plan).length,
    mrr:   agencies.filter((a: any) => a.plan === plan)
                   .reduce((s: number, a: any) => s + Number(a.monthlyFee ?? 0), 0),
  }));

  // Expiring soon (≤ 30 days)
  const expiring = agencies.filter((a: any) =>
    a.daysUntilExpiry !== null && a.daysUntilExpiry >= 0 && a.daysUntilExpiry <= 30
  ).sort((a: any, b: any) => a.daysUntilExpiry - b.daysUntilExpiry);

  // Top agencies by lifetime revenue
  const topAgencies = [...agencies]
    .sort((a: any, b: any) => b.lifetimeRevenue - a.lifetimeRevenue)
    .slice(0, 5);

  // MRR trend (compare last month vs month before)
  const mrrTrend = months.length >= 2
    ? months[months.length - 1].mrr - months[months.length - 2].mrr
    : 0;

  const isLoading = loadingOverview || loadingChart;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord SaaS</h1>
          <p className="text-muted-foreground text-sm">
            Vue d'ensemble de la plateforme — {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-green-700 dark:text-green-400">Système opérationnel</span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 h-24 animate-pulse bg-muted/30 rounded-lg" /></Card>
          ))}
        </div>
      ) : (
        <>
          {/* ── KPI Grid ── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard
              label="Total agences"
              value={summary?.total ?? 0}
              icon={<Building2 className="w-4 h-4" />}
              color="blue"
            />
            <KpiCard
              label="Actives"
              value={summary?.activeCount ?? 0}
              icon={<CheckCircle className="w-4 h-4" />}
              color="green"
              sub={`${(summary?.total ?? 0) - (summary?.activeCount ?? 0)} inactives`}
            />
            <KpiCard
              label="MRR"
              value={formatMAD(summary?.totalMRR ?? 0)}
              icon={<DollarSign className="w-4 h-4" />}
              color="violet"
              trend={mrrTrend}
            />
            <KpiCard
              label="ARR"
              value={formatMAD(summary?.totalARR ?? 0)}
              icon={<TrendingUp className="w-4 h-4" />}
              color="indigo"
            />
            <KpiCard
              label="Taux de churn"
              value={`${churnRate}%`}
              icon={<Percent className="w-4 h-4" />}
              color={parseFloat(churnRate) > 20 ? 'red' : 'emerald'}
              sub="agences inactives"
            />
            <KpiCard
              label="Revenu moyen"
              value={formatMAD(avgRevenue)}
              icon={<CreditCard className="w-4 h-4" />}
              color="amber"
              sub="par agence active"
            />
          </div>

          {/* ── Alerts ── */}
          {expiring.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {expiring.length} abonnement(s) expire(nt) dans moins de 30 jours
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {expiring.map((a: any) => (
                    <span key={a.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/40 rounded-full text-xs font-medium text-amber-800 dark:text-amber-300">
                      <span className={`w-1.5 h-1.5 rounded-full ${a.daysUntilExpiry <= 7 ? 'bg-red-500' : 'bg-amber-500'}`} />
                      {a.name} — {a.daysUntilExpiry === 0 ? 'aujourd\'hui' : `${a.daysUntilExpiry}j`}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Charts row ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Revenue area chart */}
            <Card className="xl:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    Évolution du MRR — 12 derniers mois
                  </CardTitle>
                  {mrrTrend !== 0 && (
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      mrrTrend > 0
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {mrrTrend > 0
                        ? <ArrowUpRight className="w-3 h-3" />
                        : <ArrowDownRight className="w-3 h-3" />}
                      {formatMAD(Math.abs(mrrTrend))} vs mois préc.
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} width={40} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="mrr" name="MRR" stroke="#3b82f6" strokeWidth={2}
                      fill="url(#mrrGrad)" dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Plan distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-violet-500" />
                  Distribution des plans
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={planDist} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="plan" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => PLAN_CONFIG[v]?.label ?? v} />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const cfg = PLAN_CONFIG[label];
                      return (
                        <div className="bg-background border rounded-lg shadow p-2 text-xs">
                          <p className="font-semibold">{cfg?.label ?? label}</p>
                          <p>{payload[0].value} agence(s)</p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {planDist.map((entry) => (
                        <Cell key={entry.plan} fill={PLAN_CONFIG[entry.plan]?.bar ?? '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="space-y-2">
                  {planDist.map(({ plan, count, mrr }) => {
                    const cfg  = PLAN_CONFIG[plan];
                    const pct  = summary?.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                    return (
                      <div key={plan}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{count} agence(s) · {formatMAD(mrr)}/mois</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cfg.bar }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Agencies count chart ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-500" />
                Agences actives par mois
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-background border rounded-lg shadow p-2 text-xs">
                        <p className="font-semibold">{label}</p>
                        <p className="text-emerald-600">{payload[0].value} agence(s)</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey="count" name="Agences" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── Bottom row ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Top agencies by revenue */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  Top agences — revenus cumulés
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Agence</th>
                      <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Plan</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">CA cumulé</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">MRR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {topAgencies.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">Aucune donnée</td></tr>
                    ) : topAgencies.map((a: any, idx: number) => {
                      const plan = PLAN_CONFIG[a.plan] ?? PLAN_CONFIG.basic;
                      return (
                        <tr key={a.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                {idx + 1}
                              </span>
                              <div>
                                <p className="font-medium text-xs">{a.name}</p>
                                <p className="text-[10px] text-muted-foreground">{a.city ?? a.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${plan.bg} ${plan.color}`}>
                              {plan.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold text-primary">
                            {Number(a.monthlyFee) > 0 ? formatMAD(a.lifetimeRevenue) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs">
                            {Number(a.monthlyFee) > 0 ? formatMAD(a.monthlyFee) : <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Full agencies subscription table */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-500" />
                    Abonnements
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-y-auto max-h-[280px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Agence</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Expiration</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Fee</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {agencies.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">Aucune agence</td></tr>
                      ) : agencies.map((a: any) => {
                        const expiry = a.daysUntilExpiry;
                        const statusColor =
                          !a.isActive            ? 'text-red-500' :
                          expiry === null         ? 'text-green-500' :
                          expiry < 0             ? 'text-red-500' :
                          expiry <= 7            ? 'text-red-400' :
                          expiry <= 30           ? 'text-amber-500' : 'text-green-500';
                        return (
                          <tr key={a.id} className={`hover:bg-muted/40 transition-colors ${!a.isActive ? 'opacity-50' : ''}`}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                {a.isActive
                                  ? <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                                  : <XCircle    className="w-3 h-3 text-red-400 flex-shrink-0" />}
                                <span className="text-xs font-medium truncate max-w-[110px]">{a.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <Clock className={`w-3 h-3 flex-shrink-0 ${statusColor}`} />
                                <span className={`text-xs ${statusColor}`}>
                                  {a.subscriptionEnd
                                    ? (expiry !== null && expiry < 0 ? 'Expiré' : `${expiry}j restants`)
                                    : 'Sans limite'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs font-medium">
                              {Number(a.monthlyFee) > 0 ? formatMAD(a.monthlyFee) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-50"
                                onClick={() => openEdit(a)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Edit subscription dialog */}
      {editTarget && (
        <Dialog open onOpenChange={() => setEditTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-500" />
                Abonnement — {editTarget.name}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit((d) => editMutation.mutate({ id: editTarget.id, form: d }))}
              className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label>Plan</Label>
                <select {...register('plan')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Frais mensuel (MAD)</Label>
                <Input type="number" min={0} step={50} {...register('monthlyFee')} />
                {errors.monthlyFee && <p className="text-xs text-destructive">{errors.monthlyFee.message}</p>}
                <p className="text-xs text-muted-foreground">Montant facturé à cette agence chaque mois</p>
              </div>
              <div className="space-y-1">
                <Label>Date d'expiration</Label>
                <Input type="date" {...register('subscriptionEnd')} />
                <p className="text-xs text-muted-foreground">Laisser vide = sans limite</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={editMutation.isPending}>
                  {editMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Enregistrer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────
const KPI_COLORS: Record<string, { icon: string; bg: string; border: string }> = {
  blue:    { icon: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950/40',    border: 'border-blue-100 dark:border-blue-900' },
  green:   { icon: 'text-green-600',   bg: 'bg-green-50 dark:bg-green-950/40',  border: 'border-green-100 dark:border-green-900' },
  violet:  { icon: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-950/40',border: 'border-violet-100 dark:border-violet-900' },
  indigo:  { icon: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-950/40',border: 'border-indigo-100 dark:border-indigo-900' },
  red:     { icon: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-950/40',      border: 'border-red-100 dark:border-red-900' },
  emerald: { icon: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-100 dark:border-emerald-900' },
  amber:   { icon: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-950/40',  border: 'border-amber-100 dark:border-amber-900' },
};

function KpiCard({ label, value, icon, color, sub, trend }: {
  label:  string;
  value:  string | number;
  icon:   React.ReactNode;
  color:  keyof typeof KPI_COLORS;
  sub?:   string;
  trend?: number;
}) {
  const cfg = KPI_COLORS[color] ?? KPI_COLORS.blue;
  return (
    <Card className={`border ${cfg.border}`}>
      <CardContent className="p-4">
        <div className={`w-8 h-8 ${cfg.bg} rounded-lg flex items-center justify-center mb-3 ${cfg.icon}`}>
          {icon}
        </div>
        <p className="text-xl font-bold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {(sub || trend !== undefined) && (
          <div className="mt-1.5 flex items-center gap-1">
            {trend !== undefined && trend !== 0 && (
              <span className={`flex items-center gap-0.5 text-[10px] font-medium ${trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {trend > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                {formatMAD(Math.abs(trend))}
              </span>
            )}
            {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
