import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  agencyId: string | null;
  avatarUrl?: string | null;
  agency?: { id: string; name: string; city?: string; logoUrl?: string; plan?: string } | null;
}

interface AuthState {
  accessToken: string | null;
  // refreshToken is stored as HTTP-only cookie — NOT in JS/localStorage
  user: User | null;
  isAuthenticated: boolean;
  emailVerified: boolean;

  setAuth: (accessToken: string, user: User, emailVerified?: boolean) => void;
  updateUser: (user: Partial<User>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      emailVerified: false,

      setAuth: (accessToken, user, emailVerified = false) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
          // refreshToken is in HTTP-only cookie — browser handles it automatically
        }
        set({ accessToken, user, isAuthenticated: true, emailVerified });
      },

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
        }
        set({ accessToken: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'kharrazi-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        emailVerified: state.emailVerified,
        // refreshToken intentionally excluded — lives in HTTP-only cookie
      }),
    }
  )
);
