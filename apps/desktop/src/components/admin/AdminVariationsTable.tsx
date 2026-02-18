import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { useState } from "react"
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
  Layers,
  Calendar,
  MoreHorizontal,
  Package
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

export function AdminVariationsTable({
  data,
  onEdit,
  onDelete,
  isLoading = false
}: AdminVariationsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns: ColumnDef<VariationGroup>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <SortButton column={column} icon={Layers} label="Variation" />,
      cell: ({ row }) => {
        const variation = row.original
        const itemCount = variation.items?.length || 0
        return (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-violet-500/15 ring-1 ring-violet-500/30">
                <Layers className="h-4 w-4 text-violet-400" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-medium text-zinc-200">
                {variation.name}
              </div>
              <div className="text-xs text-zinc-500">
                {itemCount} {itemCount === 1 ? 'option' : 'options'}
                {variation.items?.length > 0 && (
                  <span className="text-zinc-600"> — {variation.items.map(i => i.name).join(', ')}</span>
                )}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "selection_type",
      header: () => (
        <span className="text-xs font-medium text-zinc-400 px-2">Type</span>
      ),
      cell: ({ getValue }) => {
        const type = getValue() as string
        return (
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium leading-none",
            type === 'single'
              ? "bg-zinc-700 text-zinc-300"
              : "bg-violet-500/10 text-violet-400"
          )}>
            {type === 'single' ? 'Pick one' : 'Pick many'}
          </span>
        )
      },
    },
    {
      accessorKey: "is_required",
      header: () => (
        <span className="text-xs font-medium text-zinc-400 px-2">Required</span>
      ),
      cell: ({ getValue }) => {
        const isRequired = getValue() as boolean
        return isRequired ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 leading-none">
            Required
          </span>
        ) : (
          <span className="text-xs text-zinc-600">Optional</span>
        )
      },
    },
    {
      accessorKey: "product_count",
      header: ({ column }) => <SortButton column={column} icon={Package} label="Products" />,
      cell: ({ getValue }) => {
        const count = (getValue() as number) || 0
        return (
          <span className="text-zinc-400 text-xs tabular-nums">
            {count} {count === 1 ? 'product' : 'products'}
          </span>
        )
      },
    },
    {
      accessorKey: "is_active",
      header: () => (
        <span className="text-xs font-medium text-zinc-400 px-2">Status</span>
      ),
      cell: ({ getValue }) => {
        const isActive = getValue() as boolean
        return (
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium",
            isActive
              ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
              : "bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700"
          )}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              isActive ? "bg-emerald-400" : "bg-zinc-600"
            )} />
            {isActive ? "Active" : "Inactive"}
          </span>
        )
      },
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => <SortButton column={column} icon={Calendar} label="Created" />,
      cell: ({ getValue }) => {
        const date = getValue() as string
        return (
          <span className="text-zinc-400 text-xs">
            {new Date(date).toLocaleDateString()}
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
        const variation = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center h-8 w-8 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
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

  return (
    <div className="w-full">
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
              Array.from({ length: 3 }).map((_, i) => (
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
                      <Layers className="w-6 h-6 text-zinc-600" />
                    </div>
                    <p className="text-sm font-medium text-zinc-400">No variations found</p>
                    <p className="text-xs text-zinc-600">Create your first variation group to get started</p>
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
