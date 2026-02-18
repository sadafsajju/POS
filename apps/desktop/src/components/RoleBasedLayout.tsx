import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { OfflineBanner } from '@/components/ui/offline-indicator'
import { CounterInterface } from '@/components/counter/CounterInterface'
import { NewEnhancedKitchenLayout } from '@/components/kitchen/NewEnhancedKitchenLayout'
import {
  Users,
  CreditCard,
  ChefHat,
  Settings,
  LogOut,
  Lock,
  User,
  LayoutDashboard,
  Monitor,
} from 'lucide-react'

// Use shared packages
import type { User as UserType } from '@pos/types'
import { useAuthStore, useSyncStore, useCustomerDisplayStore } from '@pos/core'
import { LocationSwitcher } from '@/components/ui/location-switcher'

interface RoleBasedLayoutProps {
  user: UserType
}

export function RoleBasedLayout({ user }: RoleBasedLayoutProps) {
  const [currentView, setCurrentView] = useState<string>(getDefaultView(user.role))
  const { logout, lock } = useAuthStore()
  const { isOnline } = useSyncStore()
  const { isOpen: isDisplayOpen, openWindow: openDisplay, closeWindow: closeDisplay } = useCustomerDisplayStore()

  function getDefaultView(role: string): string {
    switch (role) {
      case 'admin':
      case 'manager':
        return 'counter'
      case 'server':
        return 'server'
      case 'counter':
        return 'counter'
      case 'kitchen':
        return 'kitchen'
      default:
        return 'counter' // fallback to counter interface
    }
  }

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const handleLock = () => {
    lock()
    window.location.href = '/lock'
  }

  const getRoleConfig = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          title: 'Administrator',
          color: 'bg-red-100 text-red-800',
          icon: <Settings className="w-4 h-4" />,
          description: 'Full system access and management'
        }
      case 'manager':
        return {
          title: 'Manager',
          color: 'bg-purple-100 text-purple-800',
          icon: <LayoutDashboard className="w-4 h-4" />,
          description: 'Operations management and reporting'
        }
      case 'server':
        return {
          title: 'Server',
          color: 'bg-blue-100 text-blue-800',
          icon: <Users className="w-4 h-4" />,
          description: 'Dine-in order creation'
        }
      case 'counter':
        return {
          title: 'Counter/Checkout',
          color: 'bg-green-100 text-green-800',
          icon: <CreditCard className="w-4 h-4" />,
          description: 'Order creation and payment processing'
        }
      case 'kitchen':
        return {
          title: 'Kitchen Staff',
          color: 'bg-orange-100 text-orange-800',
          icon: <ChefHat className="w-4 h-4" />,
          description: 'Order preparation and status updates'
        }
      default:
        return {
          title: 'Staff',
          color: 'bg-gray-100 text-gray-800',
          icon: <User className="w-4 h-4" />,
          description: 'General access'
        }
    }
  }

  const roleConfig = getRoleConfig(user.role)

  // Get available views based on user role
  const getAvailableViews = (role: string) => {
    const views = []

    // Admin and managers get all views
    if (role === 'admin' || role === 'manager') {
      views.push(
        { id: 'server', label: 'Server', icon: <Users className="w-4 h-4" /> },
        { id: 'counter', label: 'Counter', icon: <CreditCard className="w-4 h-4" /> },
        { id: 'kitchen', label: 'Kitchen', icon: <ChefHat className="w-4 h-4" /> }
      )
    }
    // Server gets server interface only
    else if (role === 'server') {
      views.push(
        { id: 'server', label: 'Server', icon: <Users className="w-4 h-4" /> }
      )
    }
    // Counter gets counter interface only
    else if (role === 'counter') {
      views.push(
        { id: 'counter', label: 'Counter', icon: <CreditCard className="w-4 h-4" /> }
      )
    }
    // Kitchen staff gets kitchen display only
    else if (role === 'kitchen') {
      views.push(
        { id: 'kitchen', label: 'Kitchen', icon: <ChefHat className="w-4 h-4" /> }
      )
    }
    // Default fallback
    else {
      views.push(
        { id: 'counter', label: 'Counter', icon: <CreditCard className="w-4 h-4" /> }
      )
    }

    return views
  }

  const availableViews = getAvailableViews(user.role)

  const renderCurrentView = () => {
    switch (currentView) {
      case 'server':
        return <CounterInterface /> // Uses same component, payment hidden for server role
      case 'counter':
        return <CounterInterface />
      case 'kitchen':
        return <NewEnhancedKitchenLayout user={user} />
      default:
        return <CounterInterface />
    }
  }

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left Side - User Info and Navigation */}
          <div className="flex items-center gap-6">
            {/* User Info */}
            <div className="flex items-center gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-100">
                    {user.first_name} {user.last_name}
                  </span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
                    title={isOnline ? 'Online' : 'Offline'}
                  />
                </div>
                <span className="text-xs text-zinc-500">{roleConfig.title}</span>
              </div>
            </div>

            <LocationSwitcher />

            {/* Navigation Tabs */}
            {availableViews.length > 1 && (
              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-zinc-700">
                {availableViews.map(view => (
                  <Button
                    key={view.id}
                    size="sm"
                    onClick={() => setCurrentView(view.id)}
                    className={`flex items-center gap-2 ${
                      currentView === view.id
                        ? 'bg-zinc-700 text-zinc-100 hover:bg-zinc-600'
                        : 'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {view.icon}
                    {view.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Right Side - Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={isDisplayOpen ? closeDisplay : openDisplay}
              className={`flex items-center gap-2 ${
                isDisplayOpen
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              <Monitor className="w-4 h-4" />
              Display
            </Button>
            <Button
              size="sm"
              onClick={handleLock}
              className="flex items-center gap-2 bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200"
            >
              <Lock className="w-4 h-4" />
              Lock
            </Button>
            <Button
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2 bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Offline Banner - shows when offline or syncing */}
      <OfflineBanner />

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {renderCurrentView()}
      </div>
    </div>
  )
}

