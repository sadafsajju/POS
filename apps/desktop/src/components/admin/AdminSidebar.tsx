import { Link, useLocation } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  CreditCard,
  ChefHat,
  MoreHorizontal,
  Contact,
  Receipt,
  LogOut,
  Lock,
} from 'lucide-react'
import type { User as UserType } from '@/types'
import { useAuthStore, useSettingsStore } from '@pos/core'
import { LocationSwitcher } from '@/components/ui/location-switcher'
import { signOut as supabaseSignOut } from '@pos/supabase'

// --- Trial Banner ---

function TrialBanner() {
  const { plan, trialEndsAt } = useAuthStore()

  if (plan !== 'trial' || !trialEndsAt) return null

  const daysRemaining = Math.max(0, Math.ceil(
    (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ))
  const isUrgent = daysRemaining <= 3

  return (
    <a
      href="/upgrade"
      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
        isUrgent
          ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
      }`}
    >
      {daysRemaining > 0
        ? `Trial: ${daysRemaining}d left`
        : 'Trial expired'}
    </a>
  )
}

// --- Nav items ---

const navItems = [
  {
    id: 'pos',
    label: 'POS',
    icon: CreditCard,
    href: '/admin/pos',
  },
  {
    id: 'bills',
    label: 'Bills',
    icon: Receipt,
    href: '/admin/bills',
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    icon: ChefHat,
    href: '/admin/kitchen',
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Contact,
    href: '/admin/customers',
  },
  {
    id: 'settings',
    label: 'More',
    icon: MoreHorizontal,
    href: '/admin/more',
  },
]

// --- Top Bar ---

interface AdminTopBarProps {
  user: UserType
}

export function AdminTopBar({ user }: AdminTopBarProps) {
  const { lock } = useAuthStore()

  const handleLogout = async () => {
    // Clear Zustand auth state
    useAuthStore.getState().logout()
    localStorage.removeItem('pos-auth')

    // Sign out from Supabase
    await supabaseSignOut()

    // Redirect to landing
    window.location.href = '/landing'
  }

  const handleLock = () => {
    lock()
    window.location.href = '/lock'
  }

  return (
    <div className="flex-shrink-0 bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-xs text-zinc-400 truncate">
            {user.email}
          </p>
        </div>
        <LocationSwitcher />
      </div>
      <div className="flex items-center gap-1">
        <TrialBanner />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLock}
          className="flex-shrink-0 h-10 px-3 gap-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
        >
          <Lock className="w-4 h-4" />
          <span className="hidden sm:inline text-sm">Lock</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="flex-shrink-0 h-10 px-3 gap-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline text-sm">Logout</span>
        </Button>
      </div>
    </div>
  )
}

// --- Bottom Nav ---

export function AdminBottomNav() {
  const location = useLocation()
  const { settings } = useSettingsStore()

  const isActive = (href: string) => {
    if (href === '/admin/more') {
      return location.pathname.startsWith('/admin/more')
    }
    return location.pathname === href
  }

  const visibleItems = navItems.filter(i => {
    if (i.id === 'kitchen' && !settings.enableKds) return false
    return true
  })

  return (
    <nav className="flex-shrink-0 bg-zinc-900 border-t border-zinc-800">
      <div className="flex items-stretch justify-around">
        {visibleItems.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              to={item.href}
              className={`
                flex flex-col items-center justify-center gap-0.5
                min-h-[64px] min-w-[48px] flex-1
                transition-colors
                ${active
                  ? 'text-white bg-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 active:bg-zinc-800'
                }
              `}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-white' : ''}`} />
              <span className={`text-[11px] leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
