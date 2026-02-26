import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search } from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import apiClient from '@/api/client'
import type { Product, ProductOptionGroup, ComboSlot } from '@/types'
import { useKioskStore } from '../store/kiosk-store'
import type { SelectedOption, SelectedComboChoice } from '../store/kiosk-store'
import { CategorySidebar } from '../components/CategorySidebar'
import { ProductCard } from '../components/ProductCard'
import { CartFloatingButton } from '../components/CartFloatingButton'
import { KioskOptionsModal } from '../components/KioskOptionsModal'
import { KioskComboModal } from '../components/KioskComboModal'
import { OnScreenKeyboard } from '@/components/ui/on-screen-keyboard'

export function MenuScreen() {
  const { settings } = useSettingsStore()
  const setStep = useKioskStore((s) => s.setStep)
  const cart = useKioskStore((s) => s.cart)
  const addToCart = useKioskStore((s) => s.addToCart)

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchKeyboard, setShowSearchKeyboard] = useState(false)
  const [configProduct, setConfigProduct] = useState<Product | null>(null)
  const [configOptionGroups, setConfigOptionGroups] = useState<ProductOptionGroup[]>([])
  const [configComboSlots, setConfigComboSlots] = useState<ComboSlot[]>([])
  const [configMode, setConfigMode] = useState<'options' | 'combo' | null>(null)

  const formatCurrency = (amount: number) => {
    const currency = settings.currency || 'INR'
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)
  }

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['kiosk', 'categories'],
    queryFn: () => apiClient.getCategories(true),
    staleTime: 1000 * 60 * 5,
  })
  const categories = Array.isArray(categoriesData?.data) ? categoriesData.data : []

  // Fetch products
  const { data: productsData } = useQuery({
    queryKey: ['kiosk', 'products'],
    queryFn: () => apiClient.getProducts({ available: true, per_page: 500 }),
    staleTime: 1000 * 60 * 5,
  })
  const allProducts = Array.isArray(productsData?.data) ? productsData.data : []

  // Filter products
  const filteredProducts = useMemo(() => {
    let result = allProducts.filter(p => p.is_available)
    if (selectedCategory) {
      result = result.filter(p => p.category_id === selectedCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(q))
    }
    return result
  }, [allProducts, selectedCategory, searchQuery])

  // Get cart quantity for a product
  const getCartQty = (productId: string) =>
    cart.filter(item => item.product.id === productId).reduce((sum, item) => sum + item.quantity, 0)

  const handleProductTap = async (product: Product) => {
    if (product.product_type === 'combo') {
      // Load combo slots
      try {
        const response = await apiClient.getComboSlots(product.id)
        const slots = Array.isArray(response.data) ? response.data : []
        setConfigProduct(product)
        setConfigComboSlots(slots)
        setConfigMode('combo')
      } catch {
        // Fallback: add as simple
        addToCart(product, 1)
      }
    } else if (product.has_option_groups) {
      // Load option groups
      try {
        const response = await apiClient.getOptionGroups(product.id)
        const groups = Array.isArray(response.data) ? response.data : []
        setConfigProduct(product)
        setConfigOptionGroups(groups)
        setConfigMode('options')
      } catch {
        addToCart(product, 1)
      }
    } else {
      addToCart(product, 1)
    }
  }

  const handleOptionsAddToCart = (product: Product, selectedOptions: SelectedOption[], quantity: number) => {
    addToCart(product, quantity, selectedOptions)
  }

  const handleComboAddToCart = (product: Product, _selectedOptions: SelectedOption[], quantity: number, comboChoices: SelectedComboChoice[]) => {
    addToCart(product, quantity, [], comboChoices)
  }

  const closeConfig = () => {
    setConfigProduct(null)
    setConfigMode(null)
    setConfigOptionGroups([])
    setConfigComboSlots([])
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-zinc-800 flex-shrink-0 bg-zinc-950/80 backdrop-blur-sm">
        <button
          onClick={() => setStep('order-type')}
          className="p-2 rounded-xl hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Search - tappable button that opens on-screen keyboard */}
        <button
          onClick={() => setShowSearchKeyboard(true)}
          className="flex-1 max-w-md flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-left transition-colors hover:border-zinc-500 active:scale-[0.99]"
        >
          <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          <span className={searchQuery ? 'text-zinc-100' : 'text-zinc-500'}>
            {searchQuery || 'Search menu...'}
          </span>
        </button>

        <h2 className="text-lg font-bold text-zinc-100 hidden md:block">
          {settings.restaurantName || 'Menu'}
        </h2>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Category sidebar */}
        <CategorySidebar
          categories={categories}
          selectedId={selectedCategory}
          onSelect={setSelectedCategory}
        />

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto pb-24">
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  cartQty={getCartQty(product.id)}
                  onTap={handleProductTap}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-zinc-500">
              <p className="text-lg">No items found</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating cart bar */}
      <CartFloatingButton formatCurrency={formatCurrency} />

      {/* Product options modal */}
      {configMode === 'options' && configProduct && (
        <KioskOptionsModal
          product={configProduct}
          optionGroups={configOptionGroups}
          onClose={closeConfig}
          onAddToCart={handleOptionsAddToCart}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Combo config modal */}
      {configMode === 'combo' && configProduct && (
        <KioskComboModal
          product={configProduct}
          comboSlots={configComboSlots}
          onClose={closeConfig}
          onAddToCart={handleComboAddToCart}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Search keyboard */}
      <OnScreenKeyboard
        open={showSearchKeyboard}
        onOpenChange={setShowSearchKeyboard}
        value={searchQuery}
        onValueChange={setSearchQuery}
        onSubmit={() => setShowSearchKeyboard(false)}
        title="Search Menu"
        placeholder="Type a product name..."
        maxLength={100}
      />
    </div>
  )
}
