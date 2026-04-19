// ── Plan Feature Access Control ────────────────
// Single source of truth for what each plan includes.
// Keep in sync with apps/web/lib/plan.config.ts

export type PlanKey = 'basic' | 'pro' | 'enterprise';

export interface PlanFeatures {
  // Sidebar modules
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
  // Resource limits (null = unlimited)
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

export function getPlanFeatures(plan: string | null | undefined): PlanFeatures {
  const key = (plan ?? 'basic').toLowerCase() as PlanKey;
  return PLAN_FEATURES[key] ?? PLAN_FEATURES.basic;
}

export function getRequiredPlanForFeature(
  feature: keyof Omit<PlanFeatures, 'maxVehicles' | 'maxUsers'>,
): PlanKey {
  if (PLAN_FEATURES.basic[feature])      return 'basic';
  if (PLAN_FEATURES.pro[feature])        return 'pro';
  return 'enterprise';
}
