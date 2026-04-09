import {
  Edit,
  Trash2,
  Mail,
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

const roleBadgeStyles: Record<string, string> = {
  admin: "bg-red-500/15 text-red-400",
  manager: "bg-violet-500/15 text-violet-400",
  server: "bg-blue-500/15 text-blue-400",
  counter: "bg-emerald-500/15 text-emerald-400",
  kitchen: "bg-amber-500/15 text-amber-400",
}

export function AdminStaffTable({
  data,
  onEdit,
  onDelete,
  isLoading = false
}: AdminStaffTableProps) {
  return (
    <div className="w-full">
      {isLoading ? (
        <div className="grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[64px] rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center">
            <Users className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-400">No staff members found</p>
          <p className="text-xs text-zinc-600">Try adjusting your search or add a new staff member</p>
        </div>
      ) : (
        <div className="grid gap-1.5">
          {data.map((user) => {
            const isActive = user.is_active
            const role = user.role || ''
            const roleStyles = roleBadgeStyles[role.toLowerCase()] || "bg-zinc-800 text-zinc-400"

            return (
              <div
                key={user.id}
                className={cn(
                  "group relative flex items-center gap-4 pl-4 pr-3 py-3 rounded-xl border transition-all duration-150",
                  isActive
                    ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-800/70 hover:border-zinc-700"
                    : "bg-zinc-900/60 border-zinc-800/60 hover:bg-zinc-800/40"
                )}
              >
                {/* === IDENTITY ZONE: Avatar + Name === */}
                <div className={cn(
                  "flex items-center gap-3.5 min-w-0 flex-1",
                  !isActive && "opacity-50"
                )}>
                  {/* Avatar */}
                  <div className="flex-shrink-0 h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center">
                    <span className="text-xs font-medium text-zinc-400 uppercase">
                      {user.first_name?.[0]}{user.last_name?.[0]}
                    </span>
                  </div>

                  {/* Name + username + email */}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[15px] text-zinc-100 truncate leading-tight">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-zinc-500">@{user.username}</span>
                      {user.email && (
                        <>
                          <span className="text-zinc-700">&#183;</span>
                          <span className="flex items-center gap-1 text-xs text-zinc-600 truncate max-w-[200px]">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            {user.email}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* === METADATA ZONE: Role + Status === */}
                <div className={cn(
                  "flex-shrink-0 flex items-center gap-2",
                  !isActive && "opacity-50"
                )}>
                  {/* Role badge */}
                  <span className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide",
                    roleStyles
                  )}>
                    {role.toUpperCase()}
                  </span>

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

                  {/* Joined date */}
                  <span className="hidden sm:block text-zinc-600 text-xs tabular-nums min-w-[72px] text-right">
                    {new Date(user.created_at).toLocaleDateString(undefined, {
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
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
