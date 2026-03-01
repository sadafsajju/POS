import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { SignIn, SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { Store, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@pos/core';
import { authApi } from '@pos/api-client';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

/**
 * Get the redirect path based on user role
 */
function getRoleBasedRedirect(role: string | undefined): string {
  switch (role) {
    case 'server':
    case 'counter':
      return '/admin/pos';
    case 'kitchen':
      return '/admin/kitchen';
    case 'admin':
    case 'manager':
    default:
      return '/admin';
  }
}

function LoginPage() {
  return (
    <>
      {/* Already signed in via Clerk — sync session then redirect */}
      <SignedIn>
        <ClerkSessionSync />
      </SignedIn>

      {/* Not signed in — show sign-in form */}
      <SignedOut>
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
          <Link to="/landing" className="flex items-center gap-2 mb-8">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Store className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-zinc-100">YourPOS</span>
          </Link>

          <SignIn
            signUpUrl="/sign-up"
          />

          <p className="mt-6 text-sm text-zinc-500">
            Don't have an account?{' '}
            <Link to="/sign-up" className="text-blue-500 hover:text-blue-400">
              Start free trial
            </Link>
          </p>
        </div>
      </SignedOut>
    </>
  );
}

/**
 * ClerkSessionSync — after Clerk sign-in completes, fetches user/org/location
 * from our backend and populates the auth store, then redirects to /admin.
 */
function ClerkSessionSync() {
  const { isSignedIn, isLoaded } = useAuth();
  const { isAuthenticated, loginWithClerk } = useAuthStore();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || syncing) return;

    // If user just clicked logout, don't re-authenticate — clear flag and bail
    if (sessionStorage.getItem('pos-logging-out')) {
      sessionStorage.removeItem('pos-logging-out')
      return
    }

    // Already synced — redirect based on role
    if (isAuthenticated) {
      const user = useAuthStore.getState().user;
      const redirectPath = getRoleBasedRedirect(user?.role);
      navigate({ to: redirectPath });
      return;
    }

    setSyncing(true);

    authApi.clerkSession().then((res) => {
      if (res.success && res.data) {
        const { user, organization, location, locations, needs_setup } = res.data;
        loginWithClerk(user, organization, location, locations);
        if (needs_setup) {
          navigate({ to: '/setup', search: { mode: 'clerk' } });
        } else {
          // Redirect based on user role
          const redirectPath = getRoleBasedRedirect(user.role);
          navigate({ to: redirectPath });
        }
      } else {
        setError(res.message || 'Failed to load account data');
      }
      setSyncing(false);
    }).catch((err) => {
      setError(err.message || 'Connection error');
      setSyncing(false);
    });
  }, [isLoaded, isSignedIn, isAuthenticated, syncing, loginWithClerk, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-red-400 text-sm">{error}</p>
          <p className="text-zinc-500 text-xs">
            Your Clerk account may not be linked yet. Make sure the webhook is configured.
          </p>
          <button
            onClick={() => { setError(null); setSyncing(false); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
        <p className="text-sm text-zinc-400">Setting up your account...</p>
      </div>
    </div>
  );
}
