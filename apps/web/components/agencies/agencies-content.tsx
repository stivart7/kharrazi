'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '@/lib/api/client';
import { formatDate, formatMAD } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Building2, Plus, Loader2, Car, Users, Calendar, CheckCircle,
  XCircle, Pencil, Trash2, Eye, EyeOff, Search, Filter,
  MoreVertical, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight,
  Mail, Phone, MapPin, CreditCard, Clock, Star, Shield,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

// ── API ───────────────────────────────────────────
const agenciesApi = {
  getAll:  ()                        => apiClient.get('/agencies').then((r) => r.data),
  onboard: (data: any)               => apiClient.post('/agencies/onboard', data),
  update:  (id: string, data: any)   => apiClient.patch(`/agencies/${id}`, data),
  delete:  (id: string)              => apiClient.delete(`/agencies/${id}`),
  toggle:  (id: string)              => apiClient.patch(`/agencies/${id}/toggle`),
  getById: (id: string)              => apiClient.get(`/agencies/${id}`).then((r) => r.data.data),
};

// ── Plan config ───────────────────────────────────
const PLAN_CONFIG: Record<string, { label: string; color: string }> = {
  basic:      { label: 'Basic',      color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  pro:        { label: 'Pro',        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  enterprise: { label: 'Enterprise', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
};

// ── Zod schemas ───────────────────────────────────
const onboardSchema = z.object({
  agencyName:     z.string().min(2, 'Nom requis'),
  agencyEmail:    z.string().email('Email invalide'),
  agencyPhone:    z.string().optional(),
  agencyCity:     z.string().optional(),
  agencyPlan:     z.enum(['basic', 'pro', 'enterprise']).default('pro'),
  agencyFee:      z.coerce.number().min(0).default(0),
  adminFirstName: z.string().min(2, 'Prénom requis'),
  adminLastName:  z.string().min(2, 'Nom requis'),
  adminEmail:     z.string().email('Email invalide'),
  adminPassword:  z.string().min(8, 'Min 8 car.').regex(/[A-Z]/, '1 majuscule').regex(/[0-9]/, '1 chiffre'),
  adminPhone:     z.string().optional(),
});

const editSchema = z.object({
  name:            z.string().min(2, 'Nom requis'),
  email:           z.string().email('Email invalide'),
  phone:           z.string().optional(),
  city:            z.string().optional(),
  plan:            z.enum(['basic', 'pro', 'enterprise']),
  monthlyFee:      z.coerce.number().min(0).default(0),
  subscriptionEnd: z.string().optional(),
});

type OnboardForm = z.infer<typeof onboardSchema>;
type EditForm    = z.infer<typeof editSchema>;

const PAGE_SIZE = 10;

// ── Status helper ─────────────────────────────────
function getAgencyStatus(a: any): { label: string; color: string } {
  if (!a.isActive) return { label: 'Suspendue', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
  if (a.subscriptionEnd) {
    const days = Math.ceil((new Date(a.subscriptionEnd).getTime() - Date.now()) / 86400000);
    if (days < 0)  return { label: 'Expirée',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    if (days <= 7) return { label: 'Critique', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
    if (days <= 30)return { label: 'Bientôt',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
  }
  return { label: 'Active', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
}

// ═══════════════════════════════════════════════════
export function AgenciesContent() {
  const { user }       = useAuthStore();
  const queryClient    = useQueryClient();
  const [search, setSearch]           = useState('');
  const [planFilter, setPlanFilter]   = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage]               = useState(1);
  const [openCreate, setOpenCreate]   = useState(false);
  const [openEdit, setOpenEdit]       = useState(false);
  const [editTarget, setEditTarget]   = useState<any>(null);
  const [detailTarget, setDetailTarget] = useState<any>(null);
  const [showPass, setShowPass]       = useState(false);
  const [openMenuId, setOpenMenuId]   = useState<string | null>(null);

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Accès réservé au Super Administrateur
      </div>
    );
  }

  // ── Queries ──
  const { data, isLoading } = useQuery({
    queryKey: ['agencies'],
    queryFn:  agenciesApi.getAll,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['agency-detail', detailTarget?.id],
    queryFn:  () => agenciesApi.getById(detailTarget.id),
    enabled:  !!detailTarget?.id,
  });

  const agencies     = data?.data ?? [];
  const activeCount  = agencies.filter((a: any) => a.isActive).length;
  const expiringCount = agencies.filter((a: any) => {
    if (!a.subscriptionEnd) return false;
    const days = Math.ceil((new Date(a.subscriptionEnd).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  }).length;

  // ── Filtering ──
  const filtered = useMemo(() => {
    return agencies.filter((a: any) => {
      const q = search.toLowerCase();
      const matchSearch = !q || a.name.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) || a.city?.toLowerCase().includes(q);
      const matchPlan   = planFilter === 'all' || a.plan === planFilter;
      const status      = getAgencyStatus(a).label;
      const matchStatus = statusFilter === 'all' ||
        (statusFilter === 'active'    && status === 'Active') ||
        (statusFilter === 'suspended' && status === 'Suspendue') ||
        (statusFilter === 'expiring'  && (status === 'Bientôt' || status === 'Critique')) ||
        (statusFilter === 'expired'   && status === 'Expirée');
      return matchSearch && matchPlan && matchStatus;
    });
  }, [agencies, search, planFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Mutations ──
  const onboardMutation = useMutation({
    mutationFn: (form: OnboardForm) =>
      agenciesApi.onboard({
        agency: { name: form.agencyName, email: form.agencyEmail, phone: form.agencyPhone || undefined, city: form.agencyCity || undefined, plan: form.agencyPlan, monthlyFee: form.agencyFee || 0 },
        admin:  { firstName: form.adminFirstName, lastName: form.adminLastName, email: form.adminEmail, password: form.adminPassword, phone: form.adminPhone || undefined },
      }),
    onSuccess: () => {
      toast({ title: '✅ Agence créée avec succès' });
      queryClient.invalidateQueries({ queryKey: ['agencies'] });
      resetCreate();
      setOpenCreate(false);
    },
    onError: (err: any) =>
      toast({ title: 'Erreur', description: err.response?.data?.message ?? 'Erreur création', variant: 'destructive' }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditForm }) =>
      agenciesApi.update(id, {
        name:            data.name,
        email:           data.email,
        phone:           data.phone || undefined,
        city:            data.city  || undefined,
        plan:            data.plan,
        monthlyFee:      data.monthlyFee,
        subscriptionEnd: data.subscriptionEnd || null,
      }),
    onSuccess: () => {
      toast({ title: '✅ Agence modifiée' });
      queryClient.invalidateQueries({ queryKey: ['agencies'] });
      setOpenEdit(false);
      setEditTarget(null);
    },
    onError: (err: any) =>
      toast({ title: 'Erreur', description: err.response?.data?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => agenciesApi.delete(id),
    onSuccess: () => {
      toast({ title: 'Agence supprimée' });
      queryClient.invalidateQueries({ queryKey: ['agencies'] });
    },
    onError: (err: any) =>
      toast({ title: 'Erreur', description: err.response?.data?.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => agenciesApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agencies'] });
      toast({ title: 'Statut mis à jour' });
    },
  });

  // ── Forms ──
  const { register: registerCreate, handleSubmit: handleCreate, reset: resetCreate, formState: { errors: errorsCreate } } =
    useForm<OnboardForm>({ resolver: zodResolver(onboardSchema), defaultValues: { agencyPlan: 'pro', agencyFee: 0 } });

  const { register: registerEdit, handleSubmit: handleEdit, reset: resetEdit, formState: { errors: errorsEdit } } =
    useForm<EditForm>({ resolver: zodResolver(editSchema) });

  const openEditDialog = (a: any) => {
    setEditTarget(a);
    setOpenMenuId(null);
    resetEdit({
      name:            a.name,
      email:           a.email,
      phone:           a.phone  ?? '',
      city:            a.city   ?? '',
      plan:            a.plan,
      monthlyFee:      Number(a.monthlyFee ?? 0),
      subscriptionEnd: a.subscriptionEnd ? a.subscriptionEnd.split('T')[0] : '',
    });
    setOpenEdit(true);
  };

  const handleDelete = (a: any) => {
    setOpenMenuId(null);
    if (confirm(`Supprimer l'agence "${a.name}" ? Action irréversible.`)) {
      deleteMutation.mutate(a.id);
    }
  };

  const handleToggle = (a: any) => {
    setOpenMenuId(null);
    const action = a.isActive ? 'suspendre' : 'activer';
    if (confirm(`Voulez-vous ${action} l'agence "${a.name}" ?`)) {
      toggleMutation.mutate(a.id);
    }
  };

  // ── Render ──
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des Agences</h1>
          <p className="text-muted-foreground text-sm">
            {agencies.length} agence(s) · {activeCount} active(s)
            {expiringCount > 0 && <span className="text-amber-600 ml-2">· {expiringCount} expirent bientôt</span>}
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />Nouvelle agence</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Créer une nouvelle agence
              </DialogTitle>
            </DialogHeader>
            <OnboardForm
              register={registerCreate}
              handleSubmit={handleCreate}
              errors={errorsCreate}
              mutation={onboardMutation}
              showPass={showPass}
              setShowPass={setShowPass}
              onCancel={() => setOpenCreate(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total"      value={agencies.length}         color="bg-blue-100 text-blue-700"   icon={<Building2 className="w-4 h-4" />} />
        <StatCard label="Actives"    value={activeCount}             color="bg-green-100 text-green-700" icon={<CheckCircle className="w-4 h-4" />} />
        <StatCard label="Inactives"  value={agencies.length - activeCount} color="bg-red-100 text-red-700" icon={<XCircle className="w-4 h-4" />} />
        <StatCard label="Expirent bientôt" value={expiringCount}    color="bg-amber-100 text-amber-700" icon={<Clock className="w-4 h-4" />} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email, ville…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={planFilter}
                onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">Tous les plans</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Active</option>
                <option value="suspended">Suspendue</option>
                <option value="expiring">Expire bientôt</option>
                <option value="expired">Expirée</option>
              </select>
            </div>
            {(search || planFilter !== 'all' || statusFilter !== 'all') && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setSearch(''); setPlanFilter('all'); setStatusFilter('all'); setPage(1); }}>
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune agence trouvée</p>
              {(search || planFilter !== 'all') && <p className="text-xs mt-1">Essayez de modifier vos filtres</p>}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agence</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plan</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statut</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fee/mois</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expiration</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Véhicules</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clients</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rés.</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Créée le</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pageData.map((a: any) => {
                      const planCfg  = PLAN_CONFIG[a.plan] ?? PLAN_CONFIG.basic;
                      const status   = getAgencyStatus(a);
                      const daysLeft = a.subscriptionEnd
                        ? Math.ceil((new Date(a.subscriptionEnd).getTime() - Date.now()) / 86400000)
                        : null;

                      return (
                        <tr key={a.id}
                          className={`group hover:bg-muted/30 transition-colors cursor-pointer ${!a.isActive ? 'opacity-60' : ''}`}
                          onClick={() => setDetailTarget(a)}
                        >
                          {/* Agency name */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{a.name}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  {a.city && <><MapPin className="w-2.5 h-2.5" />{a.city}</>}
                                  {a.city && a.email && ' · '}
                                  {a.email && <span className="truncate max-w-[120px]">{a.email}</span>}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planCfg.color}`}>
                              {planCfg.label}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </td>

                          {/* Fee */}
                          <td className="px-4 py-3 text-right text-sm font-medium">
                            {Number(a.monthlyFee) > 0
                              ? formatMAD(a.monthlyFee)
                              : <span className="text-muted-foreground text-xs">—</span>}
                          </td>

                          {/* Expiration */}
                          <td className="px-4 py-3 text-xs">
                            {a.subscriptionEnd ? (
                              <div>
                                <p>{formatDate(a.subscriptionEnd)}</p>
                                {daysLeft !== null && (
                                  <p className={`text-[10px] font-medium ${
                                    daysLeft < 0 ? 'text-red-500' : daysLeft <= 7 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-600' : 'text-green-600'
                                  }`}>
                                    {daysLeft < 0 ? 'Expiré' : daysLeft === 0 ? 'Aujourd\'hui' : `${daysLeft}j restants`}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Sans limite</span>
                            )}
                          </td>

                          {/* Counts */}
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Car className="w-3 h-3 text-muted-foreground" />
                              {a._count?.cars ?? 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Users className="w-3 h-3 text-muted-foreground" />
                              {a._count?.clients ?? 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              {a._count?.reservations ?? 0}
                            </span>
                          </td>

                          {/* Created at */}
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(a.createdAt)}</td>

                          {/* Actions */}
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => setOpenMenuId(openMenuId === a.id ? null : a.id)}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                              {openMenuId === a.id && (
                                <div className="absolute right-0 top-8 z-50 w-44 bg-background border rounded-lg shadow-lg py-1 text-sm">
                                  <button
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
                                    onClick={() => { setDetailTarget(a); setOpenMenuId(null); }}
                                  >
                                    <Eye className="w-3.5 h-3.5 text-blue-500" />Voir détails
                                  </button>
                                  <button
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
                                    onClick={() => openEditDialog(a)}
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-amber-500" />Modifier
                                  </button>
                                  <button
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
                                    onClick={() => handleToggle(a)}
                                  >
                                    {a.isActive
                                      ? <><ToggleRight className="w-3.5 h-3.5 text-orange-500" />Suspendre</>
                                      : <><ToggleLeft  className="w-3.5 h-3.5 text-green-500" />Activer</>}
                                  </button>
                                  <hr className="my-1 border-border" />
                                  <button
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-destructive/10 text-destructive transition-colors text-left"
                                    onClick={() => handleDelete(a)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />Supprimer
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    {filtered.length} résultat(s) · Page {page}/{totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                      return (
                        <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon"
                          className="h-7 w-7 text-xs" onClick={() => setPage(p)}>
                          {p}
                        </Button>
                      );
                    })}
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-amber-500" />
              Modifier — {editTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit((d) => editMutation.mutate({ id: editTarget?.id, data: d }))}
            className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Nom de l'agence *</Label>
                <Input {...registerEdit('name')} />
                {errorsEdit.name && <p className="text-xs text-destructive">{errorsEdit.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input type="email" {...registerEdit('email')} />
                {errorsEdit.email && <p className="text-xs text-destructive">{errorsEdit.email.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Téléphone</Label>
                <Input {...registerEdit('phone')} />
              </div>
              <div className="space-y-1">
                <Label>Ville</Label>
                <Input {...registerEdit('city')} />
              </div>
              <div className="space-y-1">
                <Label>Plan</Label>
                <select {...registerEdit('plan')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Frais mensuel (MAD)</Label>
                <Input type="number" min={0} step={50} {...registerEdit('monthlyFee')} />
              </div>
              <div className="space-y-1">
                <Label>Date d'expiration</Label>
                <Input type="date" {...registerEdit('subscriptionEnd')} />
                <p className="text-[10px] text-muted-foreground">Laisser vide = sans limite</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpenEdit(false)}>Annuler</Button>
              <Button type="submit" className="flex-1" disabled={editMutation.isPending}>
                {editMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailTarget} onOpenChange={(v) => { if (!v) setDetailTarget(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              {detailTarget?.name}
              {detailTarget && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${getAgencyStatus(detailTarget).color}`}>
                  {getAgencyStatus(detailTarget).label}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailTarget && (
            <AgencyDetail agency={detailTarget} detail={detailData} loading={detailLoading} />
          )}
        </DialogContent>
      </Dialog>

      {/* Click outside menu */}
      {openMenuId && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>{icon}</div>
        <div>
          <p className="text-lg font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AgencyDetail({ agency, detail, loading }: { agency: any; detail: any; loading: boolean }) {
  const planCfg = PLAN_CONFIG[agency.plan] ?? PLAN_CONFIG.basic;
  const status  = getAgencyStatus(agency);

  return (
    <div className="space-y-5 mt-2">
      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <InfoRow icon={<Mail className="w-3.5 h-3.5" />}    label="Email"      value={agency.email} />
        <InfoRow icon={<Phone className="w-3.5 h-3.5" />}   label="Téléphone"  value={agency.phone ?? '—'} />
        <InfoRow icon={<MapPin className="w-3.5 h-3.5" />}  label="Ville"      value={agency.city ?? '—'} />
        <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Créée le" value={agency.createdAt ? new Date(agency.createdAt).toLocaleDateString('fr-FR') : '—'} />
        <InfoRow icon={<Star className="w-3.5 h-3.5" />}    label="Plan"       value={<span className={`text-xs px-1.5 py-0.5 rounded-full ${planCfg.color}`}>{planCfg.label}</span>} />
        <InfoRow icon={<Shield className="w-3.5 h-3.5" />}  label="Statut"     value={<span className={`text-xs px-1.5 py-0.5 rounded-full ${status.color}`}>{status.label}</span>} />
        <InfoRow icon={<CreditCard className="w-3.5 h-3.5" />} label="Frais/mois" value={Number(agency.monthlyFee) > 0 ? formatMAD(agency.monthlyFee) : '—'} />
        <InfoRow icon={<Clock className="w-3.5 h-3.5" />}   label="Expiration" value={agency.subscriptionEnd ? new Date(agency.subscriptionEnd).toLocaleDateString('fr-FR') : 'Sans limite'} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-muted rounded-xl p-3">
          <p className="text-2xl font-bold">{agency._count?.cars ?? 0}</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><Car className="w-3 h-3" />Véhicules</p>
        </div>
        <div className="bg-muted rounded-xl p-3">
          <p className="text-2xl font-bold">{agency._count?.clients ?? 0}</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><Users className="w-3 h-3" />Clients</p>
        </div>
        <div className="bg-muted rounded-xl p-3">
          <p className="text-2xl font-bold">{agency._count?.reservations ?? 0}</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><Calendar className="w-3 h-3" />Réservations</p>
        </div>
      </div>

      {/* Users */}
      {loading ? (
        <div className="h-16 bg-muted animate-pulse rounded-xl" />
      ) : detail?.users?.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />Utilisateurs ({detail.users.length})
          </p>
          <div className="space-y-2">
            {detail.users.slice(0, 5).map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                  {u.firstName?.[0]}{u.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{u.firstName} {u.lastName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 bg-background border rounded-full text-muted-foreground">
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-2.5 bg-muted/30 rounded-lg">
      <span className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

function OnboardForm({ register, handleSubmit, errors, mutation, showPass, setShowPass, onCancel }: any) {
  return (
    <form onSubmit={handleSubmit((d: OnboardForm) => mutation.mutate(d))} className="space-y-5 mt-2">
      {/* Agency section */}
      <div>
        <p className="text-sm font-semibold text-primary border-b pb-1.5 flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4" />Informations de l'agence
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <Label>Nom *</Label>
            <Input placeholder="Auto Maroc Location" {...register('agencyName')} />
            {errors.agencyName && <p className="text-xs text-destructive">{errors.agencyName.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Email *</Label>
            <Input type="email" placeholder="contact@agence.ma" {...register('agencyEmail')} />
            {errors.agencyEmail && <p className="text-xs text-destructive">{errors.agencyEmail.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Téléphone</Label>
            <Input placeholder="0522000000" {...register('agencyPhone')} />
          </div>
          <div className="space-y-1">
            <Label>Ville</Label>
            <Input placeholder="Casablanca" {...register('agencyCity')} />
          </div>
          <div className="space-y-1">
            <Label>Plan</Label>
            <select {...register('agencyPlan')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Frais mensuel (MAD)</Label>
            <Input type="number" min={0} step={50} placeholder="0" {...register('agencyFee')} />
            <p className="text-xs text-muted-foreground">Montant facturé à cette agence chaque mois</p>
          </div>
        </div>
      </div>

      {/* Admin section */}
      <div>
        <p className="text-sm font-semibold text-primary border-b pb-1.5 flex items-center gap-2 mb-3">
          <Users className="w-4 h-4" />Administrateur de l'agence
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Prénom *</Label>
            <Input placeholder="Ahmed" {...register('adminFirstName')} />
            {errors.adminFirstName && <p className="text-xs text-destructive">{errors.adminFirstName.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Nom *</Label>
            <Input placeholder="Benali" {...register('adminLastName')} />
            {errors.adminLastName && <p className="text-xs text-destructive">{errors.adminLastName.message}</p>}
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Email admin *</Label>
            <Input type="email" placeholder="admin@agence.ma" {...register('adminEmail')} />
            {errors.adminEmail && <p className="text-xs text-destructive">{errors.adminEmail.message}</p>}
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Mot de passe *</Label>
            <div className="relative">
              <Input type={showPass ? 'text' : 'password'} placeholder="Min 8 car., 1 majuscule, 1 chiffre"
                {...register('adminPassword')} className="pr-10" />
              <button type="button" onClick={() => setShowPass((p: boolean) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.adminPassword && <p className="text-xs text-destructive">{errors.adminPassword.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Téléphone admin</Label>
            <Input placeholder="0612345678" {...register('adminPhone')} />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Annuler</Button>
        <Button type="submit" className="flex-1" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Créer l'agence
        </Button>
      </div>
    </form>
  );
}
