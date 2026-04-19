'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import apiClient from '@/lib/api/client';
import { formatDate, formatMAD, getInitials } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  Search, Users, ShieldAlert, Loader2, Trash2,
  User, Phone, Mail, MapPin, CreditCard, Car, Calendar, FileText, Pencil, X, Save, Printer, ShieldBan, ShieldCheck,
} from 'lucide-react';
import { ClientForm } from './client-form';

const clientsApi = {
  getAll:   (p: any)              => apiClient.get('/clients', { params: p }),
  getById:  (id: string)          => apiClient.get(`/clients/${id}`),
  getStats: ()                    => apiClient.get('/clients/stats'),
  update:   (id: string, d: any)  => apiClient.patch(`/clients/${id}`, d),
  delete:   (id: string)          => apiClient.delete(`/clients/${id}`),
};

// ── Client Detail Modal ──────────────────────────────────────────────
function ClientDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['client-detail', id],
    queryFn: () => clientsApi.getById(id).then((r) => r.data.data),
    retry: false,
  });

  const c = data;

  const handlePrint = (client: any) => {
    const fd = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA') : '—';
    const statusLabels: Record<string, string> = {
      ACTIVE: 'En cours', CONFIRMED: 'Confirmée',
      COMPLETED: 'Terminée', CANCELLED: 'Annulée', PENDING: 'En attente',
    };
    const reservationsHtml = (client.reservations ?? []).map((r: any) => `
      <tr>
        <td>${r.car.brand} ${r.car.model}</td>
        <td>${r.car.licensePlate}</td>
        <td>${fd(r.startDate)}</td>
        <td>${fd(r.endDate)}</td>
        <td>${statusLabels[r.status] ?? r.status}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Fiche Client — ${client.firstName} ${client.lastName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 14mm; }
  @page { size: A4; margin: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  h1 { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #222; padding-bottom: 8px; margin-bottom: 12px; }
  .badge { display: inline-block; background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; padding: 2px 8px; font-size: 10px; margin-right: 4px; }
  .badge.red { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }
  .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; background: #e8e8e8; padding: 3px 6px; border-left: 3px solid #333; margin: 10px 0 5px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
  .field { display: flex; gap: 6px; padding: 3px 0; border-bottom: 1px dotted #ddd; }
  .field-label { color: #666; white-space: nowrap; min-width: 110px; font-size: 10px; }
  .field-value { font-weight: 600; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { background: #f0f0f0; padding: 4px 6px; text-align: left; font-size: 9px; border: 1px solid #ccc; }
  td { padding: 3px 6px; font-size: 10px; border: 1px solid #ddd; }
  .footer { margin-top: 16px; border-top: 1px solid #ccc; padding-top: 6px; font-size: 9px; color: #888; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>Fiche Client</h1>
    <div style="margin-top:4px;">
      ${client.blacklisted ? '<span class="badge red">⛔ Liste noire</span>' : ''}
      <span class="badge">${client.totalRentals} location(s)</span>
      <span class="badge">${Number(client.totalSpent).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD dépensés</span>
    </div>
  </div>
  <div style="text-align:right; font-size:10px; color:#666;">
    <div>Score de risque : <strong>${client.riskScore}/100</strong></div>
    <div>Imprimé le : ${new Date().toLocaleDateString('fr-MA')}</div>
  </div>
</div>

<div class="section-title">Informations personnelles</div>
<div class="grid">
  <div class="field"><span class="field-label">Nom complet</span><span class="field-value">${client.firstName} ${client.lastName}</span></div>
  <div class="field"><span class="field-label">CIN</span><span class="field-value">${client.cin}</span></div>
  <div class="field"><span class="field-label">N° Passeport</span><span class="field-value">${client.passportNumber ?? '—'}</span></div>
  <div class="field"><span class="field-label">Téléphone</span><span class="field-value">${client.phone}</span></div>
  <div class="field"><span class="field-label">Email</span><span class="field-value">${client.email ?? '—'}</span></div>
  <div class="field"><span class="field-label">Nationalité</span><span class="field-value">${client.nationality ?? '—'}</span></div>
  <div class="field"><span class="field-label">Ville</span><span class="field-value">${client.city ?? '—'}</span></div>
  <div class="field"><span class="field-label">Adresse</span><span class="field-value">${client.address ?? '—'}</span></div>
  <div class="field"><span class="field-label">N° Permis</span><span class="field-value">${client.licenseNumber ?? '—'}</span></div>
  <div class="field"><span class="field-label">Client depuis</span><span class="field-value">${fd(client.createdAt)}</span></div>
  ${client.notes ? `<div class="field" style="grid-column:span 2"><span class="field-label">Notes</span><span class="field-value">${client.notes}</span></div>` : ''}
</div>

${(client.reservations ?? []).length > 0 ? `
<div class="section-title">Historique des locations</div>
<table>
  <thead>
    <tr><th>Véhicule</th><th>Immatriculation</th><th>Départ</th><th>Retour</th><th>Statut</th></tr>
  </thead>
  <tbody>${reservationsHtml}</tbody>
</table>` : ''}

<div class="footer">Document généré automatiquement — Kharrazi Fleet</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=800,height=1100');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const updateMutation = useMutation({
    mutationFn: (d: any) => clientsApi.update(id, {
      firstName:      d.firstName      || undefined,
      lastName:       d.lastName       || undefined,
      cin:            d.cin            || undefined,
      phone:          d.phone          || undefined,
      email:          d.email          || null,
      passportNumber: d.passportNumber || null,
      city:           d.city           || null,
      address:        d.address        || null,
      licenseNumber:  d.licenseNumber  || null,
      nationality:    d.nationality    || null,
      notes:          d.notes          || null,
    }),
    onSuccess: () => {
      toast({ title: 'Client modifié avec succès' });
      qc.invalidateQueries({ queryKey: ['client-detail', id] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      setEditing(false);
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.response?.data?.message ?? 'Erreur lors de la modification', variant: 'destructive' });
    },
  });

  const blacklistMutation = useMutation({
    mutationFn: (blacklisted: boolean) => clientsApi.update(id, { blacklisted }),
    onSuccess: (_, blacklisted) => {
      toast({ title: blacklisted ? '⛔ Client ajouté à la liste noire' : '✅ Client retiré de la liste noire' });
      qc.invalidateQueries({ queryKey: ['client-detail', id] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['clients-stats'] });
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.response?.data?.message ?? 'Erreur', variant: 'destructive' });
    },
  });

  const { register, handleSubmit, reset: resetForm } = useForm();

  useEffect(() => {
    if (c && editing) {
      resetForm({
        firstName:      c.firstName      ?? '',
        lastName:       c.lastName       ?? '',
        cin:            c.cin            ?? '',
        phone:          c.phone          ?? '',
        email:          c.email          ?? '',
        passportNumber: c.passportNumber ?? '',
        city:           c.city           ?? '',
        address:        c.address        ?? '',
        licenseNumber:  c.licenseNumber  ?? '',
        nationality:    c.nationality    ?? '',
        notes:          c.notes          ?? '',
      });
    }
  }, [editing, c]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>{editing ? 'Modifier le client' : 'Fiche client'}</DialogTitle>
            {!isLoading && c && !editing && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePrint(c)}>
                  <Printer className="w-3.5 h-3.5 mr-1.5" />Imprimer
                </Button>
                <Button
                  variant="outline" size="sm"
                  className={c.blacklisted
                    ? 'border-green-400 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-500/10'
                    : 'border-red-400 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'}
                  disabled={blacklistMutation.isPending}
                  onClick={() => {
                    const msg = c.blacklisted
                      ? `Retirer ${c.firstName} ${c.lastName} de la liste noire ?`
                      : `Ajouter ${c.firstName} ${c.lastName} à la liste noire ?`;
                    if (confirm(msg)) blacklistMutation.mutate(!c.blacklisted);
                  }}
                >
                  {c.blacklisted
                    ? <><ShieldCheck className="w-3.5 h-3.5 mr-1.5" />Retirer liste noire</>
                    : <><ShieldBan className="w-3.5 h-3.5 mr-1.5" />Liste noire</>}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />Modifier
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError || !c ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Impossible de charger les données du client.
          </div>
        ) : editing ? (
          /* ── Edit form ── */
          <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Prénom *</Label><Input {...register('firstName')} /></div>
              <div className="space-y-1"><Label>Nom *</Label><Input {...register('lastName')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>CIN *</Label><Input {...register('cin')} /></div>
              <div className="space-y-1"><Label>N° Passeport</Label><Input {...register('passportNumber')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Téléphone *</Label><Input {...register('phone')} /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" {...register('email')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Ville</Label><Input {...register('city')} /></div>
              <div className="space-y-1"><Label>Nationalité</Label><Input {...register('nationality')} /></div>
            </div>
            <div className="space-y-1"><Label>Adresse</Label><Input {...register('address')} /></div>
            <div className="space-y-1"><Label>N° Permis</Label><Input {...register('licenseNumber')} /></div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea {...register('notes')} rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex gap-2 pt-1 border-t">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                <X className="w-4 h-4 mr-1" />Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Enregistrer
              </Button>
            </div>
          </form>
        ) : (
          /* ── View mode ── */
          <div className="space-y-5 pt-1">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                {getInitials(c.firstName, c.lastName)}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold">{c.firstName} {c.lastName}</h2>
                <div className="flex flex-wrap gap-2 mt-1">
                  {c.blacklisted && <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium">⛔ Liste noire</span>}
                  <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{c.totalRentals} location(s)</span>
                  <span className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 rounded-full px-2 py-0.5 font-medium">{formatMAD(c.totalSpent)} dépensés</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground mb-1">Score de risque</p>
                <div className="flex items-center gap-2 justify-end">
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${c.riskScore > 70 ? 'bg-red-500' : c.riskScore > 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${c.riskScore}%` }} />
                  </div>
                  <span className="text-sm font-bold">{c.riskScore}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={CreditCard} label="CIN" value={c.cin} mono />
              {c.passportNumber && <InfoRow icon={FileText} label="Passeport" value={c.passportNumber} mono />}
              <InfoRow icon={Phone} label="Téléphone" value={c.phone} />
              {c.email && <InfoRow icon={Mail} label="Email" value={c.email} />}
              {c.city && <InfoRow icon={MapPin} label="Ville" value={c.city} />}
              {c.address && <InfoRow icon={MapPin} label="Adresse" value={c.address} />}
              {c.licenseNumber && <InfoRow icon={Car} label="N° Permis" value={c.licenseNumber} mono />}
              {c.nationality && <InfoRow icon={User} label="Nationalité" value={c.nationality} />}
              <InfoRow icon={Calendar} label="Client depuis" value={formatDate(c.createdAt)} />
              {c.notes && <InfoRow icon={FileText} label="Notes" value={c.notes} />}
            </div>

            {c.reservations?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />Historique des locations
                </h3>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {c.reservations.map((r: any) => {
                    const statusColors: Record<string, string> = {
                      ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
                      CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
                      COMPLETED: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-300',
                      CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
                      PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
                    };
                    const statusLabels: Record<string, string> = {
                      ACTIVE: 'En cours', CONFIRMED: 'Confirmée',
                      COMPLETED: 'Terminée', CANCELLED: 'Annulée', PENDING: 'En attente',
                    };
                    return (
                      <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{r.car.brand} {r.car.model}</p>
                          <p className="text-muted-foreground font-mono">{r.car.licensePlate}</p>
                        </div>
                        <div className="text-muted-foreground text-right shrink-0">
                          <p>{formatDate(r.startDate)}</p>
                          <p>→ {formatDate(r.endDate)}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 font-medium shrink-0 ${statusColors[r.status] ?? ''}`}>
                          {statusLabels[r.status] ?? r.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-1 border-t">
              <Button variant="outline" onClick={onClose}>Fermer</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, value, mono }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border text-sm">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`font-medium truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────
export function ClientsContent() {
  const queryClient = useQueryClient();
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { page, search }],
    queryFn: () => clientsApi.getAll({ page, search: search || undefined }).then((r) => r.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['clients-stats'],
    queryFn: () => clientsApi.getStats().then((r) => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => {
      toast({ title: 'Client supprimé' });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-stats'] });
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.response?.data?.message ?? 'Impossible de supprimer', variant: 'destructive' });
    },
  });

  const clients = data?.data ?? [];
  const meta    = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">{statsData?.total ?? 0} client(s) enregistré(s)</p>
        </div>
        <ClientForm />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statsData?.total ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total clients</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statsData?.blacklisted ?? 0}</p>
              <p className="text-xs text-muted-foreground">Liste noire</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Nom, CIN, téléphone…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Client Table */}
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
                    <th className="text-left p-4 font-medium text-muted-foreground">Client</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">CIN</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Téléphone</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Passeport</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Locations</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Total dépensé</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Risque</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-muted-foreground">
                        Aucun client trouvé
                      </td>
                    </tr>
                  ) : clients.map((client: any) => (
                    <tr key={client.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {getInitials(client.firstName, client.lastName)}
                          </div>
                          <div>
                            <p className="font-medium">{client.firstName} {client.lastName}</p>
                            {client.blacklisted && (
                              <span className="text-xs text-red-600 font-medium">⛔ Liste noire</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs">{client.cin}</td>
                      <td className="p-4 text-muted-foreground">{client.phone}</td>
                      <td className="p-4">
                        {client.passportNumber
                          ? <span className="font-mono text-xs">{client.passportNumber}</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="p-4">{client.totalRentals}</td>
                      <td className="p-4 font-medium">{formatMAD(client.totalSpent)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-16">
                            <div
                              className={`h-full rounded-full ${client.riskScore > 70 ? 'bg-red-500' : client.riskScore > 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${client.riskScore}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{client.riskScore}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setSelectedId(client.id)}
                          >
                            Voir
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => {
                              if (confirm(`Supprimer ${client.firstName} ${client.lastName} ?`)) {
                                deleteMutation.mutate(client.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
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
            {meta.total} client(s) · Page {meta.page}/{meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" disabled={page === meta.totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      {/* Client detail modal */}
      {selectedId && (
        <ClientDetailModal id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
