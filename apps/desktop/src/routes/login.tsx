import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Store, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@pos/core';
import { signInWithPassword, extractUserClaims } from '@pos/supabase';
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

          loginWithSupabase(user);

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
      <Link to="/landing" className="flex items-center gap-2 mb-8">
        <div className="bg-blue-600 p-2 rounded-lg">
          <Store className="h-6 w-6 text-white" />
        </div>
        <span className="text-2xl font-bold text-zinc-100">YourPOS</span>
      </Link>

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
            <Label htmlFor="email" className="text-zinc-300">Email</Label>
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
            <Label htmlFor="password" className="text-zinc-300">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
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
          <Link to="/sign-up" className="text-blue-500 hover:text-blue-400">
            Start free trial
          </Link>
        </p>
      </div>
    </div>
  );
}
