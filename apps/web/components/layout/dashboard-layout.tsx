'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { UpgradeBar } from '@/components/shared/upgrade-bar';
import { EmailVerificationBanner } from '@/components/shared/email-verification-banner';
import { useAuthStore } from '@/store/auth.store';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [isMobile, setIsMobile]       = useState(false);

  const { user, emailVerified } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Detect mobile / resize
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);   // close drawer when switching to desktop
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleMenuClick = () => {
    if (isMobile) setMobileOpen((v) => !v);
    else          setSidebarOpen((v) => !v);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Mobile backdrop ── */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <div
        className={
          isMobile
            ? `fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out ${
                mobileOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : 'relative flex-shrink-0'
        }
      >
        <Sidebar
          open={isMobile ? true : sidebarOpen}
          onToggle={() => {
            if (isMobile) setMobileOpen(false);
            else setSidebarOpen((v) => !v);
          }}
          onClose={isMobile ? () => setMobileOpen(false) : undefined}
        />
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={handleMenuClick} />

        <div className="flex-1 overflow-y-auto">
          {!isSuperAdmin && !emailVerified && <EmailVerificationBanner />}
          {!isSuperAdmin && <UpgradeBar />}
          <main className="p-4 md:p-6 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
