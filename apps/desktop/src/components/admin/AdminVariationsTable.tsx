import {
  Edit,
  Trash2,
  Layers,
  MoreHorizontal
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { VariationGroup } from "@/types"

interface AdminVariationsTableProps {
  data: VariationGroup[]
  onEdit: (variation: VariationGroup) => void
  onDelete: (variation: VariationGroup) => void
  isLoading?: boolean
}

export function AdminVariationsTable({
  data,
  onEdit,
  onDelete,
  isLoading = false
}: AdminVariationsTableProps) {
  return (
    <div className="w-full">
      {isLoading ? (
        <div className="grid gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[64px] rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center">
            <Layers className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-400">No variations found</p>
          <p className="text-xs text-zinc-600">Create your first variation group to get started</p>
        </div>
      ) : (
        <div className="grid gap-1.5">
          {data.map((variation) => {
            const itemCount = variation.items?.length || 0
            const isActive = variation.is_active
            const productCount = (variation as any).product_count || 0

            return (
              <div
                key={variation.id}
                className={cn(
                  "group relative flex items-center gap-4 pl-4 pr-3 py-3 rounded-xl border transition-all duration-150",
                  "border-l-[3px]",
                  isActive
                    ? "bg-zinc-900 border-zinc-800 border-l-violet-500/70 hover:bg-zinc-800/70 hover:border-zinc-700"
                    : "bg-zinc-900/60 border-zinc-800/60 border-l-zinc-700 hover:bg-zinc-800/40"
                )}
              >
                {/* === IDENTITY ZONE: Icon + Name + Options list === */}
                <div className={cn(
                  "flex items-center gap-3.5 min-w-0 flex-1",
                  !isActive && "opacity-50"
                )}>
                  {/* Icon */}
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center bg-violet-500/15">
                    <Layers className="h-5 w-5 text-violet-400" />
                  </div>

                  {/* Name + option names */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[15px] text-zinc-100 truncate leading-tight">
                        {variation.name}
                      </span>
                      <span className="flex-shrink-0 text-xs text-zinc-500 tabular-nums">
                        {itemCount} {itemCount === 1 ? 'option' : 'options'}
                      </span>
                    </div>
                    {variation.items?.length > 0 && (
                      <div className="text-xs text-zinc-600 truncate mt-0.5 max-w-[320px]">
                        {variation.items.map(i => i.name).join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* === METADATA ZONE: Badges grouped together === */}
                <div className={cn(
                  "flex-shrink-0 flex items-center gap-2",
                  !isActive && "opacity-50"
                )}>
                  {/* Selection type */}
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium",
                    variation.selection_type === 'single'
                      ? "bg-zinc-800 text-zinc-400"
                      : "bg-violet-500/10 text-violet-400"
                  )}>
                    {variation.selection_type === 'single' ? 'Pick one' : 'Pick many'}
                  </span>

                  {/* Required badge -- only show when required (noteworthy state) */}
                  {variation.is_required && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400">
                      Required
                    </span>
                  )}

                  {/* Product count -- inline text, not a badge */}
                  {productCount > 0 && (
                    <span className="text-xs text-zinc-500 tabular-nums">
                      {productCount} {productCount === 1 ? 'product' : 'products'}
                    </span>
                  )}
                </div>

                {/* === STATUS + ACTIONS ZONE === */}
                <div className="flex-shrink-0 flex items-center gap-3 pl-2 border-l border-zinc-800">
                  {/* Status */}
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium",
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-zinc-800 text-zinc-500"
                  )}>
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      isActive ? "bg-emerald-400" : "bg-zinc-600"
                    )} />
                    {isActive ? "Active" : "Inactive"}
                  </span>

                  {/* Actions menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center justify-center h-9 w-9 rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600 transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 bg-zinc-900 border-zinc-800 text-zinc-200">
                      <DropdownMenuItem
                        onClick={() => onEdit(variation)}
                        className="gap-2 text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit Variation
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      <DropdownMenuItem
                        onClick={() => onDelete(variation)}
                        className="gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Variation
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
