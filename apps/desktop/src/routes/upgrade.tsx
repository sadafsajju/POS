import { createFileRoute } from '@tanstack/react-router'
import { useAuthStore } from '@pos/core'
import { signOut as supabaseSignOut } from '@pos/supabase'
import { Crown, Check, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/upgrade')({
  component: UpgradePage,
})

const plans = [
  {
    name: 'Basic',
    price: '999',
    period: '/mo',
    features: ['1 Location', '5 Staff', '100 Products', 'POS + Kitchen Display', 'Email Support'],
    recommended: false,
  },
  {
    name: 'Pro',
    price: '2,499',
    period: '/mo',
    features: ['3 Locations', '15 Staff', 'Unlimited Products', 'Aggregator Integration', 'Priority Support', 'Reports & Analytics'],
    recommended: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: ['Unlimited Locations', 'Unlimited Staff', 'Unlimited Products', 'Custom Integrations', 'Dedicated Support', 'SLA Guarantee'],
    recommended: false,
  },
]

function UpgradePage() {
  const { trialEndsAt, user } = useAuthStore()

  const expiredDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const handleLogout = async () => {
    useAuthStore.getState().logout()
    localStorage.removeItem('pos-auth')
    await supabaseSignOut()
    window.location.href = '/landing'
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Expired badge */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
          <Crown className="h-4 w-4 text-red-400" />
          <span className="text-sm font-medium text-red-400">Trial Expired</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-3">
          Your free trial has ended
        </h1>
        <p className="text-zinc-400 text-center max-w-md mb-2">
          {expiredDate
            ? `Your 14-day trial ended on ${expiredDate}.`
            : 'Your 14-day trial has ended.'
          }
        </p>
        <p className="text-zinc-500 text-sm text-center max-w-md mb-10">
          Choose a plan to continue using YourPOS. Your data is safe and will be available once you upgrade.
        </p>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl w-full mb-10">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.recommended
                  ? 'border-zinc-100 bg-zinc-900'
                  : 'border-zinc-800 bg-zinc-900/50'
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-zinc-100 text-zinc-950 px-3 py-1 rounded-full text-xs font-bold">
                    POPULAR
                  </span>
                </div>
              )}

              <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
              <div className="mb-4">
                {plan.price === 'Custom' ? (
                  <span className="text-3xl font-bold">Custom</span>
                ) : (
                  <>
                    <span className="text-sm text-zinc-400">₹</span>
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-zinc-500 text-sm">{plan.period}</span>
                  </>
                )}
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full rounded-xl h-11 font-semibold ${
                  plan.recommended
                    ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                    : 'bg-transparent border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                }`}
                disabled
              >
                Coming Soon
              </Button>
            </div>
          ))}
        </div>

        <p className="text-zinc-600 text-sm mb-6">
          Payment integration coming soon. Contact us for early access.
        </p>

        {/* Logout */}
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out{user?.email ? ` (${user.email})` : ''}
        </Button>
      </div>
    </div>
  )
}
