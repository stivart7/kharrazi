'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, X, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { planRequestsApi } from '@/lib/api/plan-requests';
import { PLAN_LABELS, PLAN_PRICES, PLAN_HIGHLIGHTS, PlanKey } from '@/lib/plan.config';
import { cn } from '@/lib/utils';

const PLAN_COLORS: Record<PlanKey, { badge: string; card: string; btn: string; text: string }> = {
  basic:      { badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30', card: 'border-slate-500/30 bg-slate-500/5',  btn: 'bg-slate-600 hover:bg-slate-500',   text: 'text-slate-300' },
  pro:        { badge: 'bg-blue-500/20  text-blue-300  border-blue-500/30',  card: 'border-blue-500/30  bg-blue-500/5',   btn: 'bg-blue-600  hover:bg-blue-500',    text: 'text-blue-300'  },
  enterprise: { badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30', card: 'border-violet-500/30 bg-violet-500/5', btn: 'bg-violet-600 hover:bg-violet-500', text: 'text-violet-300' },
};

export function UpgradeBar() {
  const { plan, planLabel, isEnterprise } = usePlan();
  const [expanded, setExpanded]   = useState(false);
  const [selected, setSelected]   = useState<'pro' | 'enterprise' | null>(null);
  const [message,  setMessage]    = useState('');
  const [sent,     setSent]       = useState(false);
  const qc = useQueryClient();

  // Check if there's already a pending request
  const { data: myReq } = useQuery({
    queryKey: ['plan-request-my'],
    queryFn:  () => planRequestsApi.getMy().then((r) => r.data.data),
    staleTime: 30_000,
  });

  const { mutate: sendRequest, isPending } = useMutation({
    mutationFn: () => planRequestsApi.create(selected!, message || undefined),
    onSuccess: () => {
      setSent(true);
      qc.invalidateQueries({ queryKey: ['plan-request-my'] });
    },
  });

  // Don't show for enterprise (already max plan)
  if (isEnterprise) return null;

  const currentColor = PLAN_COLORS[plan as PlanKey] ?? PLAN_COLORS.basic;
  const hasPending   = myReq?.status === 'pending';
  const wasApproved  = myReq?.status === 'approved';
  const wasRejected  = myReq?.status === 'rejected';

  return (
    <div className="mx-6 mt-4 mb-0 rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
      {/* ── Header bar ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-500/5 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white leading-tight">
            {hasPending
              ? 'Demande de mise à niveau en attente'
              : wasApproved
              ? 'Plan mis à niveau !'
              : wasRejected
              ? 'Demande refusée — contactez le support'
              : 'Mettez à niveau votre plan'}
          </p>
          <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
            Plan actuel :{' '}
            <span className={cn('font-semibold', currentColor.text)}>{planLabel}</span>
            {hasPending && (
              <span className="ml-2 text-amber-400">
                → {PLAN_LABELS[myReq.requestedPlan as PlanKey]}
              </span>
            )}
          </p>
        </div>

        {!hasPending && !wasApproved && (
          expanded
            ? <ChevronUp  className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        )}
      </button>

      {/* ── Expanded plan cards ── */}
      {expanded && !hasPending && !wasApproved && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          {sent ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Check className="w-4 h-4 text-emerald-400" />
              <p className="text-sm text-emerald-400 font-medium">Demande envoyée ! L'administrateur SaaS vous contactera.</p>
            </div>
          ) : (
            <>
              {/* Plan cards */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {(['pro', 'enterprise'] as const).map((p) => {
                  const c        = PLAN_COLORS[p];
                  const isSelect = selected === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setSelected(isSelect ? null : p)}
                      className={cn(
                        'relative text-left rounded-xl border p-3 transition-all',
                        isSelect
                          ? `${c.card} ${c.badge} ring-1 ring-inset ring-current`
                          : 'border-white/8 bg-white/3 hover:border-white/20',
                      )}
                    >
                      {isSelect && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-current flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-[#0f1117]" />
                        </span>
                      )}
                      <p className={cn('text-[10px] font-bold uppercase tracking-wider mb-0.5', isSelect ? c.text : 'text-slate-500')}>
                        {PLAN_LABELS[p]}
                      </p>
                      <p className="text-base font-bold text-white">
                        {PLAN_PRICES[p]} <span className="text-[10px] font-normal text-slate-500">MAD/mois</span>
                      </p>
                      <ul className="mt-2 space-y-1">
                        {PLAN_HIGHLIGHTS[p].slice(0, 3).map((h) => (
                          <li key={h} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            <Check className={cn('w-2.5 h-2.5 flex-shrink-0', isSelect ? c.text : 'text-slate-600')} />
                            {h}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {/* Optional message */}
              {selected && (
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Message optionnel pour l'administrateur…"
                  rows={2}
                  className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none focus:border-white/20 mb-3"
                />
              )}

              {/* Send button */}
              <button
                disabled={!selected || isPending}
                onClick={() => sendRequest()}
                className={cn(
                  'w-full py-2 rounded-lg text-xs font-semibold text-white transition-all flex items-center justify-center gap-2',
                  selected
                    ? `${PLAN_COLORS[selected].btn}`
                    : 'bg-white/5 text-slate-600 cursor-not-allowed'
                )}
              >
                {isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Envoi…</>
                ) : (
                  <><Zap className="w-3.5 h-3.5" /> Demander la mise à niveau{selected ? ` → ${PLAN_LABELS[selected]}` : ''}</>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
