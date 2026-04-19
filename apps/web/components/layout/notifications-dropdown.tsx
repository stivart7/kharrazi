'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarClock, Wrench, X, Zap, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { analyticsApi } from '@/lib/api/analytics';
import { planRequestsApi } from '@/lib/api/plan-requests';
import { useAuthStore } from '@/store/auth.store';
import { PLAN_LABELS, PlanKey } from '@/lib/plan.config';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'return' | 'maintenance' | 'upgrade' | 'info';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  action?: React.ReactNode;
}

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['dashboard-notifications'],
    queryFn: () => analyticsApi.getDashboard().then((r) => r.data.data),
    refetchInterval: 60_000,
    enabled: !isSuperAdmin,
  });

  const { data: upgradeRequests } = useQuery({
    queryKey: ['upgrade-requests'],
    queryFn: () => planRequestsApi.getAll().then((r) => r.data.data),
    refetchInterval: 30_000,
    enabled: isSuperAdmin,
  });

  const { mutate: approve } = useMutation({
    mutationFn: (id: string) => planRequestsApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['upgrade-requests'] }),
  });

  const { mutate: reject } = useMutation({
    mutationFn: (id: string) => planRequestsApi.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['upgrade-requests'] }),
  });

  const notifications: Notification[] = [];

  if (isSuperAdmin) {
    // Show pending upgrade requests
    const pending = (upgradeRequests ?? []).filter((r: any) => r.status === 'pending');
    pending.forEach((r: any) => {
      notifications.push({
        id: `upgrade-${r.id}`,
        type: 'upgrade',
        title: `Demande de mise à niveau`,
        description: `${r.agency.name} → Plan ${PLAN_LABELS[r.requestedPlan as PlanKey]}`,
        icon: <Zap className="w-4 h-4" />,
        color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
        action: (
          <div className="flex gap-1.5 mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); approve(r.id); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/25 transition-colors"
            >
              <Check className="w-3 h-3" /> Approuver
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); reject(r.id); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 text-[10px] font-semibold hover:bg-red-500/25 transition-colors"
            >
              <X className="w-3 h-3" /> Refuser
            </button>
          </div>
        ),
      });
    });
  } else {
    // Upcoming returns
    if (data?.upcomingReturns?.length) {
      data.upcomingReturns.forEach((r: any) => {
        const endDate = new Date(r.endDate);
        const isToday = endDate.toDateString() === new Date().toDateString();
        notifications.push({
          id: `return-${r.id}`,
          type: 'return',
          title: `Retour — ${r.car.brand} ${r.car.model}`,
          description: `${r.client.firstName} ${r.client.lastName} · ${isToday ? "Aujourd'hui" : formatDistanceToNow(endDate, { addSuffix: true, locale: fr })}`,
          icon: <CalendarClock className="w-4 h-4" />,
          color: isToday ? 'text-red-500 bg-red-50 dark:bg-red-500/10' : 'text-orange-500 bg-orange-50 dark:bg-orange-500/10',
        });
      });
    }

    // Cars in maintenance
    if (data?.kpis?.maintenanceCars > 0) {
      notifications.push({
        id: 'maintenance',
        type: 'maintenance',
        title: `${data.kpis.maintenanceCars} véhicule(s) en maintenance`,
        description: 'Vérifiez le planning de maintenance',
        icon: <Wrench className="w-4 h-4" />,
        color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-500/10',
      });
    }
  }

  const count = notifications.length;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className={cn(
            'absolute top-1.5 right-1.5 w-2 h-2 rounded-full',
            isSuperAdmin ? 'bg-amber-500' : 'bg-red-500'
          )} />
        )}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="fixed right-4 top-14 z-50 w-80 rounded-xl border bg-background shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="font-semibold text-sm">
                {isSuperAdmin ? 'Demandes de mise à niveau' : 'Notifications'}
              </p>
              <div className="flex items-center gap-2">
                {count > 0 && (
                  <span className={cn(
                    'text-xs text-white rounded-full px-2 py-0.5',
                    isSuperAdmin ? 'bg-amber-500' : 'bg-red-500'
                  )}>
                    {count}
                  </span>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {isSuperAdmin ? 'Aucune demande en attente' : 'Aucune notification'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y">
                  {notifications.map((n) => (
                    <li key={n.id} className="px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${n.color}`}>
                          {n.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
                          {n.action}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Show history link for super admin */}
            {isSuperAdmin && (upgradeRequests ?? []).filter((r: any) => r.status !== 'pending').length > 0 && (
              <div className="border-t px-4 py-2">
                <p className="text-[10px] text-muted-foreground">
                  {(upgradeRequests ?? []).filter((r: any) => r.status !== 'pending').length} demande(s) traitée(s)
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
