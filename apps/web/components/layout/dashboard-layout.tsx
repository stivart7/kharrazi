'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { UpgradeBar } from '@/components/shared/upgrade-bar';
import { EmailVerificationBanner } from '@/components/shared/email-verification-banner';
import { useAuthStore } from '@/store/auth.store';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, emailVerified } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} />

        <div className="flex-1 overflow-y-auto">
          {!isSuperAdmin && !emailVerified && <EmailVerificationBanner />}
          {!isSuperAdmin && <UpgradeBar />}
          <main className="p-6 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
