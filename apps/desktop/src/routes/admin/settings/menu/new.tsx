import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { ProductForm } from '@/components/forms/ProductForm'
import { ChevronRight } from 'lucide-react'

export const Route = createFileRoute('/admin/settings/menu/new')({
  component: CreateProductPage,
})

function CreateProductPage() {
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col">
      {/* Header with breadcrumbs */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <nav className="flex items-center text-sm text-muted-foreground mb-1">
            <Link to="/admin/settings/menu" className="hover:text-foreground transition-colors">
              Menu Management
            </Link>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span className="text-foreground font-medium">New Product</span>
          </nav>
          <h2 className="text-2xl font-bold tracking-tight">Create New Product</h2>
          <p className="text-sm text-muted-foreground">
            Add a new product to your menu
          </p>
        </div>
      </div>

      {/* Form takes remaining space */}
      <div className="flex-1 min-h-0">
        <ProductForm
          mode="create"
          onCreated={(product) => {
            navigate({
              to: '/admin/settings/menu/$productId/edit',
              params: { productId: product.id.toString() },
              replace: true,
            })
          }}
          onSuccess={() => {
            navigate({ to: '/admin/settings/menu' })
          }}
          onCancel={() => {
            navigate({ to: '/admin/settings/menu' })
          }}
        />
      </div>
    </div>
  )
}
