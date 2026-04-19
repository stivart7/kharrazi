'use client';

import { useEffect } from 'react';
import { useThemeStore, ACCENT_CONFIGS } from '@/store/theme.store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode, accent, sidebarStyle } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    const cfg  = ACCENT_CONFIGS[accent];

    // ── Mode ──
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // ── Accent color ──
    const isDark = mode === 'dark';
    root.style.setProperty('--primary', isDark ? cfg.primaryDark : cfg.primary);
    root.style.setProperty('--ring',    isDark ? cfg.primaryDark : cfg.ring);

    // ── Sidebar style ──
    root.setAttribute('data-sidebar', sidebarStyle);
  }, [mode, accent, sidebarStyle]);

  return <>{children}</>;
}
