import { AIAction, AILang } from './ai-command-parser.service';

// ── Helpers ────────────────────────────────────────
function formatMAD(n: number) {
  return `${Number(n).toLocaleString('fr-MA')} MAD`;
}

function periodLabel(period: string, lang: AILang): string {
  const map: Record<string, Record<string, string>> = {
    today:  { fr: "aujourd'hui", en: 'today',      ar: 'اليوم',    darija: 'اليوم'   },
    week:   { fr: 'cette semaine', en: 'this week', ar: 'هذا الأسبوع', darija: 'هاد الجمعة' },
    month:  { fr: 'ce mois',     en: 'this month', ar: 'هذا الشهر', darija: 'هاد الشهر' },
    year:   { fr: 'cette année', en: 'this year',  ar: 'هذه السنة', darija: 'هاد العام' },
  };
  return (map[period] ?? map.month)[lang] ?? (map[period] ?? map.month).fr;
}

// ── Response generators per action ─────────────────
function reportResponse(data: any, lang: AILang): string {
  const k = data.kpis ?? {};
  const period = periodLabel('month', lang);
  const lines = [
    `📊 *Rapport — ${period}*`,
    ``,
    `🚗 Flotte: ${k.totalCars ?? 0} véhicules`,
    `   ✅ Disponibles: ${k.availableCars ?? 0}`,
    `   🔑 En location: ${k.rentedCars ?? 0}`,
    `   🔧 Maintenance: ${k.maintenanceCars ?? 0}`,
    `   📈 Taux d'utilisation: ${k.utilizationRate ?? 0}%`,
    ``,
    `📅 Réservations ce mois: ${k.thisMonthReservations ?? 0}`,
    `💰 Revenus ce mois: ${formatMAD(k.thisMonthRevenue ?? 0)}`,
  ];

  if ((k.revenueGrowth ?? 0) !== 0) {
    const sign = k.revenueGrowth > 0 ? '📈 +' : '📉 ';
    lines.push(`   ${sign}${k.revenueGrowth}% vs mois précédent`);
  }

  if (data.upcomingReturns?.length > 0) {
    lines.push(``, `⏰ Retours prévus (72h): ${data.upcomingReturns.length}`);
    data.upcomingReturns.slice(0, 3).forEach((r: any) => {
      const dt = new Date(r.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      lines.push(`   • ${r.car?.brand} ${r.car?.model} — ${r.client?.firstName} — ${dt}`);
    });
  }

  return lines.join('\n');
}

function revenueResponse(data: any, lang: AILang): string {
  const period = periodLabel(data.period ?? 'month', lang);
  const lines = [
    `💰 *Revenus — ${period}*`,
    ``,
    `✅ Total encaissé: ${formatMAD(data.totalPaid ?? 0)} (${data.totalPaidCount ?? 0} paiements)`,
    `⏳ En attente: ${formatMAD(data.totalPending ?? 0)}`,
  ];

  if ((data.totalRefunded ?? 0) > 0) {
    lines.push(`↩️ Remboursements: ${formatMAD(data.totalRefunded)}`);
  }

  if (data.byMethod?.length > 0) {
    lines.push(``, `💳 Par méthode:`);
    data.byMethod.forEach((m: any) => {
      const label: Record<string, string> = {
        CASH: '💵 Espèces', CARD: '💳 Carte',
        BANK_TRANSFER: '🏦 Virement', CHEQUE: '📄 Chèque',
      };
      lines.push(`   ${label[m.method] ?? m.method}: ${formatMAD(m.amount)}`);
    });
  }

  return lines.join('\n');
}

function reservationsResponse(data: any, lang: AILang): string {
  const period = periodLabel(data.period ?? 'month', lang);
  const stats  = data.stats ?? [];
  const list   = data.reservations ?? [];

  const statusLabel: Record<string, string> = {
    PENDING:   '🟡 En attente',
    CONFIRMED: '🔵 Confirmées',
    ACTIVE:    '🟢 En cours',
    COMPLETED: '✅ Terminées',
    CANCELLED: '❌ Annulées',
  };

  const lines = [`📅 *Réservations — ${period}*`, ``];

  stats.forEach((s: any) => {
    lines.push(`${statusLabel[s.status] ?? s.status}: ${s._count}`);
  });

  if (list.length > 0) {
    lines.push(``, `📋 Dernières réservations:`);
    list.slice(0, 5).forEach((r: any) => {
      const dt  = new Date(r.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      const car = `${r.car?.brand} ${r.car?.model}`;
      const cli = `${r.client?.firstName} ${r.client?.lastName}`;
      lines.push(`   • ${dt} — ${car} — ${cli}`);
    });
  } else {
    lines.push(``, `Aucune réservation trouvée pour cette période.`);
  }

  return lines.join('\n');
}

function carsResponse(data: any, _lang: AILang): string {
  const cars   = data.cars ?? [];
  const status = data.status;

  const statusLabel: Record<string, string> = {
    AVAILABLE:      '✅ Disponibles',
    RENTED:         '🔑 En location',
    MAINTENANCE:    '🔧 En maintenance',
    OUT_OF_SERVICE: '⛔ Hors service',
  };

  const header = status ? statusLabel[status] ?? status : '🚗 Tous les véhicules';
  const lines  = [`🚗 *${header}* (${cars.length})`, ``];

  if (cars.length === 0) {
    lines.push('Aucun véhicule trouvé.');
    return lines.join('\n');
  }

  cars.slice(0, 10).forEach((c: any) => {
    const icon = c.status === 'AVAILABLE' ? '✅' : c.status === 'RENTED' ? '🔑' : '🔧';
    lines.push(`${icon} ${c.brand} ${c.model} ${c.year} — ${c.licensePlate} — ${formatMAD(c.pricePerDay)}/j`);
  });

  if (cars.length > 10) {
    lines.push(`   … et ${cars.length - 10} autre(s)`);
  }

  return lines.join('\n');
}

function platesResponse(data: any, _lang: AILang): string {
  const cars   = data.cars ?? [];
  const status = data.status;
  const query  = data.query;

  const statusLabel: Record<string, string> = {
    AVAILABLE:      '✅ Disponibles',
    RENTED:         '🔑 En location',
    MAINTENANCE:    '🔧 En maintenance',
    OUT_OF_SERVICE: '⛔ Hors service',
  };

  const statusIcon: Record<string, string> = {
    AVAILABLE: '✅', RENTED: '🔑', MAINTENANCE: '🔧', OUT_OF_SERVICE: '⛔',
  };

  const headerBase = query
    ? `*${query}*`
    : status ? statusLabel[status] ?? status : 'Tous les véhicules';

  const lines = [`🔢 *Matriculations — ${headerBase}* (${cars.length})`, ``];

  if (cars.length === 0) {
    lines.push(query
      ? `❌ Aucun véhicule "${query}" trouvé dans votre flotte.`
      : 'Aucune plaque trouvée.'
    );
    return lines.join('\n');
  }

  cars.forEach((c: any, i: number) => {
    const icon = statusIcon[c.status] ?? '🚗';
    lines.push(`${i + 1}. ${icon} *${c.licensePlate}* — ${c.brand} ${c.model} ${c.year}`);
  });

  return lines.join('\n');
}

function maintenanceDueResponse(data: any, _lang: AILang): string {
  const cars = data.cars ?? [];
  const days = data.days ?? 30;

  const lines = [`🔧 *Maintenance & Alertes — ${days} prochains jours* (${cars.length})`, ``];

  if (cars.length === 0) {
    lines.push(`✅ Aucune alerte maintenance dans les ${days} prochains jours.`);
    return lines.join('\n');
  }

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  cars.forEach((c: any) => {
    const alerts: string[] = [];
    if (c.status === 'MAINTENANCE') alerts.push('🔧 En maintenance');
    if (c.nextMaintenance)   alerts.push(`🔧 Entretien: ${fmt(c.nextMaintenance)}`);
    if (c.insuranceExpiry)   alerts.push(`📋 Assurance: ${fmt(c.insuranceExpiry)}`);
    if (c.technicalExpiry)   alerts.push(`🔍 Visite technique: ${fmt(c.technicalExpiry)}`);

    lines.push(`*${c.licensePlate}* — ${c.brand} ${c.model} ${c.year}`);
    alerts.forEach((a) => lines.push(`   • ${a}`));
    lines.push('');
  });

  return lines.join('\n').trimEnd();
}

function clientsResponse(data: any, _lang: AILang): string {
  const lines = [
    `👥 *Clients*`,
    ``,
    `📊 Total: ${data.total ?? 0}`,
    `🆕 Nouveaux ce mois: ${data.newThisMonth ?? 0}`,
    `🔄 Clients fidèles (2+ locations): ${data.returning ?? 0}`,
  ];

  if (data.top?.length > 0) {
    lines.push(``, `⭐ Top clients:`);
    data.top.slice(0, 5).forEach((c: any, i: number) => {
      lines.push(`   ${i + 1}. ${c.firstName} ${c.lastName} — ${c.totalRentals} locations — ${formatMAD(c.totalSpent)}`);
    });
  }

  return lines.join('\n');
}

function addCarResponse(data: any, _lang: AILang): string {
  if (data.error === 'missing_fields') {
    const provided = data.provided ?? {};
    const missing  = ['brand', 'model', 'year', 'licensePlate', 'pricePerDay']
      .filter((f) => !provided[f])
      .map((f) => ({ brand: 'Marque', model: 'Modèle', year: 'Année', licensePlate: 'N° immatriculation', pricePerDay: 'Prix/jour' })[f] ?? f);

    return [
      `⚠️ Informations manquantes:`,
      missing.map((f) => `   • ${f}`).join('\n'),
      ``,
      `Exemple: "Ajouter Dacia Logan 2022 A-12345-B 300 dh"`,
    ].join('\n');
  }

  const car = data.car;
  return [
    `✅ *Véhicule ajouté avec succès!*`,
    ``,
    `🚗 ${car.brand} ${car.model} (${car.year})`,
    `🔑 Immatriculation: ${car.licensePlate}`,
    `💰 Prix: ${formatMAD(car.pricePerDay)}/jour`,
    `📁 Statut: Disponible`,
  ].join('\n');
}

function deleteCarResponse(data: any, _lang: AILang): string {
  if (data.error === 'not_found') {
    return `❌ Aucun véhicule trouvé pour la recherche: "${data.query}"\n\nVérifiez le numéro de plaque ou le nom du véhicule.`;
  }
  if (data.error === 'car_rented') {
    const car = data.car;
    return `⚠️ Impossible de supprimer ${car.brand} ${car.model} (${car.licensePlate}) — ce véhicule est actuellement en location.`;
  }
  const car = data.car;
  return [
    `🗑️ *Véhicule retiré du parc*`,
    ``,
    `${car.brand} ${car.model} (${car.year}) — ${car.licensePlate} a été désactivé.`,
  ].join('\n');
}

function upcomingResponse(data: any, _lang: AILang): string {
  const list = data.reservations ?? [];
  const days = data.days ?? 3;

  if (list.length === 0) {
    return `✅ Aucun retour prévu dans les ${days} prochains jours.`;
  }

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const lines = [`⏰ *Retours prévus — ${days} prochains jours* (${list.length})`, ``];
  list.forEach((r: any) => {
    lines.push(`📅 ${fmt(r.endDate)}`);
    lines.push(`   🚗 ${r.car?.brand} ${r.car?.model} — *${r.car?.licensePlate}*`);
    lines.push(`   👤 ${r.client?.firstName} ${r.client?.lastName} — 📞 ${r.client?.phone ?? '—'}`);
    lines.push('');
  });

  return lines.join('\n').trimEnd();
}

function overdueResponse(data: any, _lang: AILang): string {
  const list = data.reservations ?? [];

  if (list.length === 0) {
    return `✅ Aucun retard — tous les véhicules ont été rendus à temps.`;
  }

  const now = new Date();
  const lines = [`🚨 *Retards — Voitures non rendues* (${list.length})`, ``];

  list.forEach((r: any) => {
    const end       = new Date(r.endDate);
    const diffMs    = now.getTime() - end.getTime();
    const diffDays  = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const delay     = diffDays > 0 ? `${diffDays}j ${diffHours}h de retard` : `${diffHours}h de retard`;

    lines.push(`⚠️ *${r.car?.brand} ${r.car?.model}* — ${r.car?.licensePlate}`);
    lines.push(`   👤 ${r.client?.firstName} ${r.client?.lastName} — 📞 ${r.client?.phone ?? '—'}`);
    lines.push(`   🕐 ${delay} (devait rentrer le ${end.toLocaleDateString('fr-FR')})`);
    lines.push('');
  });

  return lines.join('\n').trimEnd();
}

function findClientResponse(data: any, _lang: AILang): string {
  if (data.error === 'no_query') {
    return `❓ Précisez le nom, téléphone ou CIN du client à rechercher.`;
  }

  const clients = data.clients ?? [];

  if (clients.length === 0) {
    return `❌ Aucun client trouvé pour: "${data.query}"`;
  }

  const lines = [`👤 *Résultats pour "${data.query}"* (${clients.length})`, ``];
  clients.forEach((c: any) => {
    lines.push(`*${c.firstName} ${c.lastName}*`);
    lines.push(`   📞 ${c.phone ?? '—'}   🪪 ${c.cin ?? '—'}`);
    if (c.email) lines.push(`   📧 ${c.email}`);
    lines.push(`   📋 ${c._count?.reservations ?? 0} réservation(s)`);
    lines.push('');
  });

  return lines.join('\n').trimEnd();
}

function addClientResponse(data: any, _lang: AILang): string {
  if (data.error === 'missing_fields') {
    const labels: Record<string, string> = {
      firstName: 'Prénom', lastName: 'Nom', phone: 'Téléphone', cin: 'CIN',
    };
    const missing = (data.missing ?? []).map((f: string) => labels[f] ?? f);
    return [
      `⚠️ Informations manquantes:`,
      missing.map((f: string) => `   • ${f}`).join('\n'),
      ``,
      `Exemple: "Zid client Mohamed Benali 0661234567 AB123456"`,
    ].join('\n');
  }

  if (data.error === 'cin_exists') {
    const c = data.existing;
    return `⚠️ Un client avec ce CIN existe déjà:\n*${c.firstName} ${c.lastName}* — 📞 ${c.phone}`;
  }

  const c = data.client;
  return [
    `✅ *Client ajouté avec succès!*`,
    ``,
    `👤 ${c.firstName} ${c.lastName}`,
    `📞 ${c.phone}`,
    `🪪 CIN: ${c.cin}`,
    c.email ? `📧 ${c.email}` : null,
  ].filter(Boolean).join('\n');
}

function findCarResponse(data: any, _lang: AILang): string {
  if (data.error === 'no_query') {
    return `❓ Précisez la plaque, marque ou modèle du véhicule.`;
  }

  const cars = data.cars ?? [];

  if (cars.length === 0) {
    return `❌ Aucun véhicule trouvé pour: "${data.query}"`;
  }

  const statusIcon: Record<string, string> = {
    AVAILABLE: '✅', RENTED: '🔑', MAINTENANCE: '🔧', OUT_OF_SERVICE: '⛔',
  };
  const statusLabel: Record<string, string> = {
    AVAILABLE: 'Disponible', RENTED: 'En location', MAINTENANCE: 'En maintenance', OUT_OF_SERVICE: 'Hors service',
  };

  const lines = [`🚗 *Résultats pour "${data.query}"* (${cars.length})`, ``];
  cars.forEach((c: any) => {
    const icon = statusIcon[c.status] ?? '🚗';
    lines.push(`${icon} *${c.brand} ${c.model} (${c.year})* — ${c.licensePlate}`);
    lines.push(`   Statut: ${statusLabel[c.status] ?? c.status}`);
    lines.push(`   💰 ${formatMAD(c.pricePerDay)}/jour`);
    if (c.reservations?.[0]) {
      const res = c.reservations[0];
      lines.push(`   👤 En location: ${res.client?.firstName} ${res.client?.lastName} — 📞 ${res.client?.phone ?? '—'}`);
    }
    lines.push('');
  });

  return lines.join('\n').trimEnd();
}

function pendingPaymentsResponse(data: any, _lang: AILang): string {
  const payments = data.payments ?? [];
  const total    = data.total ?? 0;

  if (payments.length === 0) {
    return `✅ Aucun paiement en attente — tout est réglé!`;
  }

  const lines = [
    `💳 *Paiements en attente* (${payments.length})`,
    `💰 Total dû: ${formatMAD(total)}`,
    ``,
  ];

  payments.slice(0, 10).forEach((p: any) => {
    const client = p.reservation?.client;
    const car    = p.reservation?.car;
    lines.push(`• *${formatMAD(Number(p.amount))}* — ${client?.firstName ?? '?'} ${client?.lastName ?? ''}`);
    if (car) lines.push(`   🚗 ${car.brand} ${car.model} — ${car.licensePlate}`);
    if (client?.phone) lines.push(`   📞 ${client.phone}`);
    lines.push('');
  });

  if (payments.length > 10) {
    lines.push(`   … et ${payments.length - 10} autre(s)`);
  }

  return lines.join('\n').trimEnd();
}

function statsSummaryResponse(data: any, _lang: AILang): string {
  const cars = data.cars ?? {};

  const utilizationRate = cars.total > 0
    ? Math.round((cars.rented / cars.total) * 100)
    : 0;

  const lines = [
    `📊 *Vue d'ensemble*`,
    ``,
    `🚗 Flotte: ${cars.total} véhicules`,
    `   ✅ Disponibles: ${cars.available}`,
    `   🔑 En location: ${cars.rented} (${utilizationRate}% d'utilisation)`,
    `   🔧 Maintenance: ${cars.maintenance}`,
    ``,
    `📅 Réservations actives: ${data.activeReservations ?? 0}`,
  ];

  if ((data.overdueReservations ?? 0) > 0) {
    lines.push(`🚨 Retards: ${data.overdueReservations} voiture(s) non rendue(s)!`);
  }

  if ((data.returnsToday ?? 0) > 0) {
    lines.push(`⏰ Retours aujourd'hui: ${data.returnsToday}`);
  }

  lines.push(``, `💰 Revenus ce mois: ${formatMAD(data.revenueMonth ?? 0)}`);

  if ((data.pendingCount ?? 0) > 0) {
    lines.push(`⏳ En attente: ${formatMAD(data.pendingAmount ?? 0)} (${data.pendingCount} paiement(s))`);
  }

  lines.push(`🆕 Nouveaux clients ce mois: ${data.newClientsMonth ?? 0}`);

  return lines.join('\n');
}

function unauthorizedResponse(_lang: AILang): string {
  return `🔒 Action non autorisée.\n\nSeul l'administrateur de l'agence peut ajouter ou supprimer des véhicules.`;
}

function unknownResponse(lang: AILang): string {
  const suggestions: Record<AILang, string[]> = {
    darija: [
      '📊 "عطيني rapport ديال هاد الشهر"',
      '💰 "كيفاش هي ليرفيني ديال هاد الأسبوع"',
      '🚗 "شحال من سيارة كاينة"',
      '🔢 "عطيني les matriculations"',
      '🔧 "tomobilat li 9rib lihom maintenance"',
      '📅 "عطيني ليزرفاسيون ديال اليوم"',
    ],
    ar: [
      '📊 "أعطني تقرير هذا الشهر"',
      '💰 "كم هي الإيرادات هذا الأسبوع؟"',
      '🚗 "كم سيارة متاحة؟"',
      '🔢 "أعطني أرقام لوحات السيارات"',
      '🔧 "السيارات القريبة من الصيانة"',
      '📅 "أعطني الحجوزات النشطة"',
    ],
    fr: [
      '📊 "Rapport du mois"',
      '💰 "Revenus de cette semaine"',
      '🚗 "Véhicules disponibles"',
      '🔢 "Liste des matriculations"',
      '🔧 "Voitures dont la maintenance est proche"',
      '📅 "Réservations actives"',
    ],
    en: [
      '📊 "Monthly report"',
      '💰 "Revenue this week"',
      '🚗 "Available cars"',
      '🔢 "List license plates"',
      '🔧 "Cars due for maintenance"',
      '📅 "Active reservations"',
    ],
  };

  const intro: Record<AILang, string> = {
    darija: '❓ ما فهمتكش. جرب:',
    ar:     '❓ لم أفهم طلبك. جرب:',
    fr:     '❓ Je n\'ai pas compris. Essayez:',
    en:     '❓ I didn\'t understand. Try:',
  };

  return [intro[lang], '', ...(suggestions[lang] ?? suggestions.fr)].join('\n');
}

// ── Main export ────────────────────────────────────
export function generateAIResponse(action: AIAction | string, data: any, lang: AILang = 'fr'): string {
  switch (action) {
    case 'get_report':           return reportResponse(data, lang);
    case 'get_revenue':          return revenueResponse(data, lang);
    case 'get_reservations':     return reservationsResponse(data, lang);
    case 'get_cars':             return carsResponse(data, lang);
    case 'get_plates':           return platesResponse(data, lang);
    case 'get_maintenance_due':  return maintenanceDueResponse(data, lang);
    case 'get_clients':          return clientsResponse(data, lang);
    case 'add_car':              return addCarResponse(data, lang);
    case 'delete_car':           return deleteCarResponse(data, lang);
    case 'get_upcoming':         return upcomingResponse(data, lang);
    case 'get_overdue':          return overdueResponse(data, lang);
    case 'find_client':          return findClientResponse(data, lang);
    case 'add_client':           return addClientResponse(data, lang);
    case 'find_car':             return findCarResponse(data, lang);
    case 'get_pending_payments': return pendingPaymentsResponse(data, lang);
    case 'get_stats_summary':    return statsSummaryResponse(data, lang);
    case 'unauthorized':         return unauthorizedResponse(lang);
    default:                     return unknownResponse(lang);
  }
}
