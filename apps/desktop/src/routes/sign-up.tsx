import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Store, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@pos/core';
import { signUp } from '@pos/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null);

  // Already authenticated — redirect
  if (isAuthenticated) {
    navigate({ to: '/admin' });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDuplicateEmail(null);
    setLoading(true);

    try {
      const result = await signUp(email, password, {
        first_name: firstName,
        last_name: lastName,
        business_name: businessName,
      });

      if (!result.success) {
        if (result.code === 'user_already_exists') {
          setDuplicateEmail(email);
        } else {
          setError(result.error);
        }
        setLoading(false);
        return;
      }

      if (result.session) {
        // User was auto-confirmed — redirect to setup
        navigate({ to: '/setup', search: { mode: 'supabase' } });
      } else {
        // Email confirmation required
        setError('Please check your email to confirm your account, then sign in.');
      }
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
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
          <h1 className="text-2xl font-bold text-zinc-100">Start your free trial</h1>
          <p className="text-sm text-zinc-400 mt-1">14 days free, no credit card required</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {duplicateEmail && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-amber-300">
                  An account with this email already exists
                </p>
                <p className="text-xs text-amber-200/70 mt-1">
                  {duplicateEmail} is already registered. Sign in to continue.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 transition-colors"
              >
                Sign in instead
              </Link>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-zinc-300">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="bg-zinc-900 border-zinc-700 text-zinc-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-zinc-300">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="bg-zinc-900 border-zinc-700 text-zinc-100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessName" className="text-zinc-300">Business name</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Your Restaurant"
              required
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-300">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (duplicateEmail) setDuplicateEmail(null);
              }}
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
              placeholder="At least 6 characters"
              required
              minLength={6}
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
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-500 hover:text-blue-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
