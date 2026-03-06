import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit,
  Trash2,
  Package,
  DollarSign,
  Clock,
  Tag,
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

function SortButton({ column, icon: Icon, label }: { column: any; icon: any; label: string }) {
  const isSorted = column.getIsSorted()
  return (
    <button
      onClick={() => column.toggleSorting(isSorted === "asc")}
      className="flex items-center gap-1.5 h-8 px-2 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-xs font-medium"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {isSorted === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />
      ) : isSorted === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  )
}

export function AdminMenuTable({
  data,
  categories,
  onEdit,
  onDelete,
  onToggleAvailability,
  isLoading = false
}: AdminMenuTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [locationDialogProduct, setLocationDialogProduct] = useState<Product | null>(null)
  const [pendingLocationIds, setPendingLocationIds] = useState<string[]>([])
  const queryClient = useQueryClient()

  // Fetch locations for displaying location assignments
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
    if (!categoryId) return "No Category"
    const category = categories.find(cat => cat.id === categoryId)
    return category?.name || "Unknown Category"
  }

  const { settings } = useSettingsStore()
  const format = (amount: number) => formatCurrency(amount, settings.currency, settings.currencySymbol)

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <SortButton column={column} icon={Package} label="Product" />,
      cell: ({ row }) => {
        const product = row.original
        return (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {product.image_url ? (
                <img
                  src={imageUrl(product.image_url)}
                  alt={product.name}
                  className="h-10 w-10 rounded-lg object-cover ring-1 ring-zinc-700"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center ring-1 ring-zinc-700">
                  <Package className="h-5 w-5 text-zinc-500" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-zinc-200 flex items-center gap-1.5">
                <span className="truncate">{product.name}</span>
                {product.dietary_type && <DietaryIndicator type={product.dietary_type} size="sm" />}
              </div>
              <div className="text-xs text-zinc-500 line-clamp-1">
                {product.description || "No description"}
              </div>
              {product.preparation_time > 0 && (
                <div className="text-xs text-zinc-600 mt-0.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {product.preparation_time}min
                </div>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "category_id",
      header: ({ column }) => <SortButton column={column} icon={Tag} label="Category" />,
      cell: ({ getValue }) => {
        const categoryId = getValue() as string | null
        const categoryName = getCategoryName(categoryId)
        return (
          <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium",
            categoryId
              ? "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700"
              : "bg-zinc-800/50 text-zinc-600"
          )}>
            {categoryName}
          </span>
        )
      },
    },
    ...(locations.length > 1 ? [{
      id: "locations",
      header: () => (
        <span className="text-xs font-medium text-zinc-400 px-2">Locations</span>
      ),
      cell: ({ row }: { row: any }) => {
        const product = row.original as Product
        if (!product.location_ids || product.location_ids.length === 0) {
          return (
            <button
              onClick={() => openLocationDialog(product)}
              className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer"
            >
              All Locations
            </button>
          )
        }
        return (
          <button
            onClick={() => openLocationDialog(product)}
            className="flex flex-wrap gap-1 max-w-[200px] cursor-pointer group"
          >
            {product.location_ids.map((id) => (
              <span
                key={id}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 group-hover:bg-blue-500/20 transition-colors"
              >
                {locationMap[id] || 'Unknown'}
              </span>
            ))}
          </button>
        )
      },
    } as ColumnDef<Product>] : []),
    {
      accessorKey: "price",
      header: ({ column }) => <SortButton column={column} icon={DollarSign} label="Price" />,
      cell: ({ row }) => {
        const product = row.original
        return (
          <div className="font-semibold text-emerald-400 tabular-nums">
            {product.min_variation_price != null ? (
              product.min_variation_price === product.max_variation_price
                ? format(product.min_variation_price)
                : `${format(product.min_variation_price)} - ${format(product.max_variation_price!)}`
            ) : (
              format(product.price)
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "is_available",
      header: () => (
        <span className="text-xs font-medium text-zinc-400 px-2">Availability</span>
      ),
      cell: ({ row }) => {
        const product = row.original
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={product.is_available}
              onCheckedChange={(checked) => onToggleAvailability?.(product, checked)}
            />
            <span className={cn(
              "text-xs font-medium",
              product.is_available ? 'text-emerald-400' : 'text-zinc-600'
            )}>
              {product.is_available ? "Available" : "Out of Stock"}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "sort_order",
      header: ({ column }) => <SortButton column={column} icon={ArrowUpDown} label="Order" />,
      cell: ({ getValue }) => {
        const order = getValue() as number
        return (
          <span className="text-zinc-500 font-mono text-xs tabular-nums">
            #{order}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: () => (
        <span className="text-xs font-medium text-zinc-400 px-2">Actions</span>
      ),
      cell: ({ row }) => {
        const product = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center h-8 w-8 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
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
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  })

  const isAllSelected = pendingLocationIds.length === 0

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
            {/* All Locations option */}
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

            {/* Individual locations */}
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

          {/* Footer */}
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

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-zinc-800 hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-4 bg-zinc-900/80 text-zinc-400">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-zinc-800/60 hover:bg-transparent">
                  {columns.map((_, j) => (
                    <TableCell key={j} className="px-4 py-3">
                      <div className="h-4 bg-zinc-800 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-zinc-800/60 hover:bg-zinc-800/40 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="border-zinc-800/60 hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-zinc-600" />
                    </div>
                    <p className="text-sm font-medium text-zinc-400">No products found</p>
                    <p className="text-xs text-zinc-600">Try adjusting your search or add a new product</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
