'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Car, Users, Calendar, CreditCard, BarChart3, Settings,
  ChevronLeft, ChevronRight, Building2, LogOut, FileText,
  Receipt, Wrench, TrendingUp, LayoutDashboard,
  AlertTriangle, Package, SlidersHorizontal, Sparkles, Lock, Zap, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api/auth';
import { analyticsApi } from '@/lib/api/analytics';
import { carsApi } from '@/lib/api/cars';
import { usePlan } from '@/hooks/use-plan';
import { PLAN_LABELS, PlanKey } from '@/lib/plan.config';
import type { PlanFeatures } from '@/lib/plan.config';
import { useThemeStore, ACCENT_CONFIGS } from '@/store/theme.store';

// ── Types ──────────────────────────────────────────────
interface NavItem {
  href:      string;
  label:     string;
  icon:      React.ComponentType<{ className?: string }>;
  roles?:    string[];
  badgeKey?: 'pending' | 'maintenance';
  feature?:  keyof Omit<PlanFeatures, 'maxVehicles' | 'maxUsers'>;
}

interface NavGroup {
  key:    string;
  label?: string;
  roles?: string[];
  items:  NavItem[];
}

// ── Nav structure ──────────────────────────────────────
const NAV_GROUPS: NavGroup[] = [
  {
    key: 'main',
    roles: ['AGENCY_ADMIN', 'EMPLOYEE', 'ACCOUNTANT'],
    items: [
      { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    ],
  },
  {
    key: 'gestion', label: 'Gestion', roles: ['AGENCY_ADMIN', 'EMPLOYEE', 'ACCOUNTANT'],
    items: [
      { href: '/cars',         label: 'Véhicules',    icon: Car },
      { href: '/reservations', label: 'Réservations', icon: Calendar, badgeKey: 'pending' },
      { href: '/clients',      label: 'Clients',      icon: Users },
    ],
  },
  {
    key: 'finance', label: 'Finance', roles: ['AGENCY_ADMIN', 'EMPLOYEE', 'ACCOUNTANT'],
    items: [
      { href: '/contracts', label: 'Contrats',    icon: FileText },
      { href: '/invoices',  label: 'Facturation', icon: Receipt },
      { href: '/payments',  label: 'Paiements',   icon: CreditCard },
    ],
  },
  {
    key: 'systeme', label: 'Système', roles: ['AGENCY_ADMIN', 'EMPLOYEE', 'ACCOUNTANT'],
    items: [
      { href: '/maintenance',  label: 'Maintenance',  icon: Wrench,    badgeKey: 'maintenance', feature: 'maintenance'  },
      { href: '/reports',      label: 'Rapports',     icon: BarChart3,                          feature: 'reports'      },
      { href: '/ai-assistant', label: 'Assistant IA', icon: Sparkles,                           feature: 'ai_assistant' },
      { href: '/users',        label: 'Utilisateurs', icon: Users,     roles: ['AGENCY_ADMIN'] },
      { href: '/settings',     label: 'Paramètres',   icon: Settings },
    ],
  },
  {
    key: 'admin', label: 'Plateforme SaaS', roles: ['SUPER_ADMIN'],
    items: [
      { href: '/saas',          label: 'Dashboard SaaS',   icon: TrendingUp },
      { href: '/agencies',      label: 'Agences',          icon: Building2  },
      { href: '/plans',         label: 'Plans & Tarifs',   icon: Package    },
      { href: '/saas-settings', label: 'Paramètres SaaS',  icon: SlidersHorizontal },
    ],
  },
];

// ── Props ──────────────────────────────────────────────
interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  onClose?: () => void;   // mobile drawer close
}

// ── Component ──────────────────────────────────────────
export function Sidebar({ open, onToggle, onClose }: SidebarProps) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { hasFeature, planLabel, requiredPlan } = usePlan();
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);

  // Theme
  const { mode, accent, sidebarStyle } = useThemeStore();
  const accentHex = ACCENT_CONFIGS[accent].hex;
  const isColored = sidebarStyle === 'colored';
  const isDarkSidebar = sidebarStyle === 'dark';
  const isDefaultSidebar = sidebarStyle === 'default';

  // Stats for badges + context card
  const { data: dash } = useQuery({
    queryKey: ['sidebar-dash'],
    queryFn:  () => analyticsApi.getDashboard().then((r) => r.data.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: carsStats } = useQuery({
    queryKey: ['cars-stats'],
    queryFn:  () => carsApi.getStats().then((r) => r.data.data),
    staleTime: 30_000,
  });

  const badges: Record<string, number> = {
    pending:     dash?.reservationsByStatus?.PENDING     ?? 0,
    maintenance: carsStats?.maintenance ?? 0,
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    router.push('/login');
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // ── Style helpers ──────────────────────────────────
  const sidebarBg = isColored
    ? accentHex
    : isDarkSidebar
      ? '#0f1117'
      : mode === 'dark' ? '#0f172a' : '#ffffff';

  const sidebarBorder = isColored
    ? 'rgba(255,255,255,0.15)'
    : isDarkSidebar
      ? 'rgba(255,255,255,0.05)'
      : mode === 'dark' ? '#1e293b' : '#e2e8f0';

  const sidebarTextColor = isColored || isDarkSidebar
    ? '#e2e8f0'
    : mode === 'dark' ? '#e2e8f0' : '#0f172a';

  const dividerColor = isColored
    ? 'rgba(255,255,255,0.15)'
    : isDarkSidebar
      ? 'rgba(255,255,255,0.05)'
      : mode === 'dark' ? '#1e293b' : '#e2e8f0';

  const labelColor = isColored
    ? 'rgba(255,255,255,0.5)'
    : isDarkSidebar
      ? '#4b5563'
      : mode === 'dark' ? '#64748b' : '#94a3b8';

  // Nav item styles
  const getItemActiveClass = () => cn(
    'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-full',
    isColored
      ? 'before:bg-white'
      : 'before:bg-[hsl(var(--primary))]'
  );

  const getItemActiveBg = () => isColored
    ? 'rgba(255,255,255,0.2)'
    : 'hsl(var(--primary) / 0.15)';

  const getItemActiveTextColor = () => isColored ? '#ffffff' : 'hsl(var(--primary))';

  const getItemInactiveTextColor = () => isColored
    ? 'rgba(255,255,255,0.7)'
    : isDarkSidebar
      ? '#64748b'
      : mode === 'dark' ? '#64748b' : '#64748b';

  const getItemHoverBg = () => isColored
    ? 'rgba(255,255,255,0.1)'
    : isDarkSidebar
      ? 'rgba(255,255,255,0.05)'
      : mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9';

  // Context card style
  const ctxCardBg = isColored
    ? 'rgba(255,255,255,0.12)'
    : 'rgba(59,130,246,0.1)';
  const ctxCardBorder = isColored
    ? 'rgba(255,255,255,0.2)'
    : 'rgba(59,130,246,0.2)';
  const ctxCardStatBg = isColored
    ? 'rgba(255,255,255,0.1)'
    : 'rgba(255,255,255,0.05)';

  // Toggle button
  const toggleBg = isColored
    ? 'rgba(255,255,255,0.15)'
    : isDarkSidebar
      ? '#1a1d27'
      : mode === 'dark' ? '#1e293b' : '#ffffff';
  const toggleBorder = isColored
    ? 'rgba(255,255,255,0.3)'
    : isDarkSidebar
      ? 'rgba(255,255,255,0.1)'
      : mode === 'dark' ? '#334155' : '#e2e8f0';

  return (
    <aside
      className={cn('relative flex flex-col sidebar-transition z-20', open ? 'w-64' : 'w-16')}
      style={{
        backgroundColor: sidebarBg,
        borderRight: `1px solid ${sidebarBorder}`,
        color: sidebarTextColor,
      }}
    >
      {/* ── Logo ── */}
      <div
        className={cn('flex items-center p-4', !open && 'justify-center')}
        style={{ borderBottom: `1px solid ${dividerColor}` }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 shadow-lg"
          style={{
            backgroundColor: isColored ? 'rgba(255,255,255,0.25)' : accentHex,
            boxShadow: isColored ? undefined : `0 4px 12px ${accentHex}40`,
          }}
        >
          <Car className="w-4 h-4 text-white" />
        </div>
        {open && (
          <div className="ml-3 flex-1 overflow-hidden">
            <p className="font-bold text-sm leading-tight" style={{ color: sidebarTextColor }}>Kharrazi Fleet</p>
            <p className="text-[11px]" style={{ color: labelColor }}>Location Voitures</p>
          </div>
        )}
        {/* Mobile close button */}
        {open && onClose && (
          <button
            onClick={onClose}
            className="ml-2 flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: labelColor }}
            aria-label="Fermer le menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Smart context card ── */}
      {open && !isSuperAdmin && (
        <div
          className="mx-3 mt-3 p-3 rounded-xl"
          style={{ backgroundColor: ctxCardBg, border: `1px solid ${ctxCardBorder}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Building2
              className="w-3.5 h-3.5 flex-shrink-0"
              style={{ color: isColored ? 'rgba(255,255,255,0.8)' : '#60a5fa' }}
            />
            <p
              className="text-xs font-semibold truncate"
              style={{ color: isColored ? 'rgba(255,255,255,0.9)' : '#93c5fd' }}
            >
              {user?.agency?.name ?? 'Mon agence'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg px-2 py-1.5 text-center" style={{ backgroundColor: ctxCardStatBg }}>
              <p className="text-base font-bold leading-none" style={{ color: sidebarTextColor }}>{carsStats?.total ?? '—'}</p>
              <p className="text-[10px] mt-0.5" style={{ color: labelColor }}>véhicules</p>
            </div>
            <div className="rounded-lg px-2 py-1.5 text-center" style={{ backgroundColor: ctxCardStatBg }}>
              <p className="text-base font-bold text-emerald-400 leading-none">{carsStats?.available ?? '—'}</p>
              <p className="text-[10px] mt-0.5" style={{ color: labelColor }}>disponibles</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {NAV_GROUPS.filter((g) => !g.roles || g.roles.includes(user?.role ?? '')).map((group) => (
          <div key={group.key} className="mb-1">
            {/* Group label */}
            {open && group.label && (
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: labelColor }}>
                {group.label}
              </p>
            )}
            {!open && group.label && (
              <div className="my-1 mx-2 h-px" style={{ backgroundColor: dividerColor }} />
            )}

            {/* Items */}
            {group.items
              .filter((item) => !item.roles || item.roles.includes(user?.role ?? ''))
              .map((item) => {
                const isActive   = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const badgeCount = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0;
                const isLocked   = !!item.feature && !hasFeature(item.feature);

                if (isLocked) {
                  return (
                    <button
                      key={item.href}
                      onClick={() => setLockedFeature(item.label)}
                      title={!open ? `${item.label} (Plan ${PLAN_LABELS[requiredPlan(item.feature!)]})` : undefined}
                      className={cn(
                        'group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer',
                        !open && 'justify-center px-0'
                      )}
                      style={{ color: isColored ? 'rgba(255,255,255,0.35)' : '#374151' }}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {open && (
                        <>
                          <span className="flex-1 truncate text-left">{item.label}</span>
                          <Lock className="w-3 h-3 flex-shrink-0 opacity-60" />
                        </>
                      )}
                      {!open && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-600/60" />
                      )}
                    </button>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={!open ? item.label : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                      isActive ? getItemActiveClass() : '',
                      !open && 'justify-center px-0'
                    )}
                    style={{
                      backgroundColor: isActive ? getItemActiveBg() : undefined,
                      color: isActive ? getItemActiveTextColor() : getItemInactiveTextColor(),
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = getItemHoverBg();
                        (e.currentTarget as HTMLElement).style.color = isColored ? '#ffffff' : isDarkSidebar ? '#e2e8f0' : mode === 'dark' ? '#e2e8f0' : '#0f172a';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = '';
                        (e.currentTarget as HTMLElement).style.color = getItemInactiveTextColor();
                      }
                    }}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0 transition-colors" />

                    {open && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {badgeCount > 0 && (
                          <span className={cn(
                            'flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1',
                            item.badgeKey === 'maintenance'
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'bg-red-500/20 text-red-400'
                          )}>
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                      </>
                    )}

                    {/* Badge dot in collapsed mode */}
                    {!open && badgeCount > 0 && (
                      <span className={cn(
                        'absolute top-1 right-1 w-2 h-2 rounded-full',
                        item.badgeKey === 'maintenance' ? 'bg-orange-500' : 'bg-red-500'
                      )} />
                    )}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      {/* ── Upgrade modal (locked feature click) ── */}
      {lockedFeature && open && (
        <div
          className="absolute inset-x-2 bottom-20 z-30 rounded-xl p-4 shadow-xl"
          style={{
            backgroundColor: isColored ? 'rgba(0,0,0,0.4)' : '#1a1d27',
            border: '1px solid rgba(245,158,11,0.2)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-white">Fonctionnalité verrouillée</span>
            </div>
            <button onClick={() => setLockedFeature(null)}>
              <X className="w-3.5 h-3.5 text-slate-500 hover:text-white transition-colors" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-1">
            <span className="text-white font-medium">{lockedFeature}</span> nécessite un plan supérieur.
          </p>
          <p className="text-[10px] text-slate-600">
            Contactez votre administrateur SaaS pour mettre à niveau.
          </p>
        </div>
      )}

      {/* ── User + logout ── */}
      <div className="p-3" style={{ borderTop: `1px solid ${dividerColor}` }}>
        {open ? (
          <div className="flex items-center gap-2">
            <div className="relative flex-shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar"
                  className="w-8 h-8 rounded-full object-cover"
                  style={{ border: `1px solid ${dividerColor}` }} />
              ) : (
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: isColored ? 'rgba(255,255,255,0.2)' : accentHex }}
                >
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full" style={{ border: `2px solid ${sidebarBg}` }} />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-medium truncate" style={{ color: sidebarTextColor }}>{user?.firstName} {user?.lastName}</p>
              <p className="text-[10px] truncate" style={{ color: labelColor }}>{user?.agency?.name ?? 'Super Admin'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg transition-colors flex-shrink-0 hover:bg-red-500/10 hover:text-red-400"
              style={{ color: labelColor }}
              title="Se déconnecter"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex justify-center p-2 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400"
            style={{ color: labelColor }}
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Toggle ── */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 flex items-center justify-center w-6 h-6 rounded-full transition-all shadow-lg"
        style={{
          backgroundColor: toggleBg,
          border: `1px solid ${toggleBorder}`,
          color: isColored ? 'rgba(255,255,255,0.8)' : isDarkSidebar ? '#94a3b8' : mode === 'dark' ? '#94a3b8' : '#64748b',
        }}
      >
        {open ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
    </aside>
  );
}
