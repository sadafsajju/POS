import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@pos/core';
import { signInWithPassword, extractUserClaims, locationsDb } from '@pos/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const navigate = useNavigate();
  const { isAuthenticated, loginWithSupabase } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already authenticated — redirect based on role
  if (isAuthenticated) {
    const user = useAuthStore.getState().user;
    const redirectPath = getRoleBasedRedirect(user?.role);
    navigate({ to: redirectPath });
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signInWithPassword(email, password);

      if (!result.success) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (result.session) {
        const claims = extractUserClaims(result.session);

        if (claims) {
          // Build user object from JWT claims
          const user = {
            id: claims.user_id || '',
            username: email.split('@')[0],
            email: email,
            first_name: result.user?.user_metadata?.first_name || '',
            last_name: result.user?.user_metadata?.last_name || '',
            role: (claims.role || 'admin') as any,
            org_id: claims.org_id || '',
            location_id: claims.location_id || undefined,
            auth_user_id: result.user?.id,
            auth_provider: 'supabase' as const,
            is_active: true,
            created_at: '',
            updated_at: '',
          };

          // Fetch locations for the org
          const locRes = await locationsDb.getLocations();
          const allLocations = (locRes.success && Array.isArray(locRes.data)) ? locRes.data : [];
          const currentLocation = allLocations.find((l: any) => l.id === claims.location_id) || allLocations[0] || null;

          loginWithSupabase(user, null, currentLocation, allLocations);

          // Set trial info from JWT claims
          useAuthStore.getState().setTrialInfo(
            claims.plan || null,
            claims.subscription_status || null,
            claims.trial_ends_at || null
          );

          const redirectPath = getRoleBasedRedirect(user.role);
          navigate({ to: redirectPath });
        } else {
          setError('Account not fully set up. Please contact your administrator.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-100">Welcome back</h1>
          <p className="text-sm text-zinc-400 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-400 text-xs font-bold uppercase tracking-wide">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-400 text-xs font-bold uppercase tracking-wide">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-semibold h-11 rounded-xl"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Don't have an account?{' '}
          <Link to="/setup" className="text-zinc-300 hover:text-zinc-100 underline underline-offset-2">
            Start free trial
          </Link>
        </p>
      </div>
    </div>
  );
}
