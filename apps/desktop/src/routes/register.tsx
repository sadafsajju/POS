import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2, Store } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const Route = createFileRoute('/register')({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<{
    available: boolean;
    message: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    business_name: '',
    subdomain: '',
    admin_email: '',
    admin_name: '',
    password: '',
    confirmPassword: '',
    phone: '',
    city: '',
    state: '',
  });

  const [registrationResult, setRegistrationResult] = useState<any>(null);

  // Debounced subdomain check
  const checkSubdomain = async (subdomain: string) => {
    if (subdomain.length < 3) {
      setSubdomainStatus(null);
      return;
    }

    setCheckingSubdomain(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`
      );
      const data = await response.json();

      if (data.success && data.data) {
        setSubdomainStatus({
          available: data.data.available,
          message: data.data.reason || `${subdomain}.yourpos.com is available!`,
        });
      }
    } catch (err) {
      console.error('Failed to check subdomain:', err);
    } finally {
      setCheckingSubdomain(false);
    }
  };

  const handleSubdomainChange = (value: string) => {
    // Auto-format: lowercase, replace spaces with hyphens
    const formatted = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    setFormData({ ...formData, subdomain: formatted });

    // Debounce check
    const timer = setTimeout(() => checkSubdomain(formatted), 500);
    return () => clearTimeout(timer);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!subdomainStatus?.available) {
      setError('Please choose an available subdomain');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: formData.business_name,
          subdomain: formData.subdomain,
          admin_email: formData.admin_email,
          admin_name: formData.admin_name,
          password: formData.password,
          phone: formData.phone,
          city: formData.city,
          state: formData.state,
          country: 'India',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setRegistrationResult(data.data);
        setStep('success');
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success' && registrationResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Registration Successful! 🎉</CardTitle>
            <CardDescription>
              Your restaurant <strong>{registrationResult.subdomain}.yourpos.com</strong> is ready!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Username:</span>
                <span className="font-mono font-semibold">{registrationResult.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Login URL:</span>
                <a
                  href={registrationResult.login_url}
                  className="text-blue-600 hover:underline text-sm truncate"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {registrationResult.login_url}
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Plan:</span>
                <span className="font-semibold capitalize">{registrationResult.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Trial Ends:</span>
                <span className="font-semibold">{registrationResult.trial_ends}</span>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Next Steps:</strong>
                <ol className="list-decimal ml-4 mt-2 space-y-1">
                  <li>Download the POS desktop app</li>
                  <li>Login with your username and password</li>
                  <li>Complete the onboarding wizard</li>
                  <li>Start adding products and taking orders!</li>
                </ol>
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate({ to: '/login' })}
              className="flex-1"
            >
              Go to Login
            </Button>
            <Button
              onClick={() => window.open(registrationResult.login_url, '_blank')}
              className="flex-1"
            >
              Open POS
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Store className="w-10 h-10 text-blue-600" />
          </div>
          <CardTitle className="text-3xl font-bold">Start Your Free Trial</CardTitle>
          <CardDescription className="text-base">
            Join hundreds of restaurants using our offline-first POS system. No credit card required.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Business Information */}
            <div className="space-y-4">
              <div className="text-lg font-semibold border-b pb-2">Business Information</div>

              <div className="space-y-2">
                <Label htmlFor="business_name">Restaurant Name *</Label>
                <Input
                  id="business_name"
                  placeholder="e.g., Pizza Palace"
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomain">Choose Your Subdomain *</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="subdomain"
                      placeholder="pizza-palace"
                      value={formData.subdomain}
                      onChange={(e) => handleSubdomainChange(e.target.value)}
                      required
                      className={
                        subdomainStatus
                          ? subdomainStatus.available
                            ? 'border-green-500'
                            : 'border-red-500'
                          : ''
                      }
                    />
                    {checkingSubdomain && (
                      <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-gray-400" />
                    )}
                  </div>
                  <span className="text-sm text-gray-600">.yourpos.com</span>
                </div>
                {subdomainStatus && (
                  <p
                    className={`text-sm ${
                      subdomainStatus.available ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {subdomainStatus.available ? '✓ ' : '✗ '}
                    {subdomainStatus.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    placeholder="Mumbai"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    placeholder="Maharashtra"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+91-9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            {/* Admin Account */}
            <div className="space-y-4">
              <div className="text-lg font-semibold border-b pb-2">Admin Account</div>

              <div className="space-y-2">
                <Label htmlFor="admin_name">Your Full Name *</Label>
                <Input
                  id="admin_name"
                  placeholder="John Smith"
                  value={formData.admin_name}
                  onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin_email">Email Address *</Label>
                <Input
                  id="admin_email"
                  type="email"
                  placeholder="john@pizzapalace.com"
                  value={formData.admin_email}
                  onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="font-semibold text-green-900 mb-2">✓ What's Included (Free Trial)</div>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• <strong>14 days</strong> full access</li>
                <li>• Up to <strong>5 users</strong></li>
                <li>• <strong>100 products</strong></li>
                <li>• <strong>1 location</strong></li>
                <li>• Offline mode support</li>
                <li>• Kitchen display</li>
                <li>• Full reporting</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" size="lg" disabled={loading || checkingSubdomain}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating your restaurant...
                </>
              ) : (
                'Start Free Trial'
              )}
            </Button>
            <p className="text-xs text-center text-gray-600">
              Already have an account?{' '}
              <a href="/login" className="text-blue-600 hover:underline">
                Login here
              </a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
