'use client';

import { useState } from 'react';
import { downloadPdf } from '@/lib/pdf';
import { useQuery } from '@tanstack/react-query';
import { reservationsApi } from '@/lib/api/reservations';
import { formatDate, formatMAD, formatDateTime } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2, Search, Receipt, Printer, CheckCircle2,
  Clock, XCircle, User, Car, Calendar, CreditCard, Download,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

const STATUS_TABS = [
  { label: 'Toutes',      value: '' },
  { label: 'En cours',    value: 'ACTIVE' },
  { label: 'Terminées',   value: 'COMPLETED' },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces', CARD: 'Carte', BANK_TRANSFER: 'Virement', CHEQUE: 'Chèque',
};
const PAYMENT_TYPE_LABELS: Record<string, string> = {
  RENTAL: 'Location', DEPOSIT: 'Caution', EXTRA: 'Supplément', REFUND: 'Remboursement',
};

export function InvoicesContent() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { page, search, status }],
    queryFn: () =>
      reservationsApi.getAll({
        page,
        search: search || undefined,
        status: status || undefined,
        limit: 15,
        isContract: true,
      }).then((r) => r.data),
  });

  const reservations = data?.data ?? [];
  const meta = data?.meta;

  // Stats
  const paidCount     = reservations.filter((r: any) => r.payments?.some((p: any) => p.status === 'PAID')).length;
  const pendingCount  = reservations.filter((r: any) => !r.payments?.some((p: any) => p.status === 'PAID')).length;
  const totalRevenue  = reservations.reduce((sum: number, r: any) => {
    const paid = r.payments?.filter((p: any) => p.status === 'PAID' && p.type === 'RENTAL')
      .reduce((s: number, p: any) => s + Number(p.amount), 0) ?? 0;
    return sum + paid;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Facturation</h1>
        <p className="text-muted-foreground">Factures générées depuis les réservations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{paidCount}</p>
              <p className="text-xs text-muted-foreground">Factures payées</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">En attente</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{formatMAD(totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Revenus perçus</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
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

      {/* Table */}
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
                    <th className="text-left p-4 font-medium text-muted-foreground">N° Facture</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Client</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Véhicule</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Période</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Paiement</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Montant</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reservations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-muted-foreground">
                        <Receipt className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                        Aucune facture trouvée
                      </td>
                    </tr>
                  ) : reservations.map((r: any) => {
                    const paid = r.payments?.some((p: any) => p.status === 'PAID');
                    return (
                      <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                        <td className="p-4 font-mono text-xs font-medium">
                          FAC-{r.reservationNumber?.replace('REF-', '')}
                        </td>
                        <td className="p-4">
                          <p className="font-medium">{r.client.firstName} {r.client.lastName}</p>
                          <p className="text-xs text-muted-foreground">{r.client.phone}</p>
                        </td>
                        <td className="p-4">
                          <p>{r.car.brand} {r.car.model}</p>
                          <p className="text-xs text-muted-foreground font-mono">{r.car.licensePlate}</p>
                        </td>
                        <td className="p-4 text-xs text-muted-foreground">
                          <p>{formatDate(r.startDate)} →</p>
                          <p>{formatDate(r.endDate)}</p>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {paid
                              ? <><CheckCircle2 className="w-3 h-3" /> Payée</>
                              : <><Clock className="w-3 h-3" /> En attente</>
                            }
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-primary">
                          {formatMAD(r.totalAmount)}
                        </td>
                        <td className="p-4">
                          <Button variant="outline" size="sm" onClick={() => setSelectedId(r.id)}>
                            <Receipt className="w-3 h-3 mr-1" />
                            Voir
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
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {meta.total} facture(s) · Page {meta.page}/{meta.totalPages}
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

      {selectedId && (
        <InvoiceModal id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

// ── Invoice Modal ──────────────────────────────────────
export function InvoiceModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { user } = useAuthStore();
  const [downloading, setDownloading] = useState(false);

  const { data: r, isLoading } = useQuery({
    queryKey: ['invoice-detail', id],
    queryFn: () => reservationsApi.getById(id).then((res) => res.data.data),
  });

  const handlePdf = async () => {
    if (!r) return;
    setDownloading(true);
    try {
      const invoiceNumber = `FAC-${r.reservationNumber?.replace('REF-', '')}`;
      await downloadPdf('invoice-pdf-body', `${invoiceNumber}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>
              {isLoading ? 'Chargement…' : `Facture FAC-${r?.reservationNumber?.replace('REF-', '')}`}
            </DialogTitle>
            {!isLoading && r && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-2" />Imprimer
                </Button>
                <Button variant="outline" size="sm" onClick={handlePdf} disabled={downloading}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50">
                  {downloading
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <Download className="w-4 h-4 mr-2" />}
                  {downloading ? 'Génération…' : 'Télécharger PDF'}
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : r ? (
          <div id="invoice-pdf-body" className="bg-white p-2">
            <InvoiceBody r={r} agencyName={user?.agency?.name} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ── Invoice Body ───────────────────────────────────────
function InvoiceBody({ r, agencyName }: { r: any; agencyName?: string }) {
  const invoiceNumber = `FAC-${r.reservationNumber?.replace('REF-', '')}`;
  const totalPaid = r.payments
    ?.filter((p: any) => p.status === 'PAID' && p.type !== 'REFUND')
    .reduce((s: number, p: any) => s + Number(p.amount), 0) ?? 0;
  const remaining = Number(r.totalAmount) - totalPaid;
  const isPaid = remaining <= 0;

  return (
    <div className="space-y-5 text-sm">

      {/* En-tête */}
      <div className="flex justify-between items-start border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-primary">Kharrazi Fleet</h2>
          <p className="text-xs text-muted-foreground">Location de Véhicules</p>
          {agencyName && <p className="text-xs text-muted-foreground">{agencyName}</p>}
        </div>
        <div className="text-right">
          <p className="font-bold text-lg">FACTURE</p>
          <p className="font-mono text-sm text-muted-foreground">{invoiceNumber}</p>
          <p className="text-xs text-muted-foreground">Émis le {formatDate(r.createdAt)}</p>
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
            isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {isPaid ? '✓ PAYÉE' : '⏳ EN ATTENTE'}
          </span>
        </div>
      </div>

      {/* Client + Réservation */}
      <div className="grid grid-cols-2 gap-6">
        <section>
          <div className="flex items-center gap-2 font-semibold border-b pb-1 mb-2">
            <User className="w-4 h-4 text-primary" /> Facturé à
          </div>
          <table className="text-xs w-full">
            <tbody>
              <InfoRow label="Nom" value={`${r.client.firstName} ${r.client.lastName}`} />
              <InfoRow label="CIN" value={r.client.cin} />
              {r.client.phone && <InfoRow label="Tél" value={r.client.phone} />}
              {r.client.email && <InfoRow label="Email" value={r.client.email} />}
              {r.client.city  && <InfoRow label="Ville" value={r.client.city} />}
            </tbody>
          </table>
        </section>

        <section>
          <div className="flex items-center gap-2 font-semibold border-b pb-1 mb-2">
            <Car className="w-4 h-4 text-primary" /> Véhicule loué
          </div>
          <table className="text-xs w-full">
            <tbody>
              <InfoRow label="Véhicule" value={`${r.car.brand} ${r.car.model}`} />
              <InfoRow label="Plaque" value={r.car.licensePlate} />
              {r.car.year  && <InfoRow label="Année"   value={String(r.car.year)} />}
              {r.car.color && <InfoRow label="Couleur" value={r.car.color} />}
            </tbody>
          </table>
        </section>
      </div>

      {/* Période */}
      <section>
        <div className="flex items-center gap-2 font-semibold border-b pb-1 mb-2">
          <Calendar className="w-4 h-4 text-primary" /> Période
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="bg-muted rounded-lg p-2">
            <p className="text-muted-foreground mb-1">Départ</p>
            <p className="font-semibold">{formatDate(r.startDate)}</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-2">
            <p className="text-muted-foreground mb-1">Durée</p>
            <p className="font-bold text-primary">{r.totalDays} jour(s)</p>
          </div>
          <div className="bg-muted rounded-lg p-2">
            <p className="text-muted-foreground mb-1">Retour</p>
            <p className="font-semibold">{formatDate(r.endDate)}</p>
          </div>
        </div>
      </section>

      {/* Détail des lignes */}
      <section>
        <div className="flex items-center gap-2 font-semibold border-b pb-1 mb-2">
          <Receipt className="w-4 h-4 text-primary" /> Détail de la facture
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 text-muted-foreground">Description</th>
              <th className="text-right py-1 text-muted-foreground">Qté</th>
              <th className="text-right py-1 text-muted-foreground">P.U</th>
              <th className="text-right py-1 text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1">Location {r.car.brand} {r.car.model}</td>
              <td className="text-right py-1">{r.totalDays} j</td>
              <td className="text-right py-1">{formatMAD(r.pricePerDay)}</td>
              <td className="text-right py-1 font-medium">{formatMAD(r.subtotal)}</td>
            </tr>
            {Number(r.discountAmount) > 0 && (
              <tr className="text-green-600">
                <td className="py-1">Remise ({Number(r.discountPercent)}%)</td>
                <td />
                <td />
                <td className="text-right py-1">- {formatMAD(r.discountAmount)}</td>
              </tr>
            )}
            {Number(r.extraCharges) > 0 && (
              <tr className="text-orange-600">
                <td className="py-1">Frais supplémentaires</td>
                <td />
                <td />
                <td className="text-right py-1">+ {formatMAD(r.extraCharges)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t font-bold">
              <td colSpan={3} className="py-2 text-right">Total HT (TVA non applicable)</td>
              <td className="text-right py-2 text-primary text-base">{formatMAD(r.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Paiements reçus */}
      {r.payments?.length > 0 && (
        <section>
          <div className="flex items-center gap-2 font-semibold border-b pb-1 mb-2">
            <CreditCard className="w-4 h-4 text-primary" /> Paiements reçus
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 text-muted-foreground">Date</th>
                <th className="text-left py-1 text-muted-foreground">Type</th>
                <th className="text-left py-1 text-muted-foreground">Méthode</th>
                <th className="text-right py-1 text-muted-foreground">Montant</th>
              </tr>
            </thead>
            <tbody>
              {r.payments.map((p: any) => (
                <tr key={p.id} className={p.type === 'REFUND' ? 'text-red-600' : ''}>
                  <td className="py-1">{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                  <td className="py-1">{PAYMENT_TYPE_LABELS[p.type] ?? p.type}</td>
                  <td className="py-1">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</td>
                  <td className="text-right py-1 font-medium">
                    {p.type === 'REFUND' ? '- ' : ''}{formatMAD(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t">
              <tr>
                <td colSpan={3} className="py-1 font-semibold">Total payé</td>
                <td className="text-right py-1 font-bold text-green-600">{formatMAD(totalPaid)}</td>
              </tr>
              {remaining > 0 && (
                <tr>
                  <td colSpan={3} className="py-1 font-semibold text-yellow-600">Reste à payer</td>
                  <td className="text-right py-1 font-bold text-yellow-600">{formatMAD(remaining)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </section>
      )}

      {/* Caution */}
      <div className="flex justify-between items-center bg-muted rounded-lg p-3 text-xs">
        <span className="text-muted-foreground">Caution versée (remboursable)</span>
        <span className="font-semibold">{formatMAD(r.depositAmount)}</span>
      </div>

      <p className="text-xs text-muted-foreground text-center border-t pt-3">
        Kharrazi Fleet Location — Merci de votre confiance. Cette facture fait foi de paiement.
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-0.5 pr-3 text-muted-foreground whitespace-nowrap">{label}</td>
      <td className="py-0.5 font-medium">{value}</td>
    </tr>
  );
}

