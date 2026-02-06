import { Link, useLocation } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Store,
  DollarSign,
  Printer,
  Settings,
  Info,
  Package,
  UserCog,
  Menu,
  LayoutGrid,
  Plug,
} from 'lucide-react'

const settingsSections = [
  {
    id: 'general',
    label: 'General',
    icon: <Store className="w-4 h-4" />,
    description: 'Restaurant info & language',
    href: '/admin/settings/general',
  },
  {
    id: 'products',
    label: 'Products',
    icon: <Package className="w-4 h-4" />,
    description: 'Product display options',
    href: '/admin/settings/products',
  },
  {
    id: 'financial',
    label: 'Financial',
    icon: <DollarSign className="w-4 h-4" />,
    description: 'Currency, tax & charges',
    href: '/admin/settings/financial',
  },
  {
    id: 'receipts',
    label: 'Receipts',
    icon: <Printer className="w-4 h-4" />,
    description: 'Receipt customization',
    href: '/admin/settings/receipts',
  },
  {
    id: 'system',
    label: 'System',
    icon: <Settings className="w-4 h-4" />,
    description: 'Theme, backup & notifications',
    href: '/admin/settings/system',
  },
  {
    id: 'about',
    label: 'About',
    icon: <Info className="w-4 h-4" />,
    description: 'System status & version',
    href: '/admin/settings/about',
  },
]

const managementSections = [
  {
    id: 'staff',
    label: 'Staff',
    icon: <UserCog className="w-4 h-4" />,
    description: 'User and role management',
    href: '/admin/settings/staff',
  },
  {
    id: 'menu',
    label: 'Menu',
    icon: <Menu className="w-4 h-4" />,
    description: 'Products and categories',
    href: '/admin/settings/menu',
  },
  {
    id: 'tables',
    label: 'Tables',
    icon: <LayoutGrid className="w-4 h-4" />,
    description: 'Dining table management',
    href: '/admin/settings/tables',
  },
  {
    id: 'platforms',
    label: 'Platforms',
    icon: <Plug className="w-4 h-4" />,
    description: 'Swiggy & Zomato integration',
    href: '/admin/settings/platforms',
  },
]

export function SettingsSidebar() {
  const location = useLocation()

  const isActiveRoute = (href: string) => {
    if (href === '/admin/settings/menu') {
      return location.pathname.startsWith('/admin/settings/menu')
    }
    return location.pathname === href
  }

  return (
    <div className="w-56 bg-muted/30 border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-xs text-muted-foreground">Configure your system</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {settingsSections.map((section) => (
          <Link key={section.id} to={section.href} className="block">
            <Button
              variant={isActiveRoute(section.href) ? 'default' : 'ghost'}
              className="w-full justify-start gap-3 h-10"
            >
              {section.icon}
              <span>{section.label}</span>
            </Button>
          </Link>
        ))}

        {/* Management separator */}
        <div className="pt-3 pb-2">
          <div className="border-t border-border" />
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-3 px-3">Manage</p>
        </div>

        {managementSections.map((section) => (
          <Link key={section.id} to={section.href} className="block">
            <Button
              variant={isActiveRoute(section.href) ? 'default' : 'ghost'}
              className="w-full justify-start gap-3 h-10"
            >
              {section.icon}
              <span>{section.label}</span>
            </Button>
          </Link>
        ))}
      </nav>
    </div>
  )
}
