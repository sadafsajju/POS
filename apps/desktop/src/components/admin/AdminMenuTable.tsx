import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Edit,
  Trash2,
  Package,
  Clock,
  MoreHorizontal
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { cn, formatCurrency, imageUrl } from '@/lib/utils'
import { useSettingsStore } from '@pos/core'
import { DietaryIndicator } from '@/components/forms/FormComponents'
import apiClient from '@/api/client'
import type { Product, Category, Location } from "@/types"

interface AdminMenuTableProps {
  data: Product[]
  categories: Category[]
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onToggleAvailability?: (product: Product, available: boolean) => void
  isLoading?: boolean
}

export function AdminMenuTable({
  data,
  categories,
  onEdit,
  onDelete,
  onToggleAvailability,
  isLoading = false
}: AdminMenuTableProps) {
  const [locationDialogProduct, setLocationDialogProduct] = useState<Product | null>(null)
  const [pendingLocationIds, setPendingLocationIds] = useState<string[]>([])
  const queryClient = useQueryClient()

  const { data: locations = [] } = useQuery({
    queryKey: ['admin-locations'],
    queryFn: async () => {
      const res = await apiClient.getLocations()
      if (res && Array.isArray((res as any).data)) {
        return (res as any).data as Location[]
      }
      return [] as Location[]
    },
  })

  const locationMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const loc of locations) {
      map[loc.id] = loc.name
    }
    return map
  }, [locations])

  const openLocationDialog = useCallback((product: Product) => {
    setLocationDialogProduct(product)
    setPendingLocationIds(product.location_ids || [])
  }, [])

  const toggleLocation = useCallback((locationId: string) => {
    setPendingLocationIds(prev =>
      prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    )
  }, [])

  const selectAllLocations = useCallback(() => {
    setPendingLocationIds([])
  }, [])

  const updateLocationsMutation = useMutation({
    mutationFn: async ({ productId, locationIds }: { productId: string; locationIds: string[] }) => {
      return apiClient.updateProduct(productId, { location_ids: locationIds.length > 0 ? locationIds : [] })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      setLocationDialogProduct(null)
    },
  })

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "Uncategorized"
    const category = categories.find(cat => cat.id === categoryId)
    return category?.name || "Unknown"
  }

  const { settings } = useSettingsStore()
  const format = (amount: number) => formatCurrency(amount, settings.currency, settings.currencySymbol)

  const isAllSelected = pendingLocationIds.length === 0
  const hasMultipleLocations = locations.length > 1

  return (
    <div className="w-full">
      {/* Location assignment dialog */}
      <Dialog open={!!locationDialogProduct} onOpenChange={(open) => { if (!open) setLocationDialogProduct(null) }}>
        <DialogContent className="max-w-sm bg-zinc-900 border-zinc-800 text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Locations for {locationDialogProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-all",
              isAllSelected
                ? "border-emerald-500/60 bg-emerald-500/10"
                : "border-zinc-700 hover:border-zinc-600"
            )}>
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={() => selectAllLocations()}
                className="border-zinc-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
              />
              <span className={cn("text-sm font-medium", isAllSelected ? "text-emerald-300" : "text-zinc-400")}>
                All Locations
              </span>
            </label>
            <div className="h-px bg-zinc-800" />
            {locations.filter(l => l.is_active).map((location) => {
              const isChecked = pendingLocationIds.includes(location.id)
              return (
                <label
                  key={location.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-all",
                    isChecked
                      ? "border-blue-500/60 bg-blue-500/10"
                      : "border-zinc-700 hover:border-zinc-600"
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleLocation(location.id)}
                    className="border-zinc-600 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                  />
                  <div>
                    <span className={cn("text-sm font-medium", isChecked ? "text-blue-300" : "text-zinc-400")}>
                      {location.name}
                    </span>
                    {location.code && (
                      <span className="ml-2 text-xs text-zinc-600">{location.code}</span>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setLocationDialogProduct(null)}
              className="px-4 py-2 rounded-md text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (locationDialogProduct) {
                  updateLocationsMutation.mutate({
                    productId: locationDialogProduct.id,
                    locationIds: pendingLocationIds,
                  })
                }
              }}
              disabled={updateLocationsMutation.isPending}
              className="px-4 py-2 rounded-md text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {updateLocationsMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[72px] rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center">
            <Package className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-400">No products found</p>
          <p className="text-xs text-zinc-600">Try adjusting your search or add a new product</p>
        </div>
      ) : (
        <div className="grid gap-1.5">
          {data.map((product) => {
            const isAvailable = product.is_available

            return (
              <div
                key={product.id}
                className={cn(
                  "group relative flex items-center gap-4 pl-4 pr-3 py-3 rounded-xl border transition-all duration-150",
                  isAvailable
                    ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-800/70 hover:border-zinc-700"
                    : "bg-zinc-900/60 border-zinc-800/60 hover:bg-zinc-800/40"
                )}
              >
                {/* === IDENTITY ZONE: Image + Name + Meta === */}
                <div className={cn(
                  "flex items-center gap-3.5 min-w-0 flex-1",
                  !isAvailable && "opacity-50"
                )}>
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    {product.image_url ? (
                      <img
                        src={imageUrl(product.image_url)}
                        alt={product.name}
                        className="h-11 w-11 rounded-lg object-cover ring-1 ring-zinc-700/80"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-lg bg-zinc-800/80 flex items-center justify-center">
                        <Package className="h-5 w-5 text-zinc-600" />
                      </div>
                    )}
                  </div>

                  {/* Name + inline metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-[15px] text-zinc-100 truncate leading-tight">
                        {product.name}
                      </span>
                      {product.dietary_type && <DietaryIndicator type={product.dietary_type} size="sm" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-zinc-500">{getCategoryName(product.category_id)}</span>
                      {product.preparation_time > 0 && (
                        <>
                          <span className="text-zinc-700">&#183;</span>
                          <span className="flex items-center gap-0.5 text-xs text-zinc-600">
                            <Clock className="h-3 w-3" />
                            {product.preparation_time}m
                          </span>
                        </>
                      )}
                      {product.sort_order > 0 && (
                        <>
                          <span className="text-zinc-700">&#183;</span>
                          <span className="text-xs text-zinc-600 font-mono tabular-nums">
                            #{product.sort_order}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* === METADATA ZONE: Location badge === */}
                {hasMultipleLocations && (
                  <button
                    onClick={() => openLocationDialog(product)}
                    className="flex-shrink-0"
                  >
                    {!product.location_ids || product.location_ids.length === 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                        All locations
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 hover:bg-blue-500/20 transition-colors">
                        {product.location_ids.length} loc
                      </span>
                    )}
                  </button>
                )}

                {/* === PRICE: Hero element, right-aligned === */}
                <div className={cn(
                  "flex-shrink-0 text-right min-w-[80px]",
                  !isAvailable && "opacity-50"
                )}>
                  <div className="font-semibold text-white font-mono tabular-nums text-[15px] leading-tight">
                    {product.min_variation_price != null ? (
                      product.min_variation_price === product.max_variation_price
                        ? format(product.min_variation_price)
                        : `${format(product.min_variation_price)} - ${format(product.max_variation_price!)}`
                    ) : (
                      format(product.price)
                    )}
                  </div>
                </div>

                {/* === ACTIONS ZONE: Toggle + Menu === */}
                <div className="flex-shrink-0 flex items-center gap-2 pl-2 border-l border-zinc-800">
                  {/* Availability toggle */}
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={product.is_available}
                      onCheckedChange={(checked) => onToggleAvailability?.(product, checked)}
                    />
                    {!isAvailable && (
                      <span className="text-[11px] font-medium text-red-400/80 uppercase tracking-wide">
                        Out
                      </span>
                    )}
                  </div>

                  {/* Actions menu -- always visible for touch, subtly muted at rest */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center justify-center h-9 w-9 rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600 transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 bg-zinc-900 border-zinc-800 text-zinc-200">
                      <DropdownMenuItem
                        onClick={() => onEdit(product)}
                        className="gap-2 text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit Product
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      <DropdownMenuItem
                        onClick={() => onDelete(product)}
                        className="gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Product
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
