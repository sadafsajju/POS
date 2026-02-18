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
  Shield,
  Mail,
  Calendar,
  MoreHorizontal,
  Users
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { User } from "@/types"

interface AdminStaffTableProps {
  data: User[]
  onEdit: (user: User) => void
  onDelete: (user: User) => void
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

const roleBadgeStyles: Record<string, string> = {
  admin: "bg-red-500/15 text-red-400 ring-red-500/20",
  manager: "bg-violet-500/15 text-violet-400 ring-violet-500/20",
  server: "bg-blue-500/15 text-blue-400 ring-blue-500/20",
  counter: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
  kitchen: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
}

export function AdminStaffTable({
  data,
  onEdit,
  onDelete,
  isLoading = false
}: AdminStaffTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "first_name",
      header: ({ column }) => <SortButton column={column} icon={Users} label="Name" />,
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 ring-1 ring-zinc-700 flex items-center justify-center">
                <span className="text-xs font-semibold text-zinc-300">
                  {user.first_name[0]}{user.last_name[0]}
                </span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-medium text-zinc-200 truncate">
                {user.first_name} {user.last_name}
              </div>
              <div className="text-xs text-zinc-500">@{user.username}</div>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => <SortButton column={column} icon={Mail} label="Email" />,
      cell: ({ getValue }) => {
        const email = getValue() as string
        return <span className="text-sm text-zinc-300">{email}</span>
      },
    },
    {
      accessorKey: "role",
      header: ({ column }) => <SortButton column={column} icon={Shield} label="Role" />,
      cell: ({ getValue }) => {
        const role = getValue() as string
        const styles = roleBadgeStyles[role.toLowerCase()] || "bg-zinc-800 text-zinc-400 ring-zinc-700"
        return (
          <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ring-1",
            styles
          )}>
            {role.toUpperCase()}
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
          <div className="flex items-center gap-2">
            <span className={cn(
              "w-2 h-2 rounded-full",
              isActive ? "bg-emerald-400" : "bg-zinc-600"
            )} />
            <span className={cn(
              "text-xs font-medium",
              isActive ? "text-emerald-400" : "text-zinc-600"
            )}>
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => <SortButton column={column} icon={Calendar} label="Joined" />,
      cell: ({ getValue }) => {
        const date = getValue() as string
        return (
          <span className="text-sm text-zinc-500 tabular-nums">
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
        const user = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center h-8 w-8 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-zinc-900 border-zinc-800 text-zinc-200">
              <DropdownMenuItem
                onClick={() => onEdit(user)}
                className="gap-2 text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit Staff
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                onClick={() => onDelete(user)}
                className="gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Staff
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
                      <Users className="w-6 h-6 text-zinc-600" />
                    </div>
                    <p className="text-sm font-medium text-zinc-400">No staff members found</p>
                    <p className="text-xs text-zinc-600">Try adjusting your search or add a new staff member</p>
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
