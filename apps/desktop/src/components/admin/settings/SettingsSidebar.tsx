import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useCustomerDisplayStore } from '@pos/core'
import {
  Store,
  DollarSign,
  Printer,
  Settings,
  Info,
  Package,
  ShoppingCart,
  UserCog,
  Menu,
  LayoutGrid,
  Plug,
  KeyRound,
  MapPin,
  Image,
  ImagePlus,
  QrCode,
  Sparkles,
} from 'lucide-react'

const settingsSections = [
  {
    id: 'general',
    label: 'General',
    icon: <Store className="w-4 h-4" />,
    description: 'Restaurant info & language',
    href: '/admin/settings/general',
    accent: 'bg-amber-500',
    activeText: 'text-amber-400',
    activeBg: 'bg-amber-500/10',
  },
  // {
  //   id: 'financial',
  //   label: 'Financial',
  //   icon: <DollarSign className="w-4 h-4" />,
  //   description: 'Currency, tax & charges',
  //   href: '/admin/settings/financial',
  //   accent: 'bg-emerald-500',
  //   activeText: 'text-emerald-400',
  //   activeBg: 'bg-emerald-500/10',
  // },
  // {
  //   id: 'system',
  //   label: 'System',
  //   icon: <Settings className="w-4 h-4" />,
  //   description: 'Theme, backup & notifications',
  //   href: '/admin/settings/system',
  //   accent: 'bg-violet-500',
  //   activeText: 'text-violet-400',
  //   activeBg: 'bg-violet-500/10',
  // },
  // {
  //   id: 'account',
  //   label: 'Account',
  //   icon: <KeyRound className="w-4 h-4" />,
  //   description: 'PIN & account security',
  //   href: '/admin/settings/account',
  //   accent: 'bg-rose-500',
  //   activeText: 'text-rose-400',
  //   activeBg: 'bg-rose-500/10',
  // },
  // {
  //   id: 'about',
  //   label: 'About',
  //   icon: <Info className="w-4 h-4" />,
  //   description: 'System status & version',
  //   href: '/admin/settings/about',
  //   accent: 'bg-zinc-500',
  //   activeText: 'text-zinc-300',
  //   activeBg: 'bg-zinc-500/10',
  // },
]

const posSections = [
  {
    id: 'products',
    label: 'Products',
    icon: <Package className="w-4 h-4" />,
    description: 'Product display options',
    href: '/admin/settings/products',
    accent: 'bg-orange-500',
    activeText: 'text-orange-400',
    activeBg: 'bg-orange-500/10',
  },
  {
    id: 'cart',
    label: 'Cart',
    icon: <ShoppingCart className="w-4 h-4" />,
    description: 'Order cart behavior & limits',
    href: '/admin/settings/cart',
    accent: 'bg-cyan-500',
    activeText: 'text-cyan-400',
    activeBg: 'bg-cyan-500/10',
  },
  {
    id: 'receipts',
    label: 'Receipts',
    icon: <Printer className="w-4 h-4" />,
    description: 'Receipt customization',
    href: '/admin/settings/receipts',
    accent: 'bg-sky-500',
    activeText: 'text-sky-400',
    activeBg: 'bg-sky-500/10',
  },
]

const managementSections = [
  {
    id: 'menu',
    label: 'Menu',
    icon: <Menu className="w-4 h-4" />,
    description: 'Products and categories',
    href: '/admin/settings/menu',
    accent: 'bg-amber-500',
    activeText: 'text-amber-400',
    activeBg: 'bg-amber-500/10',
  },
  {
    id: 'tables',
    label: 'Tables',
    icon: <LayoutGrid className="w-4 h-4" />,
    description: 'Dining table management',
    href: '/admin/settings/tables',
    accent: 'bg-emerald-500',
    activeText: 'text-emerald-400',
    activeBg: 'bg-emerald-500/10',
  },
  {
    id: 'locations',
    label: 'Locations',
    icon: <MapPin className="w-4 h-4" />,
    description: 'Branch & location management',
    href: '/admin/settings/locations',
    accent: 'bg-teal-500',
    activeText: 'text-teal-400',
    activeBg: 'bg-teal-500/10',
  },
  {
    id: 'staff',
    label: 'Staff',
    icon: <UserCog className="w-4 h-4" />,
    description: 'User and role management',
    href: '/admin/settings/staff',
    accent: 'bg-rose-500',
    activeText: 'text-rose-400',
    activeBg: 'bg-rose-500/10',
  },
  {
    id: 'media',
    label: 'Media',
    icon: <ImagePlus className="w-4 h-4" />,
    description: 'Image library',
    href: '/admin/settings/media',
    accent: 'bg-sky-500',
    activeText: 'text-sky-400',
    activeBg: 'bg-sky-500/10',
  },
  {
    id: 'promos',
    label: 'Promos',
    icon: <Image className="w-4 h-4" />,
    description: 'Customer display carousel',
    href: '/admin/settings/promos',
    accent: 'bg-purple-500',
    activeText: 'text-purple-400',
    activeBg: 'bg-purple-500/10',
  },
  {
    id: 'import',
    label: 'AI Import',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'Import menu from photo',
    href: '/admin/settings/import',
    accent: 'bg-indigo-500',
    activeText: 'text-indigo-400',
    activeBg: 'bg-indigo-500/10',
  },
  // {
  //   id: 'platforms',
  //   label: 'Platforms',
  //   icon: <Plug className="w-4 h-4" />,
  //   description: 'Swiggy & Zomato integration',
  //   href: '/admin/settings/platforms',
  //   accent: 'bg-orange-500',
  //   activeText: 'text-orange-400',
  //   activeBg: 'bg-orange-500/10',
  // },
  // {
  //   id: 'qr-codes',
  //   label: 'QR Codes',
  //   icon: <QrCode className="w-4 h-4" />,
  //   description: 'Customer self-service ordering',
  //   href: '/admin/settings/qr-codes',
  //   accent: 'bg-blue-500',
  //   activeText: 'text-blue-400',
  //   activeBg: 'bg-blue-500/10',
  // },
]

export function SettingsSidebar() {
  const location = useLocation()
  const { isOpen: isCustomerDisplayOpen } = useCustomerDisplayStore()

  const isActiveRoute = (href: string) => {
    if (href === '/admin/settings/menu') {
      return location.pathname.startsWith('/admin/settings/menu')
    }
    return location.pathname === href
  }

  return (
    <div className="w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
        <span className="text-lg font-bold tracking-tight text-zinc-300">Settings</span>
        <div className="h-5 w-px bg-zinc-700" />
        <span className="text-xs text-zinc-500">Configure</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
        {settingsSections.map((section) => {
          const active = isActiveRoute(section.href)
          return (
            <Link key={section.id} to={section.href} className="block">
              <div
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  active
                    ? cn(section.activeBg, section.activeText)
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                )}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {active && (
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', section.accent)} />
                  )}
                  <span className={cn(!active && 'ml-4')}>{section.icon}</span>
                  <span className="text-sm font-medium truncate">{section.label}</span>
                </div>
              </div>
            </Link>
          )
        })}

        {/* POS separator */}
        <div className="pt-4 pb-2 px-3">
          <div className="border-t border-zinc-800" />
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mt-3 font-bold">POS</p>
        </div>

        {posSections.map((section) => {
          const active = isActiveRoute(section.href)
          return (
            <Link key={section.id} to={section.href} className="block">
              <div
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  active
                    ? cn(section.activeBg, section.activeText)
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                )}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {active && (
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', section.accent)} />
                  )}
                  <span className={cn(!active && 'ml-4')}>{section.icon}</span>
                  <span className="text-sm font-medium truncate">{section.label}</span>
                </div>
              </div>
            </Link>
          )
        })}

        {/* Management separator */}
        <div className="pt-4 pb-2 px-3">
          <div className="border-t border-zinc-800" />
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mt-3 font-bold">Manage</p>
        </div>

        {managementSections.filter(s => s.id !== 'media' && (s.id !== 'promos' || isCustomerDisplayOpen)).map((section) => {
          const active = isActiveRoute(section.href)
          return (
            <Link key={section.id} to={section.href} className="block">
              <div
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  active
                    ? cn(section.activeBg, section.activeText)
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                )}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {active && (
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', section.accent)} />
                  )}
                  <span className={cn(!active && 'ml-4')}>{section.icon}</span>
                  <span className="text-sm font-medium truncate">{section.label}</span>
                </div>
              </div>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
