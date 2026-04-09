import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Plus,
  Search,
  Package,
  Tag,
  Layers,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import apiClient from '@/api/client'
import { toastHelpers } from '@/lib/toast-helpers'
import { ProductForm } from '@/components/forms/ProductForm'
import { CategoryForm } from '@/components/forms/CategoryForm'
import { AdminMenuTable } from '@/components/admin/AdminMenuTable'
import { AdminCategoriesTable } from '@/components/admin/AdminCategoriesTable'
import { AdminVariationsTable } from '@/components/admin/AdminVariationsTable'
import { VariationGroupForm } from '@/components/forms/VariationGroupForm'
import { PaginationControlsComponent } from '@/components/ui/pagination-controls'
import { usePagination } from '@/hooks/usePagination'
import { useRequirePin } from '@pos/core'
import type { Product, Category, VariationGroup } from '@/types'

type ActiveTab = 'products' | 'categories' | 'variations'

export function AdminMenuManagement() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('products')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [debouncedCategorySearch, setDebouncedCategorySearch] = useState('')

  // Product dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [productDialogMode, setProductDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  // Variation dialog state
  const [variationDialogOpen, setVariationDialogOpen] = useState(false)
  const [editingVariation, setEditingVariation] = useState<VariationGroup | null>(null)
  const [variationSearch, setVariationSearch] = useState('')
  const [debouncedVariationSearch, setDebouncedVariationSearch] = useState('')

  const queryClient = useQueryClient()

  // Pagination hooks
  const productsPagination = usePagination({
    initialPage: 1,
    initialPageSize: 10,
    total: 0
  })

  const categoriesPagination = usePagination({
    initialPage: 1,
    initialPageSize: 10,
    total: 0
  })

  const variationsPagination = usePagination({
    initialPage: 1,
    initialPageSize: 10,
    total: 0
  })

  // Debounce product search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      productsPagination.goToFirstPage()
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Debounce category search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCategorySearch(categorySearch)
      categoriesPagination.goToFirstPage()
    }, 500)
    return () => clearTimeout(timer)
  }, [categorySearch])

  // Debounce variation search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedVariationSearch(variationSearch)
      variationsPagination.goToFirstPage()
    }, 500)
    return () => clearTimeout(timer)
  }, [variationSearch])

  // Fetch products with pagination
  const { data: productsData, isLoading: isLoadingProducts, isFetching: isFetchingProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['admin-products', productsPagination.page, productsPagination.pageSize, debouncedSearch],
    queryFn: () => apiClient.getAdminProducts({
      page: productsPagination.page,
      per_page: productsPagination.pageSize,
      search: debouncedSearch || undefined
    })
  })

  // Fetch categories with pagination
  const { data: categoriesData, isLoading: isLoadingCategories, isFetching: isFetchingCategories, refetch: refetchCategories } = useQuery({
    queryKey: ['admin-categories', categoriesPagination.page, categoriesPagination.pageSize, debouncedCategorySearch],
    queryFn: () => apiClient.getAdminCategories({
      page: categoriesPagination.page,
      per_page: categoriesPagination.pageSize,
      search: debouncedCategorySearch || undefined
    })
  })

  // Fetch variations with pagination
  const { data: variationsData, isLoading: isLoadingVariations, isFetching: isFetchingVariations, refetch: refetchVariations } = useQuery({
    queryKey: ['admin-variations', variationsPagination.page, variationsPagination.pageSize, debouncedVariationSearch],
    queryFn: () => apiClient.getVariationGroups({
      page: variationsPagination.page,
      per_page: variationsPagination.pageSize,
      search: debouncedVariationSearch || undefined
    })
  })

  // Extract data and pagination info
  const products = Array.isArray(productsData) ? productsData : (productsData as any)?.data || []
  const productsPaginationInfo = (productsData as any)?.meta || { total: 0 }

  const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData as any)?.data || []
  const categoriesPaginationInfo = (categoriesData as any)?.meta || { total: 0 }

  const variations = Array.isArray(variationsData) ? variationsData : (variationsData as any)?.data || []
  const variationsPaginationInfo = (variationsData as any)?.meta || { total: 0 }

  // Toggle product availability mutation
  const toggleAvailabilityMutation = useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) =>
      apiClient.updateProduct(id, { is_available: available }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    },
    onError: (error: any) => {
      toastHelpers.apiError('Toggle availability', error)
    }
  })

  const handleToggleAvailability = useCallback((product: Product, available: boolean) => {
    toggleAvailabilityMutation.mutate({ id: product.id.toString(), available })
  }, [toggleAvailabilityMutation])

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      toastHelpers.apiSuccess('Delete', 'Product')
    },
    onError: (error: any) => {
      toastHelpers.apiError('Delete product', error)
    }
  })

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      toastHelpers.apiSuccess('Delete', 'Category')
    },
    onError: (error: any) => {
      toastHelpers.apiError('Delete category', error)
    }
  })

  // Delete variation mutation
  const deleteVariationMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteVariationGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-variations'] })
      toastHelpers.apiSuccess('Delete', 'Variation')
    },
    onError: (error: any) => {
      toastHelpers.apiError('Delete variation', error)
    }
  })

  const requirePin = useRequirePin()

  const handleDeleteProduct = useCallback(async (product: Product) => {
    const verified = await requirePin('Delete Product', `Enter PIN to delete "${product.name}"`)
    if (verified) {
      deleteProductMutation.mutate(product.id.toString())
    }
  }, [requirePin, deleteProductMutation])

  const handleDeleteCategory = useCallback(async (category: Category) => {
    const verified = await requirePin('Delete Category', `Enter PIN to delete "${category.name}"`)
    if (verified) {
      deleteCategoryMutation.mutate(category.id.toString())
    }
  }, [requirePin, deleteCategoryMutation])

  // Product dialog handlers
  const handleAddProduct = () => {
    setSelectedProduct(null)
    setProductDialogMode('create')
    setProductDialogOpen(true)
  }

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product)
    setProductDialogMode('edit')
    setProductDialogOpen(true)
  }

  const closeProductDialog = () => {
    setProductDialogOpen(false)
    setSelectedProduct(null)
    setProductDialogMode('create')
  }

  // Category dialog handlers
  const handleAddCategory = () => {
    setEditingCategory(null)
    setCategoryDialogOpen(true)
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setCategoryDialogOpen(true)
  }

  const closeCategoryDialog = () => {
    setCategoryDialogOpen(false)
    setEditingCategory(null)
  }

  // Variation dialog handlers
  const handleAddVariation = () => {
    setEditingVariation(null)
    setVariationDialogOpen(true)
  }

  const handleEditVariation = (variation: VariationGroup) => {
    setEditingVariation(variation)
    setVariationDialogOpen(true)
  }

  const handleDeleteVariation = async (variation: VariationGroup) => {
    const verified = await requirePin('Delete Variation', `Enter PIN to delete "${variation.name}"`)
    if (verified) {
      deleteVariationMutation.mutate(variation.id.toString())
    }
  }

  const closeVariationDialog = () => {
    setVariationDialogOpen(false)
    setEditingVariation(null)
  }

  const isFetching = activeTab === 'products' ? isFetchingProducts : activeTab === 'categories' ? isFetchingCategories : isFetchingVariations
  const totalProducts = productsPaginationInfo.total || products.length
  const totalCategories = categoriesPaginationInfo.total || categories.length
  const totalVariations = variationsPaginationInfo.total || variations.length

  return (
    <div className="h-full flex flex-col overflow-hidden select-none">

      {/* ── Header Strip ─────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-zinc-300">MENU</span>
          <div className="h-5 w-px bg-zinc-700" />
          <Pill color="bg-emerald-500" count={totalProducts} label="Products" />
          <Pill color="bg-amber-500" count={totalCategories} label="Categories" />
          <Pill color="bg-violet-500" count={totalVariations} label="Variations" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => activeTab === 'products' ? refetchProducts() : activeTab === 'categories' ? refetchCategories() : refetchVariations()}
            disabled={isFetching}
            className="p-2 rounded-md bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </button>
          <button
            onClick={activeTab === 'products' ? handleAddProduct : activeTab === 'categories' ? handleAddCategory : handleAddVariation}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {activeTab === 'products' ? 'Add Product' : activeTab === 'categories' ? 'Add Category' : 'Add Variation'}
          </button>
        </div>
      </header>

      {/* ── Tab Bar + Search + Add ────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 bg-zinc-900/50 border-b border-zinc-800/60">
        <button
          onClick={() => setActiveTab('products')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            activeTab === 'products'
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          )}
        >
          <Package className="h-4 w-4" />
          Products
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            activeTab === 'categories'
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          )}
        >
          <Tag className="h-4 w-4" />
          Categories
        </button>
        <button
          onClick={() => setActiveTab('variations')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            activeTab === 'variations'
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          )}
        >
          <Layers className="h-4 w-4" />
          Variations
        </button>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder={activeTab === 'products' ? 'Search products...' : activeTab === 'categories' ? 'Search categories...' : 'Search variations...'}
            value={activeTab === 'products' ? searchTerm : activeTab === 'categories' ? categorySearch : variationSearch}
            onChange={(e) => activeTab === 'products' ? setSearchTerm(e.target.value) : activeTab === 'categories' ? setCategorySearch(e.target.value) : setVariationSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-zinc-800 border border-zinc-700/50 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600 transition-colors"
          />
        </div>

      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'products' ? (
          <div className="p-4 space-y-4">
            <AdminMenuTable
              data={products}
              categories={categories}
              onEdit={handleEditProduct}
              onDelete={handleDeleteProduct}
              onToggleAvailability={handleToggleAvailability}
              isLoading={isLoadingProducts}
            />

            {products.length > 0 && (
              <PaginationControlsComponent
                pagination={productsPagination}
                total={totalProducts}
              />
            )}
          </div>
        ) : activeTab === 'categories' ? (
          <div className="p-4 space-y-4">
            <AdminCategoriesTable
              data={categories}
              onEdit={handleEditCategory}
              onDelete={handleDeleteCategory}
              isLoading={isLoadingCategories}
            />

            {categories.length > 0 && (
              <PaginationControlsComponent
                pagination={categoriesPagination}
                total={totalCategories}
              />
            )}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <AdminVariationsTable
              data={variations}
              onEdit={handleEditVariation}
              onDelete={handleDeleteVariation}
              isLoading={isLoadingVariations}
            />

            {variations.length > 0 && (
              <PaginationControlsComponent
                pagination={variationsPagination}
                total={totalVariations}
              />
            )}
          </div>
        )}
      </div>

      {/* Product Create/Edit Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={(open) => { if (!open) closeProductDialog() }}>
        <DialogContent className="dark flex flex-col !max-w-none !w-screen !h-screen !rounded-none p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-zinc-800 flex-shrink-0 bg-zinc-900">
            <DialogTitle className="text-zinc-100">
              {productDialogMode === 'edit' ? 'Edit Product' : 'Create New Product'}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              {productDialogMode === 'edit'
                ? `Editing "${selectedProduct?.name}"`
                : 'Add a new product to your menu'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <ProductForm
              key={selectedProduct ? `edit-${selectedProduct.id}` : 'create'}
              product={selectedProduct || undefined}
              mode={productDialogMode}
              onCreated={async (partialProduct) => {
                try {
                  const res = await apiClient.getProduct(partialProduct.id.toString())
                  setSelectedProduct(res.data || partialProduct)
                } catch {
                  setSelectedProduct(partialProduct)
                }
                setProductDialogMode('edit')
              }}
              onSuccess={closeProductDialog}
              onCancel={closeProductDialog}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Create/Edit Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={(open) => { if (!open) closeCategoryDialog() }}>
        <DialogContent className="dark max-w-2xl p-0 gap-0 border-0 bg-transparent shadow-none [&>button]:hidden overflow-hidden text-zinc-100">
          <DialogTitle className="sr-only">
            {editingCategory ? 'Edit Category' : 'Create Category'}
          </DialogTitle>
          <CategoryForm
            key={editingCategory ? `edit-${editingCategory.id}` : 'create'}
            category={editingCategory || undefined}
            mode={editingCategory ? 'edit' : 'create'}
            onSuccess={closeCategoryDialog}
            onCancel={closeCategoryDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Variation Create/Edit Dialog */}
      <Dialog open={variationDialogOpen} onOpenChange={(open) => { if (!open) closeVariationDialog() }}>
        <DialogContent className="dark max-w-2xl p-0 gap-0 border-0 bg-transparent shadow-none [&>button]:hidden overflow-hidden text-zinc-100">
          <DialogTitle className="sr-only">
            {editingVariation ? 'Edit Variation' : 'Create Variation'}
          </DialogTitle>
          <VariationGroupForm
            key={editingVariation ? `edit-${editingVariation.id}` : 'create'}
            variationGroup={editingVariation || undefined}
            mode={editingVariation ? 'edit' : 'create'}
            onSuccess={closeVariationDialog}
            onCancel={closeVariationDialog}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Pill (matches KDS style) ────────────────────────────────────────────────

function Pill({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full', color)} />
      <span className="text-sm font-bold text-zinc-200 tabular-nums">{count}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  )
}
