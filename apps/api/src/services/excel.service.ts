import ExcelJS from 'exceljs';
import { Response } from 'express';
import { fetchReportData, PERIOD_LABELS, ReportPeriod } from './report-data.service';

const BLUE_FILL:  ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
const GRAY_FILL:  ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
const WHITE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

function headerStyle(ws: ExcelJS.Worksheet, row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill   = BLUE_FILL;
    cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  row.height = 24;
}

function dataStyle(cell: ExcelJS.Cell, isAlt: boolean) {
  cell.fill      = isAlt ? GRAY_FILL : WHITE_FILL;
  cell.font      = { size: 9.5 };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  cell.border    = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
}

function formatMAD(n: number) {
  return `${n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('fr-FR');
}

function addSheetTitle(ws: ExcelJS.Worksheet, title: string, cols: number) {
  ws.mergeCells(1, 1, 1, cols);
  const titleRow = ws.getRow(1);
  titleRow.getCell(1).value     = title;
  titleRow.getCell(1).fill      = BLUE_FILL;
  titleRow.getCell(1).font      = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  titleRow.height = 32;
  ws.addRow([]);  // blank row
}

export async function generateExcel(agencyId: string, period: ReportPeriod, res: Response) {
  const data     = await fetchReportData(agencyId, period);
  const label    = PERIOD_LABELS[period];
  const filename = `rapport-${period}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Kharrazi Fleet';
  wb.created  = new Date();
  wb.modified = new Date();

  // ── Sheet 1: Vue d'ensemble ────────────────────
  const wsOver = wb.addWorksheet('Vue d\'ensemble', {});
  wsOver.columns = [
    { key: 'indicator', width: 32 },
    { key: 'value',     width: 22 },
  ];
  addSheetTitle(wsOver, `Vue d'ensemble — ${label} — ${data.agency?.name ?? ''}`, 2);

  const overviewRows = [
    ['PARC AUTOMOBILE', ''],
    ['Total véhicules',      data.overview.totalCars],
    ['Disponibles',          data.overview.availableCars],
    ['En location',          data.overview.rentedCars],
    ['En maintenance',       data.overview.maintenanceCars],
    ["Taux d'occupation",    `${data.overview.occupancyRate}%`],
    ['', ''],
    ['RÉSERVATIONS', ''],
    ['Total réservations',   data.reservations.total],
    ['En attente',           data.reservations.byStatus.PENDING],
    ['Actives',              data.reservations.byStatus.ACTIVE],
    ['Terminées',            data.reservations.byStatus.COMPLETED],
    ['Annulées',             data.reservations.byStatus.CANCELLED],
    ['', ''],
    ['REVENUS', ''],
    ['Total encaissé',       formatMAD(data.revenue.totalRevenue)],
    ['Transactions payées',  data.revenue.paidCount],
    ['En attente',           formatMAD(data.revenue.totalPending)],
  ];

  overviewRows.forEach((row, i) => {
    const r = wsOver.addRow(row);
    const isCategory = row[1] === '' && row[0] !== '';
    r.eachCell((cell) => {
      cell.font      = isCategory
        ? { bold: true, size: 10, color: { argb: 'FF2563EB' } }
        : { size: 10 };
      cell.fill      = i % 2 === 0 ? GRAY_FILL : WHITE_FILL;
      cell.border    = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
      cell.alignment = { vertical: 'middle' };
    });
    r.height = 20;
  });

  // ── Sheet 2: Réservations ──────────────────────
  const wsRes = wb.addWorksheet('Réservations', {});
  wsRes.columns = [
    { key: 'client',     width: 22 },
    { key: 'phone',      width: 16 },
    { key: 'car',        width: 20 },
    { key: 'plate',      width: 14 },
    { key: 'start',      width: 14 },
    { key: 'end',        width: 14 },
    { key: 'status',     width: 14 },
    { key: 'amount',     width: 18 },
  ];
  addSheetTitle(wsRes, `Réservations — ${label}`, 8);

  const resHeaderRow = wsRes.addRow(['Client', 'Téléphone', 'Véhicule', 'Immatriculation', 'Début', 'Fin', 'Statut', 'Montant payé']);
  headerStyle(wsRes, resHeaderRow);

  const STATUS_FR: Record<string, string> = {
    PENDING: 'En attente', ACTIVE: 'Active',
    COMPLETED: 'Terminée', CANCELLED: 'Annulée',
  };

  data.reservations.list.forEach((r, i) => {
    const paid = r.payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
    const row  = wsRes.addRow([
      `${r.client.firstName} ${r.client.lastName}`,
      r.client.phone ?? '',
      `${r.car.brand} ${r.car.model}`,
      r.car.licensePlate,
      formatDate(r.startDate),
      formatDate(r.endDate),
      STATUS_FR[r.status] ?? r.status,
      formatMAD(paid),
    ]);
    row.eachCell((cell) => dataStyle(cell, i % 2 !== 0));
    row.height = 20;
  });

  if (data.reservations.list.length === 0) {
    wsRes.addRow(['Aucune réservation pour cette période']);
  }

  // ── Sheet 3: Paiements ─────────────────────────
  const wsPay = wb.addWorksheet('Paiements', {});
  wsPay.columns = [
    { key: 'date',    width: 14 },
    { key: 'client',  width: 22 },
    { key: 'car',     width: 20 },
    { key: 'method',  width: 16 },
    { key: 'type',    width: 14 },
    { key: 'status',  width: 14 },
    { key: 'amount',  width: 18 },
  ];
  addSheetTitle(wsPay, `Paiements — ${label}`, 7);

  const payHeaderRow = wsPay.addRow(['Date', 'Client', 'Véhicule', 'Mode', 'Type', 'Statut', 'Montant']);
  headerStyle(wsPay, payHeaderRow);

  const METHOD_FR: Record<string, string> = {
    CASH: 'Espèces', CARD: 'Carte', BANK_TRANSFER: 'Virement', CHEQUE: 'Chèque',
  };
  const PAY_STATUS_FR: Record<string, string> = {
    PAID: 'Payé', PENDING: 'En attente', REFUNDED: 'Remboursé',
  };
  const TYPE_FR: Record<string, string> = {
    RENTAL: 'Location', DEPOSIT: 'Caution', EXTRA: 'Extra', REFUND: 'Remboursement',
  };

  data.payments.list.forEach((p, i) => {
    const row = wsPay.addRow([
      formatDate(p.createdAt),
      p.reservation ? `${p.reservation.client.firstName} ${p.reservation.client.lastName}` : '',
      p.reservation ? `${p.reservation.car.brand} ${p.reservation.car.model}` : '',
      METHOD_FR[p.method] ?? p.method,
      TYPE_FR[p.type]     ?? p.type,
      PAY_STATUS_FR[p.status] ?? p.status,
      formatMAD(Number(p.amount)),
    ]);
    row.eachCell((cell) => dataStyle(cell, i % 2 !== 0));
    row.height = 20;
  });

  if (data.payments.list.length === 0) {
    wsPay.addRow(['Aucun paiement pour cette période']);
  }

  // ── Sheet 4: Véhicules ─────────────────────────
  const wsCar = wb.addWorksheet('Véhicules', {});
  wsCar.columns = [
    { key: 'brand',   width: 14 },
    { key: 'model',   width: 14 },
    { key: 'plate',   width: 14 },
    { key: 'status',  width: 14 },
    { key: 'price',   width: 14 },
    { key: 'resv',    width: 12 },
    { key: 'days',    width: 12 },
    { key: 'revenue', width: 18 },
  ];
  addSheetTitle(wsCar, `Performance véhicules — ${label}`, 8);

  const carHeader = wsCar.addRow(['Marque', 'Modèle', 'Immatriculation', 'Statut', 'Prix/Jour', 'Réservations', 'Jours loués', 'Revenus']);
  headerStyle(wsCar, carHeader);

  const CAR_STATUS_FR: Record<string, string> = {
    AVAILABLE: 'Disponible', RENTED: 'En location', MAINTENANCE: 'Maintenance',
  };

  data.carPerformance.forEach((c, i) => {
    const row = wsCar.addRow([
      c.brand, c.model, c.licensePlate,
      CAR_STATUS_FR[c.status] ?? c.status,
      formatMAD(c.pricePerDay),
      c.totalReservations, c.totalDays,
      formatMAD(c.totalRevenue),
    ]);
    row.eachCell((cell) => dataStyle(cell, i % 2 !== 0));
    row.height = 20;
  });

  if (data.carPerformance.length === 0) {
    wsCar.addRow(['Aucun véhicule']);
  }

  await wb.xlsx.write(res);
}
