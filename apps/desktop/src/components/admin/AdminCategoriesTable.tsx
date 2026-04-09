import {
  Edit,
  Trash2,
  Tag,
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
import type { Category } from "@/types"

interface AdminCategoriesTableProps {
  data: Category[]
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  isLoading?: boolean
}

export function AdminCategoriesTable({
  data,
  onEdit,
  onDelete,
  isLoading = false
}: AdminCategoriesTableProps) {
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
            <Tag className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-400">No categories found</p>
          <p className="text-xs text-zinc-600">Create your first category to get started</p>
        </div>
      ) : (
        <div className="grid gap-1.5">
          {data.map((category) => {
            const isActive = category.is_active
            const categoryColor = category.color || '#3f3f46'

            return (
              <div
                key={category.id}
                className={cn(
                  "group relative flex items-center gap-4 pl-4 pr-3 py-3 rounded-xl border transition-all duration-150",
                  isActive
                    ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-800/70 hover:border-zinc-700"
                    : "bg-zinc-900/60 border-zinc-800/60 hover:bg-zinc-800/40"
                )}
              >
                {/* === IDENTITY ZONE: Color swatch + Name === */}
                <div className={cn(
                  "flex items-center gap-3.5 min-w-0 flex-1",
                  !isActive && "opacity-50"
                )}>
                  {/* Color swatch */}
                  <div
                    className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: categoryColor,
                      color: 'white'
                    }}
                  >
                    <Tag className="h-4.5 w-4.5" />
                  </div>

                  {/* Name + inline metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[15px] text-zinc-100 truncate leading-tight">
                      {category.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {category.description ? (
                        <span className="text-xs text-zinc-500 truncate max-w-[280px]">
                          {category.description}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600 italic">No description</span>
                      )}
                      {category.sort_order > 0 && (
                        <>
                          <span className="text-zinc-700">&#183;</span>
                          <span className="text-xs text-zinc-600 font-mono tabular-nums">
                            #{category.sort_order}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* === STATUS ZONE === */}
                <div className="flex-shrink-0 flex items-center gap-3">
                  {/* Status indicator */}
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

                  {/* Created date -- subtle tertiary info */}
                  <span className="hidden sm:block text-zinc-600 text-xs tabular-nums min-w-[72px] text-right">
                    {new Date(category.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                {/* === ACTIONS ZONE === */}
                <div className="flex-shrink-0 pl-2 border-l border-zinc-800">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center justify-center h-9 w-9 rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600 transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 bg-zinc-900 border-zinc-800 text-zinc-200">
                      <DropdownMenuItem
                        onClick={() => onEdit(category)}
                        className="gap-2 text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit Category
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      <DropdownMenuItem
                        onClick={() => onDelete(category)}
                        className="gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Category
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
