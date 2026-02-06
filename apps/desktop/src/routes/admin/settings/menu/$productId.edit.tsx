import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ProductForm } from '@/components/forms/ProductForm'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, ChevronRight } from 'lucide-react'
import apiClient from '@/api/client'

export const Route = createFileRoute('/admin/settings/menu/$productId/edit')({
  component: EditProductPage,
})

function EditProductPage() {
  const { productId } = Route.useParams()
  const navigate = useNavigate()

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => apiClient.getProduct(productId),
  })

  const product = response?.data

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">Product not found</p>
          <Button
            variant="outline"
            onClick={() => navigate({ to: '/admin/settings/menu' })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Menu
          </Button>
        </div>
      </div>
    )
  }

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
            <span className="text-foreground font-medium">{product.name}</span>
          </nav>
          <h2 className="text-2xl font-bold tracking-tight">Edit Product</h2>
          <p className="text-sm text-muted-foreground">
            Update details for {product.name}
          </p>
        </div>
      </div>

      {/* Form takes remaining space */}
      <div className="flex-1 min-h-0">
        <ProductForm
          product={product}
          mode="edit"
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
