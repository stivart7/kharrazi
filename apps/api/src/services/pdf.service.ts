import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { fetchReportData, PERIOD_LABELS, ReportPeriod } from './report-data.service';

const BLUE   = '#2563eb';
const DARK   = '#111827';
const GRAY   = '#6b7280';
const LIGHT  = '#f3f4f6';
const GREEN  = '#16a34a';
const RED    = '#dc2626';

function formatMAD(n: number) {
  return `${n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Table helper ───────────────────────────────────
function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  x: number,
  y: number,
  colWidths: number[],
  rowHeight = 22,
) {
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  // Header row
  doc.rect(x, y, tableWidth, rowHeight).fill(BLUE);
  let cx = x;
  headers.forEach((h, i) => {
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
      .text(h, cx + 4, y + 7, { width: colWidths[i] - 8, align: 'left' });
    cx += colWidths[i];
  });
  y += rowHeight;

  // Data rows
  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? 'white' : LIGHT;
    doc.rect(x, y, tableWidth, rowHeight).fill(bg);
    let rx = x;
    row.forEach((cell, ci) => {
      doc.fillColor(DARK).fontSize(8).font('Helvetica')
        .text(cell, rx + 4, y + 7, { width: colWidths[ci] - 8, align: 'left' });
      rx += colWidths[ci];
    });
    // Bottom border
    doc.strokeColor('#e5e7eb').lineWidth(0.5)
      .moveTo(x, y + rowHeight).lineTo(x + tableWidth, y + rowHeight).stroke();
    y += rowHeight;
  });

  // Table border
  doc.rect(x, y - rows.length * rowHeight - rowHeight, tableWidth, rows.length * rowHeight + rowHeight)
    .strokeColor('#d1d5db').lineWidth(0.8).stroke();

  return y;
}

// ── Section header ─────────────────────────────────
function sectionHeader(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.rect(40, y, doc.page.width - 80, 24).fill(LIGHT);
  doc.fillColor(BLUE).fontSize(11).font('Helvetica-Bold')
    .text(title, 48, y + 6);
  return y + 32;
}

// ── Main generator ─────────────────────────────────
export async function generatePDF(agencyId: string, period: ReportPeriod, res: Response) {
  const data = await fetchReportData(agencyId, period);

  const periodLabel = PERIOD_LABELS[period];
  const filename    = `rapport-${period}-${new Date().toISOString().slice(0, 10)}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  const pageW = doc.page.width;

  // ── Cover / Header ─────────────────────────────
  doc.rect(0, 0, pageW, 100).fill(BLUE);

  doc.fillColor('white')
    .fontSize(22).font('Helvetica-Bold')
    .text('RAPPORT D\'AGENCE', 40, 25, { align: 'center' });

  doc.fontSize(12).font('Helvetica')
    .text(data.agency?.name ?? 'Agence', 40, 52, { align: 'center' });

  doc.fontSize(9)
    .text(`Période: ${periodLabel}  •  Généré le ${formatDate(new Date())}`, 40, 72, { align: 'center' });

  let y = 120;

  // ── Overview KPIs ──────────────────────────────
  y = sectionHeader(doc, '📊 Vue d\'ensemble', y);

  const kpis = [
    { label: 'Total véhicules',     value: String(data.overview.totalCars) },
    { label: 'Disponibles',         value: String(data.overview.availableCars) },
    { label: 'En location',         value: String(data.overview.rentedCars) },
    { label: 'Maintenance',         value: String(data.overview.maintenanceCars) },
    { label: 'Taux d\'occupation',  value: `${data.overview.occupancyRate}%` },
    { label: 'Total réservations',  value: String(data.reservations.total) },
    { label: 'Revenus encaissés',   value: formatMAD(data.revenue.totalRevenue) },
    { label: 'Paiements en attente',value: formatMAD(data.revenue.totalPending) },
  ];

  const kpiColW = (pageW - 80) / 4;
  let kx = 40;
  let ky = y;
  kpis.forEach((kpi, i) => {
    if (i === 4) { kx = 40; ky += 52; }
    doc.rect(kx, ky, kpiColW - 6, 44).fill('white')
      .strokeColor('#e5e7eb').lineWidth(0.8).stroke();
    doc.fillColor(BLUE).fontSize(16).font('Helvetica-Bold')
      .text(kpi.value, kx + 8, ky + 6, { width: kpiColW - 22 });
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
      .text(kpi.label, kx + 8, ky + 28);
    kx += kpiColW;
  });
  y = ky + 60;

  // ── Reservations by status ─────────────────────
  y = sectionHeader(doc, '📅 Réservations par statut', y);

  const resByStatus = data.reservations.byStatus;
  const statusRows = [
    ['En attente',  String(resByStatus.PENDING)],
    ['Actives',     String(resByStatus.ACTIVE)],
    ['Terminées',   String(resByStatus.COMPLETED)],
    ['Annulées',    String(resByStatus.CANCELLED)],
    ['TOTAL',       String(data.reservations.total)],
  ];
  y = drawTable(doc, ['Statut', 'Nombre'], statusRows, 40, y, [280, 235]) + 16;

  // ── Revenue ────────────────────────────────────
  y = sectionHeader(doc, '💰 Revenus', y);
  const revRows = [
    ['Montant encaissé', formatMAD(data.revenue.totalRevenue)],
    ['Transactions payées', String(data.revenue.paidCount)],
    ['Montant en attente', formatMAD(data.revenue.totalPending)],
  ];
  y = drawTable(doc, ['Indicateur', 'Valeur'], revRows, 40, y, [280, 235]) + 16;

  // ── Car performance ────────────────────────────
  if (y > 650) { doc.addPage(); y = 40; }
  y = sectionHeader(doc, '🚗 Performance des véhicules', y);

  const carRows = data.carPerformance.slice(0, 15).map((c) => [
    `${c.brand} ${c.model}`,
    c.licensePlate,
    c.status === 'AVAILABLE' ? 'Disponible' : c.status === 'RENTED' ? 'En location' : 'Maintenance',
    String(c.totalReservations),
    `${c.totalDays}j`,
    formatMAD(c.totalRevenue),
  ]);

  if (carRows.length === 0) carRows.push(['Aucun véhicule', '', '', '', '', '']);
  y = drawTable(doc,
    ['Véhicule', 'Immat.', 'Statut', 'Rés.', 'Jours', 'Revenus'],
    carRows, 40, y, [120, 80, 75, 40, 45, 155]
  ) + 16;

  // ── Recent reservations ────────────────────────
  if (y > 580) { doc.addPage(); y = 40; }
  y = sectionHeader(doc, '📋 Dernières réservations', y);

  const resRows = data.reservations.list.slice(0, 12).map((r) => [
    `${r.client.firstName} ${r.client.lastName}`,
    `${r.car.brand} ${r.car.model}`,
    formatDate(r.startDate),
    formatDate(r.endDate),
    r.status,
  ]);

  if (resRows.length === 0) resRows.push(['Aucune réservation', '', '', '', '']);
  drawTable(doc,
    ['Client', 'Véhicule', 'Début', 'Fin', 'Statut'],
    resRows, 40, y, [130, 120, 70, 70, 125]
  );

  // ── Footer ─────────────────────────────────────
  const pageH = doc.page.height;
  doc.rect(0, pageH - 35, pageW, 35).fill(BLUE);
  doc.fillColor('white').fontSize(8).font('Helvetica')
    .text(`${data.agency?.name ?? ''} — Rapport généré le ${formatDate(new Date())} — Kharrazi Fleet`,
      40, pageH - 22, { align: 'center', width: pageW - 80 });

  doc.end();
}
