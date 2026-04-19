'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { maintenanceApi } from '@/lib/api/maintenance';
import { carsApi } from '@/lib/api/cars';
import { formatDate, formatMAD } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Wrench, Car, AlertTriangle, CheckCircle, Clock, Loader2,
  Search, Plus, Pencil, Trash2, FileText, Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  VIDANGE:          'Vidange',
  PNEUS:            'Pneus',
  REPARATION:       'Réparation',
  VISITE_TECHNIQUE: 'Visite technique',
  CHECK:            'Inspection',
  AUTRE:            'Autre',
};

const TYPE_COLORS: Record<string, string> = {
  VIDANGE:          'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  PNEUS:            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  REPARATION:       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  VISITE_TECHNIQUE: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  CHECK:            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  AUTRE:            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ComponentType<any> }> = {
  PENDING:     { label: 'À faire',      badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: Clock },
  IN_PROGRESS: { label: 'En cours',     badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',         icon: Wrench },
  COMPLETED:   { label: 'Terminée',     badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',     icon: CheckCircle },
};

const HAS_EXPIRY = ['VISITE_TECHNIQUE'];

// ── Helpers ────────────────────────────────────────────
function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function ExpiryStatus({ date }: { date: string | null | undefined }) {
  const days = daysUntil(date);
  if (days === null) return null;
  if (days < 0)   return <span className="text-xs font-medium text-red-600 dark:text-red-400">Expirée ({Math.abs(days)}j)</span>;
  if (days <= 7)  return <span className="text-xs font-medium text-orange-500">⚠ Expire dans {days}j</span>;
  if (days <= 30) return <span className="text-xs text-amber-600">Expire dans {days}j</span>;
  return <span className="text-xs text-green-600 dark:text-green-400">Valide — {formatDate(date!)}</span>;
}

// ── Form schema ────────────────────────────────────────
const formSchema = z.object({
  carId:          z.string().min(1, 'Véhicule requis'),
  type:           z.string().min(1, 'Type requis'),
  date:           z.string().min(1, 'Date requise'),
  expirationDate: z.string().optional(),
  mileage:        z.string().optional(),
  cost:           z.string().optional(),
  status:         z.string().default('PENDING'),
  notes:          z.string().optional(),
});
type FormData = z.infer<typeof formSchema>;

// ── Doc fields config ──────────────────────────────────
const DOC_FIELDS = [
  { key: 'carteGriseDate',     label: 'Carte grise',              expiry: false },
  { key: 'insuranceExpiry',    label: 'Assurance',                expiry: true  },
  { key: 'technicalExpiry',    label: 'Visite technique',         expiry: true  },
  { key: 'vignetteExpiry',     label: 'Vignette',                 expiry: true  },
  { key: 'autorisationExpiry', label: 'Autorisation circulation', expiry: true  },
] as const;

// ── Main Content ───────────────────────────────────────
export function MaintenanceContent() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'tasks' | 'docs'>('tasks');
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [typeFilter, setType]     = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editTask, setEditTask]   = useState<any>(null);

  // Maintenance tasks (filtered to cars in MAINTENANCE status OR all)
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['maintenance', { status: statusFilter, type: typeFilter }],
    queryFn: () => maintenanceApi.getAll({
      status: statusFilter || undefined,
      type:   typeFilter   || undefined,
    }).then((r) => r.data.data ?? []),
  });

  // All cars for selects + alerts
  const { data: allCars = [] } = useQuery({
    queryKey: ['cars-for-maintenance'],
    queryFn:  () => carsApi.getAll({ limit: 500 }).then((r) => r.data.data ?? []),
    staleTime: 60_000,
  });

  // Cars currently in MAINTENANCE status
  const maintenanceCars = (allCars as any[]).filter((c: any) => c.status === 'MAINTENANCE');

  const deleteMutation = useMutation({
    mutationFn: (id: string) => maintenanceApi.delete(id),
    onSuccess: () => {
      toast({ title: 'Tâche supprimée' });
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      queryClient.invalidateQueries({ queryKey: ['cars-stats'] });
    },
  });

  // Document alerts from all cars
  const alerts = (allCars as any[]).filter((c: any) => {
    const ins = daysUntil(c.insuranceExpiry);
    const tec = daysUntil(c.technicalExpiry);
    const nxt = daysUntil(c.nextMaintenance);
    return (ins !== null && ins <= 30) || (tec !== null && tec <= 30) || (nxt !== null && nxt <= 7);
  });

  // Maintenance task alerts (expiration)
  const taskAlerts = (tasks as any[]).filter((t: any) => {
    const d = daysUntil(t.expirationDate);
    return d !== null && d <= 30 && t.status !== 'COMPLETED';
  });

  const filtered = (tasks as any[]).filter((t: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${t.car?.brand} ${t.car?.model} ${t.car?.licensePlate}`.toLowerCase().includes(q);
  });

  const pendingCount     = (tasks as any[]).filter((t: any) => t.status === 'PENDING').length;
  const inProgressCount  = (tasks as any[]).filter((t: any) => t.status === 'IN_PROGRESS').length;
  const completedCount   = (tasks as any[]).filter((t: any) => t.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Maintenance</h1>
          <p className="text-muted-foreground">Gestion des tâches de maintenance de la flotte</p>
        </div>
        <Button onClick={() => { setEditTask(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle tâche
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button onClick={() => setActiveTab('tasks')}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            activeTab === 'tasks' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}>
          <Wrench className="w-4 h-4" />Tâches
        </button>
        <button onClick={() => setActiveTab('docs')}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            activeTab === 'docs' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}>
          <FileText className="w-4 h-4" />Documents
        </button>
      </div>

      {activeTab === 'docs' && (
        <DocumentsTab cars={allCars as any[]} queryClient={queryClient} />
      )}

      {activeTab !== 'docs' && (
      <>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-orange-200 dark:border-orange-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">À faire</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Wrench className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground">En cours</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Terminées</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(maintenanceCars.length > 0 ? 'border-yellow-200 dark:border-yellow-900' : '')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
              <Car className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{maintenanceCars.length}</p>
              <p className="text-xs text-muted-foreground">Véhicules en maintenance</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(taskAlerts.length > 0 || alerts.length > 0) && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="w-4 h-4" />
              Alertes — Expirations à venir
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5">
            {taskAlerts.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-xs bg-white dark:bg-background rounded-lg px-3 py-2 border">
                <span className="font-medium">{t.car?.brand} {t.car?.model} — {TYPE_LABELS[t.type]}</span>
                <ExpiryStatus date={t.expirationDate} />
              </div>
            ))}
            {alerts.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between text-xs bg-white dark:bg-background rounded-lg px-3 py-2 border">
                <span className="font-medium">{c.brand} {c.model} — {c.licensePlate}</span>
                <div className="flex gap-3">
                  {daysUntil(c.insuranceExpiry) !== null && daysUntil(c.insuranceExpiry)! <= 30 && (
                    <ExpiryStatus date={c.insuranceExpiry} />
                  )}
                  {daysUntil(c.technicalExpiry) !== null && daysUntil(c.technicalExpiry)! <= 30 && (
                    <ExpiryStatus date={c.technicalExpiry} />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Marque, modèle, plaque…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {[{ label: 'Tous', value: '' }, ...Object.entries(STATUS_CONFIG).map(([v, c]) => ({ label: c.label, value: v }))].map((t) => (
            <button key={t.value} onClick={() => setStatus(t.value)}
              className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                statusFilter === t.value ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button onClick={() => setType('')}
            className={cn('px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
              typeFilter === '' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}>Tous types</button>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <button key={v} onClick={() => setType(v === typeFilter ? '' : v)}
              className={cn('px-2 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                typeFilter === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Véhicule</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Coût</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Statut</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-muted-foreground">
                        <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        Aucune tâche de maintenance
                      </td>
                    </tr>
                  ) : filtered.map((t: any) => {
                    const sc = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.PENDING;
                    const Icon = sc.icon;
                    return (
                      <tr key={t.id} className="hover:bg-muted/50 transition-colors">
                        <td className="p-4">
                          <p className="font-medium">{t.car?.brand} {t.car?.model}</p>
                          <p className="text-xs text-muted-foreground font-mono">{t.car?.licensePlate}</p>
                        </td>
                        <td className="p-4">
                          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', TYPE_COLORS[t.type])}>
                            {TYPE_LABELS[t.type] ?? t.type}
                          </span>
                        </td>
                        <td className="p-4 text-sm">{formatDate(t.date)}</td>
                        <td className="p-4 text-sm font-medium">
                          {t.cost ? formatMAD(t.cost) : '—'}
                        </td>
                        <td className="p-4">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', sc.badge)}>
                            <Icon className="w-3 h-3" />{sc.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1.5 justify-end">
                            <Button variant="outline" size="sm" className="h-7 px-2"
                              onClick={() => { setEditTask(t); setShowForm(true); }}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button variant="outline" size="sm"
                              className="h-7 px-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => { if (confirm('Supprimer cette tâche ?')) deleteMutation.mutate(t.id); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
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

      {/* Form dialog */}
      {showForm && (
        <MaintenanceForm
          task={editTask}
          cars={allCars as any[]}
          onClose={() => { setShowForm(false); setEditTask(null); }}
          onSaved={() => {
            setShowForm(false);
            setEditTask(null);
            queryClient.invalidateQueries({ queryKey: ['maintenance'] });
          }}
        />
      )}
      </>
      )}
    </div>
  );
}

// ── Documents Tab ──────────────────────────────────────
function DocumentsTab({ cars, queryClient }: { cars: any[]; queryClient: any }) {
  const [search, setSearch]     = useState('');
  const [editCar, setEditCar]   = useState<any>(null);
  const [editDates, setEditDates] = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState(false);

  const activeCars = cars.filter((c: any) => c.isActive !== false);

  const filtered = activeCars.filter((c: any) =>
    !search || `${c.brand} ${c.model} ${c.licensePlate}`.toLowerCase().includes(search.toLowerCase())
  );

  // Count alerts across all cars
  const alertCount = activeCars.reduce((n: number, c: any) => {
    return n + DOC_FIELDS.filter((f) => {
      if (!f.expiry) return false;
      const d = daysUntil((c as any)[f.key]);
      return d !== null && d <= 30;
    }).length;
  }, 0);

  function startEdit(car: any) {
    const init: Record<string, string> = {};
    DOC_FIELDS.forEach((f) => {
      const val = car[f.key];
      init[f.key] = val ? new Date(val).toISOString().slice(0, 10) : '';
    });
    setEditDates(init);
    setEditCar(car);
  }

  async function saveEdit() {
    if (!editCar) return;
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      DOC_FIELDS.forEach((f) => {
        payload[f.key] = editDates[f.key] || null;
      });
      await carsApi.update(editCar.id, payload);
      toast({ title: 'Documents mis à jour' });
      queryClient.invalidateQueries({ queryKey: ['cars-for-maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      setEditCar(null);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function DocBadge({ value, expiry }: { value: string | null | undefined; expiry: boolean }) {
    if (!value) return <span className="text-xs text-muted-foreground">—</span>;
    if (!expiry) return <span className="text-xs text-foreground">{formatDate(value)}</span>;
    const days = daysUntil(value);
    if (days === null) return <span className="text-xs text-muted-foreground">—</span>;
    if (days < 0)   return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Expirée</span>;
    if (days <= 7)  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">⚠ {days}j</span>;
    if (days <= 30) return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{days}j</span>;
    return <span className="text-xs text-green-600 dark:text-green-400">{formatDate(value)}</span>;
  }

  return (
    <div className="space-y-4">
      {/* Alert summary */}
      {alertCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
          <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <p className="text-sm text-orange-700 dark:text-orange-400">
            <span className="font-bold">{alertCount}</span> document{alertCount > 1 ? 's' : ''} expiré{alertCount > 1 ? 's' : ''} ou à renouveler dans les 30 jours
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Marque, modèle, plaque…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-4 font-medium text-muted-foreground">Véhicule</th>
                  {DOC_FIELDS.map((f) => (
                    <th key={f.key} className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">{f.label}</th>
                  ))}
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={DOC_FIELDS.length + 2} className="py-16 text-center text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      Aucun véhicule
                    </td>
                  </tr>
                ) : filtered.map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-4">
                      <p className="font-medium">{c.brand} {c.model}</p>
                      <p className="text-xs text-muted-foreground font-mono">{c.licensePlate}</p>
                    </td>
                    {editCar?.id === c.id ? (
                      DOC_FIELDS.map((f) => (
                        <td key={f.key} className="p-2">
                          <Input type="date" className="h-8 text-xs w-36"
                            value={editDates[f.key] ?? ''}
                            onChange={(e) => setEditDates((prev) => ({ ...prev, [f.key]: e.target.value }))} />
                        </td>
                      ))
                    ) : (
                      DOC_FIELDS.map((f) => (
                        <td key={f.key} className="p-3">
                          <DocBadge value={c[f.key]} expiry={f.expiry} />
                        </td>
                      ))
                    )}
                    <td className="p-3">
                      {editCar?.id === c.id ? (
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-7 px-2" onClick={saveEdit} disabled={saving}>
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditCar(null)}>✕</Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => startEdit(c)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Expiré</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Expire ≤ 7j</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Expire ≤ 30j</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Valide</span>
      </div>
    </div>
  );
}

// ── Form ───────────────────────────────────────────────
function MaintenanceForm({
  task, cars, onClose, onSaved,
}: {
  task: any; cars: any[]; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!task;
  const queryClient = useQueryClient();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      carId:          task?.carId          ?? '',
      type:           task?.type           ?? '',
      date:           task?.date           ? task.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      expirationDate: task?.expirationDate ? task.expirationDate.slice(0, 10) : '',
      mileage:        task?.mileage        ? String(task.mileage) : '',
      cost:           task?.cost           ? String(task.cost) : '',
      status:         task?.status         ?? 'PENDING',
      notes:          task?.notes          ?? '',
    },
  });

  const selectedType = watch('type');
  const needsExpiry  = HAS_EXPIRY.includes(selectedType);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        carId:          data.carId,
        type:           data.type,
        date:           data.date,
        expirationDate: data.expirationDate || undefined,
        mileage:        data.mileage ? parseInt(data.mileage) : undefined,
        cost:           data.cost ? parseFloat(data.cost) : undefined,
        status:         data.status,
        notes:          data.notes || undefined,
      };
      return isEdit
        ? maintenanceApi.update(task.id, payload)
        : maintenanceApi.create(payload);
    },
    onSuccess: () => {
      toast({ title: isEdit ? 'Tâche mise à jour' : 'Tâche créée' });
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      queryClient.invalidateQueries({ queryKey: ['cars-stats'] });
      onSaved();
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.response?.data?.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la tâche' : 'Nouvelle tâche de maintenance'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          {/* Vehicle */}
          <div className="space-y-1.5">
            <Label>Véhicule <span className="text-destructive">*</span></Label>
            <select {...register('carId')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Sélectionner un véhicule…</option>
              {cars.filter((c: any) => c.isActive !== false).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.brand} {c.model} — {c.licensePlate}
                  {c.status === 'MAINTENANCE' ? ' 🔧' : ''}
                </option>
              ))}
            </select>
            {errors.carId && <p className="text-xs text-destructive">{errors.carId.message}</p>}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Type <span className="text-destructive">*</span></Label>
            <select {...register('type')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Sélectionner un type…</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
          </div>

          {/* Date + Expiry */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date <span className="text-destructive">*</span></Label>
              <Input type="date" {...register('date')} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
            {needsExpiry && (
              <div className="space-y-1.5">
                <Label>Date d'expiration</Label>
                <Input type="date" {...register('expirationDate')} />
              </div>
            )}
          </div>

          {/* Mileage + Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kilométrage</Label>
              <Input type="number" placeholder="ex: 85000" {...register('mileage')} />
            </div>
            <div className="space-y-1.5">
              <Label>Coût (MAD)</Label>
              <Input type="number" step="0.01" placeholder="ex: 350" {...register('cost')} />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Statut</Label>
            <select {...register('status')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                <option key={v} value={v}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea {...register('notes')} rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              placeholder="Observations, pièces remplacées…" />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
