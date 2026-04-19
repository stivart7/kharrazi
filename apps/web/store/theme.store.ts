'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode    = 'light' | 'dark';
export type AccentColor  = 'blue' | 'green' | 'violet' | 'orange' | 'red' | 'teal' | 'gold';
export type SidebarStyle = 'default' | 'dark' | 'colored';

export const ACCENT_CONFIGS: Record<AccentColor, {
  label: string;
  hex: string;
  primary: string;
  primaryDark: string;
  ring: string;
}> = {
  blue:   { label: 'Bleu',    hex: '#3b82f6', primary: '221.2 83.2% 53.3%', primaryDark: '217.2 91.2% 59.8%', ring: '221.2 83.2% 53.3%' },
  green:  { label: 'Vert',    hex: '#10b981', primary: '160.1 84.1% 39.4%', primaryDark: '160.1 84.1% 50%',   ring: '160.1 84.1% 39.4%' },
  violet: { label: 'Violet',  hex: '#8b5cf6', primary: '263.4 70% 50.4%',  primaryDark: '263.4 70% 62%',     ring: '263.4 70% 50.4%'  },
  orange: { label: 'Orange',  hex: '#f97316', primary: '24.6 95% 53.1%',   primaryDark: '24.6 95% 62%',      ring: '24.6 95% 53.1%'   },
  red:    { label: 'Rouge',   hex: '#ef4444', primary: '0 84.2% 60.2%',    primaryDark: '0 84.2% 65%',       ring: '0 84.2% 60.2%'    },
  teal:   { label: 'Teal',    hex: '#14b8a6', primary: '173.4 80.4% 40%',  primaryDark: '173.4 80.4% 52%',   ring: '173.4 80.4% 40%'  },
  gold:   { label: 'Or',      hex: '#f59e0b', primary: '37.7 92.1% 50.2%', primaryDark: '37.7 92.1% 60%',    ring: '37.7 92.1% 50.2%' },
};

export const SIDEBAR_STYLE_CONFIGS: Record<SidebarStyle, { label: string; desc: string }> = {
  default: { label: 'Clair',    desc: 'Fond blanc, style épuré' },
  dark:    { label: 'Sombre',   desc: 'Fond sombre, contraste élevé' },
  colored: { label: 'Coloré',   desc: 'Couleur principale en fond' },
};

interface ThemeState {
  mode:         ThemeMode;
  accent:       AccentColor;
  sidebarStyle: SidebarStyle;
  setMode:         (m: ThemeMode)      => void;
  setAccent:       (a: AccentColor)    => void;
  setSidebarStyle: (s: SidebarStyle)   => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode:         'light',
      accent:       'blue',
      sidebarStyle: 'dark',
      setMode:         (mode)         => set({ mode }),
      setAccent:       (accent)       => set({ accent }),
      setSidebarStyle: (sidebarStyle) => set({ sidebarStyle }),
    }),
    { name: 'kharrazi-theme' }
  )
);
