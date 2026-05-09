import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState, Organization, Location } from '@pos/types';

interface AuthStore extends AuthState {
  _hasHydrated: boolean;
  isLocked: boolean;
  locations: Location[];
  trialEndsAt: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
  setHasHydrated: (state: boolean) => void;
  login: (user: User, token: string, organization?: Organization | null, location?: Location | null, locations?: Location[]) => void;
  loginWithSupabase: (user: User, organization?: Organization | null, location?: Location | null, locations?: Location[]) => void;
  logout: () => void;
  lock: () => void;
  unlock: () => void;
  setLoading: (isLoading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
  switchLocation: (token: string, location: Location) => void;
  setTrialInfo: (plan: string | null, subscriptionStatus: string | null, trialEndsAt: string | null) => void;
  isTrialExpired: () => boolean;
  trialDaysRemaining: () => number;
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
      authProvider: undefined,
      trialEndsAt: null,
      plan: null,
      subscriptionStatus: null,
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
          authProvider: 'internal',
        });
      },

      loginWithSupabase: (user, organization, location, locations) => {
        set({
          user,
          token: null, // Supabase manages its own session
          organization: organization ?? null,
          location: location ?? null,
          locations: locations ?? [],
          isAuthenticated: true,
          isLoading: false,
          authProvider: 'supabase',
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
          authProvider: undefined,
          trialEndsAt: null,
          plan: null,
          subscriptionStatus: null,
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

      setTrialInfo: (plan, subscriptionStatus, trialEndsAt) => {
        set({ plan, subscriptionStatus, trialEndsAt });
      },

      isTrialExpired: (): boolean => {
        const state = useAuthStore.getState();
        if (state.plan !== 'trial') return false;
        if (!state.trialEndsAt) return false;
        if (state.subscriptionStatus === 'expired') return true;
        return new Date(state.trialEndsAt) < new Date();
      },

      trialDaysRemaining: (): number => {
        const state = useAuthStore.getState();
        if (!state.trialEndsAt) return 0;
        const diff: number = new Date(state.trialEndsAt).getTime() - Date.now();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
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
        authProvider: state.authProvider,
        trialEndsAt: state.trialEndsAt,
        plan: state.plan,
        subscriptionStatus: state.subscriptionStatus,
      }),
      onRehydrateStorage: () => (state) => {
        // Called when hydration is complete
        state?.setHasHydrated(true);
      },
    }
  )
);
