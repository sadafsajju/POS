import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState, Organization, Location } from '@pos/types';

interface AuthStore extends AuthState {
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  login: (user: User, token: string, organization?: Organization | null, location?: Location | null) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      organization: null,
      location: null,
      isAuthenticated: false,
      isLoading: true, // Start as true until hydration completes
      _hasHydrated: false,

      setHasHydrated: (state) => {
        set({ _hasHydrated: state, isLoading: false });
      },

      login: (user, token, organization, location) => {
        set({
          user,
          token,
          organization: organization ?? null,
          location: location ?? null,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          organization: null,
          location: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      updateUser: (userData) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        }));
      },
    }),
    {
      name: 'pos-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        organization: state.organization,
        location: state.location,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Called when hydration is complete
        state?.setHasHydrated(true);
      },
    }
  )
);
