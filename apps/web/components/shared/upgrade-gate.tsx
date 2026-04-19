'use client';

import { Lock, Zap, Check } from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import {
  PlanFeatures, PlanKey,
  PLAN_LABELS, PLAN_PRICES, PLAN_HIGHLIGHTS,
  getRequiredPlanForFeature,
} from '@/lib/plan.config';

// ── Plan badge colors ──────────────────────────
const BADGE: Record<PlanKey, { bg: string; text: string; border: string; glow: string }> = {
  basic:      { bg: 'bg-slate-500/10',   text: 'text-slate-300',  border: 'border-slate-500/30',  glow: '' },
  pro:        { bg: 'bg-blue-500/10',    text: 'text-blue-300',   border: 'border-blue-500/30',   glow: 'shadow-blue-500/20' },
  enterprise: { bg: 'bg-violet-500/10',  text: 'text-violet-300', border: 'border-violet-500/30', glow: 'shadow-violet-500/20' },
};

// ── UpgradeGate ────────────────────────────────
interface UpgradeGateProps {
  feature:  keyof Omit<PlanFeatures, 'maxVehicles' | 'maxUsers'>;
  children: React.ReactNode;
}

export function UpgradeGate({ feature, children }: UpgradeGateProps) {
  const { hasFeature, plan, planLabel } = usePlan();

  if (hasFeature(feature)) return <>{children}</>;

  const required = getRequiredPlanForFeature(feature);
  const badge    = BADGE[required];

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      {/* Lock icon */}
      <div className="relative mb-6">
        <div className={`w-20 h-20 rounded-2xl ${badge.bg} border ${badge.border} flex items-center justify-center shadow-lg ${badge.glow}`}>
          <Lock className={`w-8 h-8 ${badge.text}`} />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
          <Zap className="w-3 h-3 text-white" />
        </div>
      </div>

      {/* Message */}
      <h2 className="text-xl font-bold text-white mb-2">
        Fonctionnalité non disponible
      </h2>
      <p className="text-slate-400 mb-1 text-sm">
        Votre plan actuel :{' '}
        <span className="font-semibold text-white">{planLabel}</span>
      </p>
      <p className="text-slate-400 mb-8 text-sm">
        Cette fonctionnalité est disponible à partir du plan{' '}
        <span className={`font-bold ${badge.text}`}>{PLAN_LABELS[required]}</span>
      </p>

      {/* Plan cards */}
      <div className="flex flex-wrap justify-center gap-4 max-w-2xl">
        {(['basic', 'pro', 'enterprise'] as PlanKey[])
          .filter((p) => p === required || PLAN_HIGHLIGHTS[p].length > 0)
          .map((p) => {
            const b       = BADGE[p];
            const isCurrent   = p === plan;
            const isRequired  = p === required;

            return (
              <div
                key={p}
                className={`relative w-56 rounded-2xl border p-5 text-left transition-all ${
                  isRequired
                    ? `${b.bg} ${b.border} shadow-lg ${b.glow}`
                    : 'bg-white/3 border-white/8 opacity-60'
                }`}
              >
                {isRequired && (
                  <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${b.bg} ${b.text} ${b.border} border`}>
                    Recommandé
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-600 text-slate-300 border border-slate-500">
                    Actuel
                  </div>
                )}

                <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isRequired ? b.text : 'text-slate-500'}`}>
                  {PLAN_LABELS[p]}
                </p>
                <p className="text-2xl font-bold text-white mb-4">
                  {PLAN_PRICES[p]} <span className="text-sm font-normal text-slate-400">MAD/mois</span>
                </p>

                <ul className="space-y-1.5">
                  {PLAN_HIGHLIGHTS[p].map((h) => (
                    <li key={h} className="flex items-start gap-2 text-xs text-slate-300">
                      <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isRequired ? b.text : 'text-slate-600'}`} />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
      </div>

      {/* CTA */}
      <p className="mt-8 text-xs text-slate-600">
        Contactez votre administrateur SaaS pour mettre à niveau votre abonnement.
      </p>
    </div>
  );
}
