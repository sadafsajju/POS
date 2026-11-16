import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@pos/core'
import { APP_VERSION } from '@/lib/version'
import {
  Store,
  DollarSign,
  Palette,
  UserCog,
  Menu,
  LayoutGrid,
  MapPin,
  Image,
  ImagePlus,
  BarChart3,
  Coins,
  FileSpreadsheet,
  Percent,
  Contact,
} from 'lucide-react'

interface SidebarSection {
  id: string
  label: string
  icon: React.ReactNode
  description: string
  href: string
  accent: string
  activeText: string
  activeBg: string
  /** Only show when the matching feature is enabled in settings */
  requires?: 'tipping' | 'uk_vat'
}

interface SidebarGroup {
  title: string
  sections: SidebarSection[]
}

// Ordered by how often an operator touches them: day-to-day management first,
// set-once configuration last.
const groups: SidebarGroup[] = [
  {
    title: 'Manage',
    sections: [
      {
        id: 'menu',
        label: 'Food Menu',
        icon: <Menu className="w-4 h-4" />,
        description: 'Products, categories & AI import',
        href: '/admin/more/menu',
        accent: 'bg-amber-500',
        activeText: 'text-amber-400',
        activeBg: 'bg-amber-500/10',
      },
      {
        id: 'tables',
        label: 'Tables',
        icon: <LayoutGrid className="w-4 h-4" />,
        description: 'Dining table management',
        href: '/admin/more/tables',
        accent: 'bg-emerald-500',
        activeText: 'text-emerald-400',
        activeBg: 'bg-emerald-500/10',
      },
      {
        id: 'customers',
        label: 'Customers',
        icon: <Contact className="w-4 h-4" />,
        description: 'Customer directory',
        href: '/admin/more/customers',
        accent: 'bg-indigo-500',
        activeText: 'text-indigo-400',
        activeBg: 'bg-indigo-500/10',
      },
      {
        id: 'staff',
        label: 'Staff',
        icon: <UserCog className="w-4 h-4" />,
        description: 'User and role management',
        href: '/admin/more/staff',
        accent: 'bg-rose-500',
        activeText: 'text-rose-400',
        activeBg: 'bg-rose-500/10',
      },
      {
        id: 'locations',
        label: 'Locations',
        icon: <MapPin className="w-4 h-4" />,
        description: 'Branch & location management',
        href: '/admin/more/locations',
        accent: 'bg-teal-500',
        activeText: 'text-teal-400',
        activeBg: 'bg-teal-500/10',
      },
      {
        id: 'discounts',
        label: 'Discounts',
        icon: <Percent className="w-4 h-4" />,
        description: 'Named discounts for the payment step',
        href: '/admin/more/discounts',
        accent: 'bg-rose-500',
        activeText: 'text-rose-400',
        activeBg: 'bg-rose-500/10',
      },
      {
        id: 'customization',
        label: 'Customization',
        icon: <Palette className="w-4 h-4" />,
        description: 'Product cards, cart & receipt design',
        href: '/admin/more/customization',
        accent: 'bg-orange-500',
        activeText: 'text-orange-400',
        activeBg: 'bg-orange-500/10',
      },
    ],
  },
  {
    title: 'Content',
    sections: [
      {
        id: 'media',
        label: 'Media',
        icon: <ImagePlus className="w-4 h-4" />,
        description: 'Image library',
        href: '/admin/more/media',
        accent: 'bg-sky-500',
        activeText: 'text-sky-400',
        activeBg: 'bg-sky-500/10',
      },
      {
        id: 'promos',
        label: 'Promos',
        icon: <Image className="w-4 h-4" />,
        description: 'Customer display carousel',
        href: '/admin/more/promos',
        accent: 'bg-purple-500',
        activeText: 'text-purple-400',
        activeBg: 'bg-purple-500/10',
      },
    ],
  },
  {
    title: 'Insights',
    sections: [
      {
        id: 'reports',
        label: 'Reports',
        icon: <BarChart3 className="w-4 h-4" />,
        description: 'Sales, orders & analytics',
        href: '/admin/more/reports',
        accent: 'bg-blue-500',
        activeText: 'text-blue-400',
        activeBg: 'bg-blue-500/10',
      },
      {
        id: 'tips',
        label: 'Tip allocation',
        icon: <Coins className="w-4 h-4" />,
        description: 'Split tip pool to staff',
        href: '/admin/more/tips',
        accent: 'bg-emerald-500',
        activeText: 'text-emerald-400',
        activeBg: 'bg-emerald-500/10',
        requires: 'tipping',
      },
      {
        id: 'vat-export',
        label: 'VAT export',
        icon: <FileSpreadsheet className="w-4 h-4" />,
        description: 'MTD-compatible CSV',
        href: '/admin/more/vat-export',
        accent: 'bg-emerald-500',
        activeText: 'text-emerald-400',
        activeBg: 'bg-emerald-500/10',
        requires: 'uk_vat',
      },
    ],
  },
  {
    title: 'Settings',
    sections: [
      {
        id: 'general',
        label: 'General',
        icon: <Store className="w-4 h-4" />,
        description: 'Restaurant info & language',
        href: '/admin/more/general',
        accent: 'bg-amber-500',
        activeText: 'text-amber-400',
        activeBg: 'bg-amber-500/10',
      },
      {
        id: 'financial',
        label: 'Financial',
        icon: <DollarSign className="w-4 h-4" />,
        description: 'Tax, allergens, tipping, GDPR',
        href: '/admin/more/financial',
        accent: 'bg-emerald-500',
        activeText: 'text-emerald-400',
        activeBg: 'bg-emerald-500/10',
      },
      // Future sections (routes exist but are hidden from the sidebar):
      // System (/admin/more/system), Account (/admin/more/account),
      // About (/admin/more/about), Platforms (/admin/more/platforms),
      // QR Codes (/admin/more/qr-codes)
    ],
  },
]

export function SettingsSidebar() {
  const location = useLocation()
  const { settings } = useSettingsStore()

  const isActiveRoute = (href: string) => {
    // Hub pages with sub-routes stay highlighted while inside them
    if (href === '/admin/more/menu' || href === '/admin/more/customization') {
      return location.pathname.startsWith(href)
    }
    return location.pathname === href
  }

  const isVisible = (section: SidebarSection) => {
    if (section.requires === 'tipping') return settings.tippingEnabled
    if (section.requires === 'uk_vat') return settings.taxRegime === 'uk_vat'
    return true
  }

  return (
    <div className="w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
        <span className="text-lg font-bold tracking-tight text-zinc-300">More</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
        {groups.map((group, groupIdx) => {
          const visibleSections = group.sections.filter(isVisible)
          if (visibleSections.length === 0) return null
          return (
            <div key={group.title}>
              {groupIdx === 0 ? (
                <p className="text-[10px] uppercase tracking-wider text-zinc-600 px-3 mb-2 font-bold">
                  {group.title}
                </p>
              ) : (
                <div className="pt-4 pb-2 px-3">
                  <div className="border-t border-zinc-800" />
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600 mt-3 font-bold">
                    {group.title}
                  </p>
                </div>
              )}
              <div className="space-y-1">
                {visibleSections.map((section) => {
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
                            <span
                              className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', section.accent)}
                            />
                          )}
                          <span className={cn(!active && 'ml-4')}>{section.icon}</span>
                          <span className="text-sm font-medium truncate">{section.label}</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Version footer — always visible so support can ask "what version?"
          and the operator can read it off the sidebar without hunting. */}
      <div className="flex-shrink-0 px-4 py-2.5 border-t border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-600 font-mono flex items-center justify-between">
        <span>POS</span>
        <span title="App version">v{APP_VERSION}</span>
      </div>
    </div>
  )
}
