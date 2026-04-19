import { useAuthStore } from '@/store/auth.store';
import {
  getPlanFeatures,
  getRequiredPlanForFeature,
  PLAN_LABELS,
  PLAN_PRICES,
  PlanFeatures,
  PlanKey,
} from '@/lib/plan.config';

export function usePlan() {
  const user = useAuthStore((s) => s.user);
  const plan = ((user?.agency as any)?.plan ?? 'basic').toLowerCase() as PlanKey;
  const features = getPlanFeatures(plan);

  return {
    plan,
    planLabel:   PLAN_LABELS[plan]  ?? 'Basic',
    planPrice:   PLAN_PRICES[plan]  ?? 99,
    features,

    /** Returns true if the current plan includes this feature */
    hasFeature: (feature: keyof Omit<PlanFeatures, 'maxVehicles' | 'maxUsers'>): boolean =>
      features[feature],

    /** Returns the minimum plan required for a feature */
    requiredPlan: (feature: keyof Omit<PlanFeatures, 'maxVehicles' | 'maxUsers'>): PlanKey =>
      getRequiredPlanForFeature(feature),

    isBasic:      plan === 'basic',
    isPro:        plan === 'pro',
    isEnterprise: plan === 'enterprise',

    maxVehicles: features.maxVehicles,
    maxUsers:    features.maxUsers,
  };
}
