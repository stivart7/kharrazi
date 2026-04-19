// ── Plan Feature Access Control (Frontend) ────
// Keep in sync with apps/api/src/config/plan.config.ts

export type PlanKey = 'basic' | 'pro' | 'enterprise';

export interface PlanFeatures {
  cars:          boolean;
  reservations:  boolean;
  clients:       boolean;
  payments:      boolean;
  contracts:     boolean;
  invoices:      boolean;
  maintenance:   boolean;
  reports:       boolean;
  ai_assistant:  boolean;
  users:         boolean;
  settings:      boolean;
  maxVehicles:   number | null;
  maxUsers:      number | null;
}

export const PLAN_FEATURES: Record<PlanKey, PlanFeatures> = {
  basic: {
    cars: true, reservations: true, clients: true,
    payments: true, contracts: true, invoices: true,
    maintenance: false, reports: false, ai_assistant: false,
    users: true, settings: true,
    maxVehicles: 5, maxUsers: 2,
  },
  pro: {
    cars: true, reservations: true, clients: true,
    payments: true, contracts: true, invoices: true,
    maintenance: true, reports: true, ai_assistant: false,
    users: true, settings: true,
    maxVehicles: 20, maxUsers: 5,
  },
  enterprise: {
    cars: true, reservations: true, clients: true,
    payments: true, contracts: true, invoices: true,
    maintenance: true, reports: true, ai_assistant: true,
    users: true, settings: true,
    maxVehicles: null, maxUsers: null,
  },
};

export const PLAN_LABELS: Record<PlanKey, string> = {
  basic:      'Basic',
  pro:        'Pro',
  enterprise: 'Enterprise',
};

export const PLAN_PRICES: Record<PlanKey, number> = {
  basic:      99,
  pro:        199,
  enterprise: 399,
};

export const PLAN_COLORS: Record<PlanKey, string> = {
  basic:      'slate',
  pro:        'blue',
  enterprise: 'violet',
};

// What each plan unlocks over the previous
export const PLAN_HIGHLIGHTS: Record<PlanKey, string[]> = {
  basic: [
    'Véhicules (max 5)',
    'Réservations & Clients',
    'Paiements & Contrats',
    'Facturation',
    '2 utilisateurs max',
  ],
  pro: [
    'Tout BASIC inclus',
    'Maintenance',
    'Rapports & Analyses',
    '20 véhicules max',
    '5 utilisateurs max',
  ],
  enterprise: [
    'Tout PRO inclus',
    'Assistant IA',
    'Véhicules & Utilisateurs illimités',
    'Support prioritaire',
    'Branding personnalisé',
  ],
};

export function getPlanFeatures(plan: string | null | undefined): PlanFeatures {
  const key = (plan ?? 'basic').toLowerCase() as PlanKey;
  return PLAN_FEATURES[key] ?? PLAN_FEATURES.basic;
}

export function getRequiredPlanForFeature(
  feature: keyof Omit<PlanFeatures, 'maxVehicles' | 'maxUsers'>,
): PlanKey {
  if (PLAN_FEATURES.basic[feature]) return 'basic';
  if (PLAN_FEATURES.pro[feature])   return 'pro';
  return 'enterprise';
}
