'use client';

import { useState } from 'react';
import { downloadPdf } from '@/lib/pdf';
import { useQuery } from '@tanstack/react-query';
import { reservationsApi } from '@/lib/api/reservations';
import { formatDate, formatMAD, RESERVATION_STATUS_CONFIG } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Search, FileText, Receipt, Plus, Printer, Download } from 'lucide-react';
import { ContractForm } from './contract-form';
import { InvoiceModal } from '@/components/invoices/invoices-content';

// Contracts = real rentals (car has been or is being used)
const STATUS_TABS = [
  { label: 'Tous',       value: '' },
  { label: 'En cours',   value: 'ACTIVE' },
  { label: 'Terminés',   value: 'COMPLETED' },
];

/* ─────────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────────── */
export function ContractsContent() {
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [status,      setStatus]      = useState('ACTIVE');
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [invoiceId,   setInvoiceId]   = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', { page, search, status }],
    queryFn: () =>
      reservationsApi.getAll({
        page, search: search || undefined,
        status: status || undefined, limit: 15,
        isContract: true,
      }).then((r) => r.data),
  });

  const reservations = data?.data ?? [];
  const meta         = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contrats de location</h1>
          <p className="text-muted-foreground">{meta?.total ?? 0} contrat(s) au total</p>
        </div>
        <ContractForm />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {STATUS_TABS.map((tab) => (
          <button key={tab.value}
            onClick={() => { setStatus(tab.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              status === tab.value
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Référence, client, plaque…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
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
                    <th className="text-left p-4 font-medium text-muted-foreground">N° Contrat</th>
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
                        <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                        Aucun contrat trouvé
                      </td>
                    </tr>
                  ) : reservations.map((r: any) => {
                    const cfg = RESERVATION_STATUS_CONFIG[r.status as keyof typeof RESERVATION_STATUS_CONFIG];
                    return (
                      <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                        <td className="p-4 font-mono text-xs font-medium">{r.reservationNumber}</td>
                        <td className="p-4">
                          <p className="font-medium">{r.client.firstName} {r.client.lastName}</p>
                          <p className="text-xs text-muted-foreground">CIN: {r.client.cin}</p>
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
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg?.color}`}>
                            {cfg?.label}
                          </span>
                        </td>
                        <td className="p-4 text-right font-medium">{formatMAD(r.totalAmount)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="sm" onClick={() => setSelectedId(r.id)}>
                              <FileText className="w-3 h-3 mr-1" />Voir
                            </Button>
                            <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => setInvoiceId(r.id)}>
                              <Receipt className="w-3 h-3 mr-1" />Facture
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

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {meta.total} contrat(s) · Page {meta.page}/{meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" disabled={page === meta.totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      {selectedId && (
        <ContractModal id={selectedId} onClose={() => setSelectedId(null)} />
      )}
      {invoiceId && (
        <InvoiceModal id={invoiceId} onClose={() => setInvoiceId(null)} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Modal
───────────────────────────────────────────────────────────────── */
function ContractModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reservation-detail', id],
    queryFn:  () => reservationsApi.getById(id).then((r) => r.data.data),
    retry: false,
  });

  const handlePdf = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      await downloadPdf('contract-pdf-body', `Contrat-${data.reservationNumber}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  const title = isLoading
    ? 'Chargement…'
    : isError || !data
    ? 'Erreur de chargement'
    : `Contrat N° ${data.reservationNumber}`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>{title}</DialogTitle>
            {!isLoading && data && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const html = buildPrintHtml(data);
                  const win = window.open('', '_blank', 'width=900,height=1200');
                  if (!win) return;
                  win.document.write(html);
                  win.document.close();
                  win.focus();
                  setTimeout(() => { win.print(); }, 400);
                }}>
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
        ) : isError || !data ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Impossible de charger le contrat. Veuillez réessayer.
          </div>
        ) : (
          <div id="contract-pdf-body" className="bg-white p-2">
            <ContractPreview r={data} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────────
   In-app preview (screen only)
───────────────────────────────────────────────────────────────── */
function ContractPreview({ r }: { r: any }) {
  const days      = r.totalDays ?? 0;
  const ppd       = Number(r.pricePerDay ?? 0);
  const subtotal  = Number(r.subtotal ?? 0);
  const discount  = Number(r.discountAmount ?? 0);
  const extras    = Number(r.extraCharges ?? 0);
  const total     = Number(r.totalAmount ?? 0);
  const deposit   = Number(r.depositAmount ?? 0);
  const tva       = Math.round(subtotal * 0.20 * 100) / 100;

  const fuelLabel: Record<string, string> = {
    EMPTY: 'Vide', QUARTER: '1/4', HALF: '1/2', THREE_QUARTER: '3/4', FULL: 'Plein',
  };

  const blank = (n = 30) => '_'.repeat(n);

  const accessories = [
    'Batterie', 'Outils', 'Rétroviseurs', 'Feux',
    'Galerie', 'Autoradio', 'Pneu de secours', 'Allume-cigare',
  ];

  return (
    <div className="text-xs font-sans text-gray-900 space-y-4 p-2">

      {/* ── HEADER ── */}
      <div className="text-center border-b-2 border-gray-800 pb-3">
        <p className="text-[10px] text-gray-400 mb-1">_____________________________________ &nbsp;[Nom / Logo de l'agence]&nbsp; _____________________________________</p>
        <h1 className="text-base font-black tracking-widest uppercase">Contrat de Location de Véhicule</h1>
        <div className="flex justify-center gap-10 mt-2 text-[11px]">
          <span><strong>N° du contrat :</strong> {r.reservationNumber}</span>
          <span><strong>Marque :</strong> {r.car.brand}</span>
          <span><strong>Modèle :</strong> {r.car.model}</span>
          <span><strong>Immatriculation :</strong> {r.car.licensePlate}</span>
        </div>
      </div>

      {/* ── LOCATAIRE ── */}
      <SectionTitle>1. Locataire</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {/* 1er conducteur */}
        <div className="border border-gray-300 rounded p-2">
          <p className="font-bold text-center text-[11px] border-b border-gray-300 pb-1 mb-2">1er Conducteur</p>
          <FieldGrid rows={[
            ['Nom',                      r.client.lastName],
            ['Prénom',                   r.client.firstName],
            ['Date de naissance',        blank(16)],
            ['Lieu de naissance',        blank(16)],
            ['Adresse au Maroc',         r.client.address ?? blank(20)],
            ['Téléphone',                r.client.phone],
            ['N° du permis',             r.client.licenseNumber ?? blank(14)],
            ['Date de délivrance permis',r.client.licenseExpiry ? formatDate(r.client.licenseExpiry) : blank(12)],
            ['N° de passeport',          r.client.passportNumber ?? blank(14)],
            ['N° de la CIN',             r.client.cin],
            ['Date de délivrance CIN',   blank(14)],
          ]} />
        </div>
        {/* 2ème conducteur */}
        <div className="border border-gray-300 rounded p-2">
          <p className="font-bold text-center text-[11px] border-b border-gray-300 pb-1 mb-2">2ème Conducteur</p>
          <FieldGrid rows={[
            ['Nom',                       blank(18)],
            ['Prénom',                    blank(18)],
            ['Date de naissance',         blank(16)],
            ['Lieu de naissance',         blank(16)],
            ['Adresse au Maroc',          blank(20)],
            ['Téléphone',                 blank(14)],
            ['N° du permis',              blank(14)],
            ['Date de délivrance permis', blank(12)],
            ['N° de passeport',           blank(14)],
            ['N° de la CIN',              blank(14)],
            ['Date de délivrance CIN',    blank(14)],
          ]} />
        </div>
      </div>

      {/* ── PÉRIODE ── */}
      <SectionTitle>2. Période de Location</SectionTitle>
      <table className="w-full border border-gray-300 text-[11px]">
        <tbody>
          <tr className="border-b border-gray-300">
            <td className="p-1.5 font-semibold bg-gray-50 w-1/2 border-r border-gray-300">Date et heure de départ</td>
            <td className="p-1.5">{formatDate(r.startDate)}</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="p-1.5 font-semibold bg-gray-50 border-r border-gray-300">Date et heure de retour</td>
            <td className="p-1.5">{formatDate(r.endDate)}</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="p-1.5 font-semibold bg-gray-50 border-r border-gray-300">Lieu de livraison</td>
            <td className="p-1.5">{blank(30)}</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="p-1.5 font-semibold bg-gray-50 border-r border-gray-300">Lieu de récupération</td>
            <td className="p-1.5">{blank(30)}</td>
          </tr>
          <tr>
            <td className="p-1.5 font-semibold bg-gray-50 border-r border-gray-300">Durée de location</td>
            <td className="p-1.5 font-bold">{days} jour(s)</td>
          </tr>
        </tbody>
      </table>

      {/* ── SITUATION VÉHICULE ── */}
      <SectionTitle>3. Situation du Véhicule</SectionTitle>
      <div className="border border-gray-300 rounded p-2 space-y-2">
        {/* Accessories */}
        <p className="font-semibold text-[11px]">Accessoires :</p>
        <div className="grid grid-cols-4 gap-1">
          {accessories.map((acc) => (
            <label key={acc} className="flex items-center gap-1 text-[10px]">
              <span className="inline-block w-3 h-3 border border-gray-400 rounded-sm flex-shrink-0" />
              {acc}
            </label>
          ))}
        </div>
        {/* Km + Fuel + Franchise */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <FieldGrid rows={[
            ['Kilométrage au départ',  r.startMileage != null ? `${r.startMileage} km` : blank(10)],
            ['Kilométrage au retour',  blank(10)],
          ]} />
          <FieldGrid rows={[
            ['Niveau carburant départ', r.fuelLevelStart ? (fuelLabel[r.fuelLevelStart] ?? r.fuelLevelStart) : blank(8)],
            ['Niveau carburant retour', blank(8)],
            ['Franchise',              blank(8)],
          ]} />
        </div>
        {/* Fuel scale */}
        <div className="flex items-center gap-1 text-[10px] pt-1">
          <span className="font-semibold mr-1">Carburant :</span>
          {['Vide', '1/4', '1/2', '3/4', 'Plein'].map((f) => {
            const current = fuelLabel[r.fuelLevelStart ?? ''];
            return (
              <span key={f} className={`px-2 py-0.5 border rounded text-[9px] ${current === f ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300'}`}>{f}</span>
            );
          })}
        </div>
      </div>

      {/* ── PRIX ── */}
      <SectionTitle>4. Prix</SectionTitle>
      <table className="w-full border border-gray-300 text-[11px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-1.5 border-b border-r border-gray-300 font-semibold">Désignation</th>
            <th className="text-right p-1.5 border-b border-gray-300 font-semibold">Montant (MAD)</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['Prix par jour',            `${formatMAD(ppd)} × ${days}j`],
            ['Net de location (HT)',     formatMAD(subtotal)],
            ['Remise',                   discount > 0 ? `- ${formatMAD(discount)} (${Number(r.discountPercent)}%)` : '—'],
            ['Frais divers',             extras > 0 ? formatMAD(extras) : '—'],
            ['Frais de livraison/reprise','___________'],
            ['TVA (20 %)',               formatMAD(tva)],
            ['Frais de carburant',       '___________'],
          ].map(([label, val]) => (
            <tr key={label} className="border-b border-gray-200">
              <td className="p-1.5 border-r border-gray-300">{label}</td>
              <td className="p-1.5 text-right">{val}</td>
            </tr>
          ))}
          <tr className="bg-gray-100 font-bold">
            <td className="p-1.5 border-r border-gray-300 border-t border-gray-400">Total général</td>
            <td className="p-1.5 text-right border-t border-gray-400">{formatMAD(total)}</td>
          </tr>
          <tr className="border-b border-gray-200">
            <td className="p-1.5 border-r border-gray-300">Caution versée</td>
            <td className="p-1.5 text-right">{formatMAD(deposit)}</td>
          </tr>
          <tr>
            <td className="p-1.5 border-r border-gray-300">Mode de règlement</td>
            <td className="p-1.5 text-right">
              <span className="inline-flex gap-3">
                {['Espèces', 'Carte', 'Virement', 'Chèque'].map((m) => (
                  <label key={m} className="flex items-center gap-1 font-normal text-[10px]">
                    <span className="inline-block w-3 h-3 border border-gray-400 rounded-sm" />{m}
                  </label>
                ))}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── CONDITIONS ── */}
      <SectionTitle>5. Conditions Générales</SectionTitle>
      <div className="border border-gray-300 rounded p-2 space-y-1 text-[10px] text-gray-700 leading-relaxed">
        {[
          '1. Le locataire est seul responsable des infractions au code de la route pendant la durée de la location.',
          '2. Le locataire reconnaît avoir pris connaissance des conditions générales de location et les accepter sans réserve.',
          '3. Le véhicule doit être restitué dans le même état que lors de sa livraison, sauf usure normale.',
          '4. En cas de panne ou d\'accident, le locataire s\'engage à prévenir immédiatement l\'agence.',
          '5. Toute prolongation de la durée de location doit faire l\'objet d\'un accord préalable de l\'agence.',
          '6. Le locataire est responsable des dommages causés au véhicule pendant la durée de la location, dans la limite de la franchise prévue.',
          '7. Il est interdit de sous-louer le véhicule ou de le conduire en dehors des frontières du Maroc sans autorisation écrite.',
        ].map((c) => <p key={c}>{c}</p>)}
      </div>

      {/* ── SIGNATURES ── */}
      <div className="pt-4 border-t border-gray-300">
        <div className="flex justify-between text-[11px] mb-6">
          <span>Fait à : {blank(20)}</span>
          <span>Le : {blank(16)}</span>
        </div>
        <div className="grid grid-cols-2 gap-16">
          <div className="text-center">
            <p className="font-semibold text-[11px] mb-8">Signature du locataire</p>
            <p className="text-[10px] text-gray-500">(Lu et approuvé)</p>
            <div className="border-b border-dashed border-gray-400 mt-10" />
            <p className="text-[10px] mt-1">{r.client.firstName} {r.client.lastName}</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-[11px] mb-8">Cachet et signature de l'agence</p>
            <p className="text-[10px] text-gray-500">(Représentant autorisé)</p>
            <div className="border-b border-dashed border-gray-400 mt-10" />
          </div>
        </div>
        <p className="text-center text-[9px] text-gray-400 mt-4">
          Ce contrat est établi en deux (2) exemplaires originaux, un pour chaque partie.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Print HTML builder
───────────────────────────────────────────────────────────────── */
function buildPrintHtml(r: any): string {
  const days     = r.totalDays ?? 0;
  const ppd      = Number(r.pricePerDay ?? 0);
  const subtotal = Number(r.subtotal ?? 0);
  const discount = Number(r.discountAmount ?? 0);
  const extras   = Number(r.extraCharges ?? 0);
  const total    = Number(r.totalAmount ?? 0);
  const deposit  = Number(r.depositAmount ?? 0);
  const tva      = Math.round(subtotal * 0.20 * 100) / 100;

  const fmt  = (n: number) => n.toLocaleString('fr-MA', { minimumFractionDigits: 2 }) + ' MAD';
  const fd   = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA') : '';
  const b    = (n = 20) => `<span style="display:inline-block;min-width:${n * 7}px;border-bottom:1px solid #555;">&nbsp;</span>`;

  const fuelLabel: Record<string, string> = {
    EMPTY: 'Vide', QUARTER: '1/4', HALF: '1/2', THREE_QUARTER: '3/4', FULL: 'Plein',
  };
  const fuelStart = fuelLabel[r.fuelLevelStart ?? ''] ?? '';

  const accessories = ['Batterie','Outils','Rétroviseurs','Feux','Galerie','Autoradio','Pneu de secours','Allume-cigare'];
  const accBoxes = accessories.map((a) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:10px;">
       <span style="display:inline-block;width:12px;height:12px;border:1px solid #555;"></span>${a}
     </span>`
  ).join('');

  const modeBoxes = ['Espèces','Carte','Virement','Chèque'].map((m) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:10px;">
       <span style="display:inline-block;width:12px;height:12px;border:1px solid #555;"></span>${m}
     </span>`
  ).join('');

  const fuelScale = ['Vide','1/4','1/2','3/4','Plein'].map((f) =>
    `<span style="padding:2px 8px;border:1px solid #555;border-radius:3px;font-size:9px;${fuelStart === f ? 'background:#333;color:#fff;' : ''}">${f}</span>`
  ).join(' ');

  const row2 = (label: string, v1: string, v2: string) =>
    `<tr>
      <td style="padding:3px 6px;border:1px solid #ccc;font-weight:600;background:#f9f9f9;font-size:10px;">${label}</td>
      <td style="padding:3px 6px;border:1px solid #ccc;font-size:10px;">${v1}</td>
      <td style="padding:3px 6px;border:1px solid #ccc;font-weight:600;background:#f9f9f9;font-size:10px;">${label}</td>
      <td style="padding:3px 6px;border:1px solid #ccc;font-size:10px;">${v2}</td>
    </tr>`;

  const fieldRow = (label: string, val: string) =>
    `<tr>
      <td style="padding:2px 5px;font-size:10px;color:#555;white-space:nowrap;">${label}&nbsp;:</td>
      <td style="padding:2px 5px;font-size:10px;">${val}</td>
    </tr>`;

  const priceRow = (label: string, val: string, bold = false) =>
    `<tr style="${bold ? 'background:#f0f0f0;font-weight:700;' : ''}">
      <td style="padding:4px 8px;border:1px solid #ccc;font-size:10px;${bold ? 'border-top:2px solid #555;' : ''}">${label}</td>
      <td style="padding:4px 8px;border:1px solid #ccc;text-align:right;font-size:10px;${bold ? 'border-top:2px solid #555;' : ''}">${val}</td>
    </tr>`;

  const row4 = (l1: string, v1: string, l2: string, v2: string) =>
    `<tr>
      <td style="padding:1px 4px;color:#555;white-space:nowrap;font-size:8.5px;">${l1}&nbsp;:</td>
      <td style="padding:1px 4px;font-size:8.5px;border-right:1px solid #ddd;">${v1}</td>
      <td style="padding:1px 4px;color:#555;white-space:nowrap;font-size:8.5px;">${l2}&nbsp;:</td>
      <td style="padding:1px 4px;font-size:8.5px;">${v2}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Contrat ${r.reservationNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9px; color: #111; background: #fff; }
  @page { size: A4 portrait; margin: 6mm 7mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  table { border-collapse: collapse; width: 100%; }
  h1 { font-size: 12px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
  .st {
    font-size: 8.5px; font-weight: 700; text-transform: uppercase;
    background: #e0e0e0; padding: 2px 5px; margin: 4px 0 2px;
    border-left: 3px solid #333;
  }
  td, th { font-size: 9px; }
</style>
</head>
<body>

<!-- HEADER -->
<div style="text-align:center;border-bottom:2px solid #222;padding-bottom:5px;margin-bottom:5px;">
  <h1>Contrat de Location de Véhicule</h1>
  <div style="display:flex;justify-content:center;gap:24px;margin-top:4px;font-size:9.5px;">
    <span><strong>N° :</strong> ${r.reservationNumber}</span>
    <span><strong>Véhicule :</strong> ${r.car.brand} ${r.car.model}</span>
    <span><strong>Immatriculation :</strong> ${r.car.licensePlate}</span>
    <span><strong>Année :</strong> ${r.car.year ?? ''}</span>
  </div>
</div>

<!-- LOCATAIRE -->
<div class="st">1. Locataire</div>
<table style="border:1px solid #ccc;">
  <thead>
    <tr style="background:#f0f0f0;">
      <th colspan="2" style="padding:2px 4px;text-align:center;font-size:9px;border-right:1px solid #ddd;border-bottom:1px solid #ccc;">1er Conducteur</th>
      <th colspan="2" style="padding:2px 4px;text-align:center;font-size:9px;border-bottom:1px solid #ccc;">2ème Conducteur</th>
    </tr>
  </thead>
  <tbody>
    ${row4('Nom',            r.client.lastName,                              'Nom',            b(12))}
    ${row4('Prénom',         r.client.firstName,                             'Prénom',         b(12))}
    ${row4('Date naiss.',    b(10),                                          'Date naiss.',    b(10))}
    ${row4('Lieu naiss.',    b(10),                                          'Lieu naiss.',    b(10))}
    ${row4('Adresse',        r.client.address ?? b(14),                     'Adresse',        b(14))}
    ${row4('Téléphone',      r.client.phone ?? b(10),                       'Téléphone',      b(10))}
    ${row4('N° permis',      r.client.licenseNumber ?? b(10),               'N° permis',      b(10))}
    ${row4('Date permis',    r.client.licenseExpiry ? fd(r.client.licenseExpiry) : b(8), 'Date permis', b(8))}
    ${row4('N° passeport',   r.client.passportNumber ?? b(10),              'N° passeport',   b(10))}
    ${row4('N° CIN',         r.client.cin,                                  'N° CIN',         b(10))}
    ${row4('Date CIN',       b(8),                                          'Date CIN',       b(8))}
  </tbody>
</table>

<!-- PÉRIODE + SITUATION côte à côte -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:0;">
  <div>
    <div class="st">2. Période de Location</div>
    <table style="border:1px solid #ccc;">
      <tr><td style="padding:2px 6px;font-weight:600;background:#f9f9f9;border-bottom:1px solid #ddd;width:45%;">Départ</td><td style="padding:2px 6px;border-bottom:1px solid #ddd;">${fd(r.startDate)}</td></tr>
      <tr><td style="padding:2px 6px;font-weight:600;background:#f9f9f9;border-bottom:1px solid #ddd;">Retour</td><td style="padding:2px 6px;border-bottom:1px solid #ddd;">${fd(r.endDate)}</td></tr>
      <tr><td style="padding:2px 6px;font-weight:600;background:#f9f9f9;border-bottom:1px solid #ddd;">Durée</td><td style="padding:2px 6px;font-weight:700;border-bottom:1px solid #ddd;">${days} jour(s)</td></tr>
      <tr><td style="padding:2px 6px;font-weight:600;background:#f9f9f9;border-bottom:1px solid #ddd;">Lieu livraison</td><td style="padding:2px 6px;border-bottom:1px solid #ddd;">${b(14)}</td></tr>
      <tr><td style="padding:2px 6px;font-weight:600;background:#f9f9f9;">Lieu récupération</td><td style="padding:2px 6px;">${b(14)}</td></tr>
    </table>
  </div>
  <div>
    <div class="st">3. Situation du Véhicule</div>
    <div style="border:1px solid #ccc;padding:4px 6px;">
      <p style="font-weight:700;margin-bottom:3px;">Accessoires :</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;margin-bottom:4px;">
        ${accessories.map((a) => `<span style="display:flex;align-items:center;gap:3px;font-size:9px;"><span style="display:inline-block;width:10px;height:10px;border:1px solid #555;flex-shrink:0;"></span>${a}</span>`).join('')}
      </div>
      <div style="font-size:9px;margin-bottom:3px;">
        <strong>Km départ :</strong> ${r.startMileage != null ? r.startMileage + ' km' : b(8)}
        &nbsp;&nbsp;
        <strong>Km retour :</strong> ${b(8)}
        &nbsp;&nbsp;
        <strong>Franchise :</strong> ${b(6)}
      </div>
      <div style="font-size:9px;">
        <strong>Carburant :</strong>&nbsp;${fuelScale}
      </div>
    </div>
  </div>
</div>

<!-- PRIX + CONDITIONS côte à côte -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:0;">
  <div>
    <div class="st">4. Prix</div>
    <table style="border:1px solid #ccc;">
      <thead>
        <tr style="background:#e8e8e8;">
          <th style="padding:2px 6px;text-align:left;border-bottom:1px solid #ccc;">Désignation</th>
          <th style="padding:2px 6px;text-align:right;border-bottom:1px solid #ccc;">MAD</th>
        </tr>
      </thead>
      <tbody>
        ${priceRow(`${fmt(ppd)}/j × ${days}j`, fmt(ppd * days))}
        ${priceRow('Net HT', fmt(subtotal))}
        ${discount > 0 ? priceRow('Remise', `- ${fmt(discount)} (${Number(r.discountPercent)}%)`) : ''}
        ${extras > 0 ? priceRow('Frais divers', fmt(extras)) : ''}
        ${priceRow('Livraison / reprise', '_________')}
        ${priceRow('TVA (20%)', fmt(tva))}
        ${priceRow('Carburant', '_________')}
        ${priceRow('TOTAL', fmt(total), true)}
        ${priceRow('Caution versée', deposit > 0 ? fmt(deposit) : '—')}
        <tr>
          <td style="padding:2px 6px;border:1px solid #ccc;">Règlement</td>
          <td style="padding:2px 6px;border:1px solid #ccc;">${modeBoxes}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div>
    <div class="st">5. Conditions Générales</div>
    <div style="border:1px solid #ccc;padding:4px 6px;font-size:8.5px;color:#444;line-height:1.45;">
      <p style="margin-bottom:2px;">1. Le locataire est seul responsable des infractions au code de la route.</p>
      <p style="margin-bottom:2px;">2. Le locataire accepte les conditions générales de location sans réserve.</p>
      <p style="margin-bottom:2px;">3. Le véhicule doit être restitué dans le même état, sauf usure normale.</p>
      <p style="margin-bottom:2px;">4. En cas de panne ou d'accident, l'agence doit être prévenue immédiatement.</p>
      <p style="margin-bottom:2px;">5. Toute prolongation doit faire l'objet d'un accord préalable de l'agence.</p>
      <p style="margin-bottom:2px;">6. Le locataire est responsable des dommages dans la limite de la franchise.</p>
      <p>7. Interdit de sous-louer ou de conduire hors du Maroc sans autorisation écrite.</p>
    </div>
  </div>
</div>

<!-- SIGNATURES -->
<div style="margin-top:6px;border-top:1px solid #ccc;padding-top:5px;">
  <div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:6px;">
    <span>Fait à : ${b(16)}</span>
    <span>Le : ${b(12)}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;">
    <div style="text-align:center;">
      <p style="font-weight:700;font-size:9.5px;margin-bottom:2px;">Signature du locataire</p>
      <p style="font-size:8.5px;color:#888;">(Lu et approuvé)</p>
      <div style="margin-top:22px;border-bottom:1px dashed #555;"></div>
      <p style="font-size:8.5px;margin-top:3px;">${r.client.firstName} ${r.client.lastName}</p>
    </div>
    <div style="text-align:center;">
      <p style="font-weight:700;font-size:9.5px;margin-bottom:2px;">Cachet et signature de l'agence</p>
      <p style="font-size:8.5px;color:#888;">(Représentant autorisé)</p>
      <div style="margin-top:22px;border-bottom:1px dashed #555;"></div>
    </div>
  </div>
  <p style="text-align:center;font-size:7.5px;color:#aaa;margin-top:5px;">
    Contrat établi en deux (2) exemplaires originaux — un pour chaque partie.
  </p>
</div>

</body>
</html>`;
}

/* ─────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wide bg-gray-100 border-l-4 border-gray-700 px-2 py-1 mt-3 mb-2">
      {children}
    </p>
  );
}

function FieldGrid({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full">
      <tbody>
        {rows.map(([label, val]) => (
          <tr key={label}>
            <td className="py-0.5 pr-2 text-muted-foreground text-[9px] whitespace-nowrap">{label}&nbsp;:</td>
            <td className="py-0.5 text-[10px] font-medium">{val}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
