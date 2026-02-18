import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState, Organization, Location } from '@pos/types';

interface AuthStore extends AuthState {
  _hasHydrated: boolean;
  isLocked: boolean;
  locations: Location[];
  setHasHydrated: (state: boolean) => void;
  login: (user: User, token: string, organization?: Organization | null, location?: Location | null, locations?: Location[]) => void;
  logout: () => void;
  lock: () => void;
  unlock: () => void;
  setLoading: (isLoading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
  switchLocation: (token: string, location: Location) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      organization: null,
      location: null,
      locations: [],
      isAuthenticated: false,
      isLoading: true, // Start as true until hydration completes
      isLocked: false,
      _hasHydrated: false,

      setHasHydrated: (state) => {
        set({ _hasHydrated: state, isLoading: false });
      },

      login: (user, token, organization, location, locations) => {
        set({
          user,
          token,
          organization: organization ?? null,
          location: location ?? null,
          locations: locations ?? [],
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
          locations: [],
          isAuthenticated: false,
          isLocked: false,
          isLoading: false,
        });
      },

      lock: () => {
        set({ isLocked: true });
      },

      unlock: () => {
        set({ isLocked: false });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      updateUser: (userData) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        }));
      },

      switchLocation: (token, location) => {
        set((state) => ({
          token,
          location,
          user: state.user ? { ...state.user, location_id: location.id } : null,
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
        locations: state.locations,
        isAuthenticated: state.isAuthenticated,
        isLocked: state.isLocked,
      }),
      onRehydrateStorage: () => (state) => {
        // Called when hydration is complete
        state?.setHasHydrated(true);
      },
    }
  )
);
