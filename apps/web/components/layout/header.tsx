'use client';

import { Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth.store';
import { NotificationsDropdown } from './notifications-dropdown';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuthStore();

  return (
    <header className="flex items-center gap-2 px-3 md:px-6 py-3 md:py-4 border-b bg-background/95 backdrop-blur">
      <Button variant="ghost" size="icon" onClick={onMenuClick} className="-ml-1">
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search — hidden on xs, visible from sm */}
      <div className="hidden sm:flex flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher…" className="pl-9 h-9 bg-muted border-0" />
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2 ml-auto">
        <NotificationsDropdown />

        <div className="flex items-center gap-2 pl-2 border-l">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="avatar"
              className="w-8 h-8 rounded-full object-cover border border-border" />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-full text-white text-xs font-bold flex-shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-tight">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-muted-foreground">{user?.agency?.name ?? 'Super Admin'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
