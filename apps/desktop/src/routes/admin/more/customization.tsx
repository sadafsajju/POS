import { createFileRoute, Outlet, Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Package, ShoppingCart, Printer } from 'lucide-react'

export const Route = createFileRoute('/admin/more/customization')({
  component: CustomizationLayout,
})

const tabs = [
  {
    id: 'products',
    label: 'Product Cards',
    icon: Package,
    href: '/admin/more/customization/products',
  },
  {
    id: 'cart',
    label: 'Cart Layout',
    icon: ShoppingCart,
    href: '/admin/more/customization/cart',
  },
  {
    id: 'receipts',
    label: 'Receipt Design',
    icon: Printer,
    href: '/admin/more/customization/receipts',
  },
]

function CustomizationLayout() {
  const location = useLocation()

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Tab bar */}
      <div className="flex-shrink-0 px-6 pt-4 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const active = location.pathname === tab.href
            const Icon = tab.icon
            return (
              <Link
                key={tab.id}
                to={tab.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
                  active
                    ? 'text-amber-400 border-amber-500 bg-zinc-900'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900/50'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Active tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
