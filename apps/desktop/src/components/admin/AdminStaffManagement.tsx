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
  UserPlus,
  Search,
  RefreshCw,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import apiClient from '@/api/client'
import { toastHelpers } from '@/lib/toast-helpers'
import { UserForm } from '@/components/forms/UserForm'
import { AdminStaffTable } from '@/components/admin/AdminStaffTable'
import { PaginationControlsComponent } from '@/components/ui/pagination-controls'
import { usePagination } from '@/hooks/usePagination'
import { useRequirePin } from '@pos/core'
import type { User } from '@/types'

export function AdminStaffManagement() {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // User dialog state
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [userDialogMode, setUserDialogMode] = useState<'create' | 'edit'>('create')
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const queryClient = useQueryClient()

  // Pagination hook
  const pagination = usePagination({
    initialPage: 1,
    initialPageSize: 10,
    total: 0
  })

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      pagination.goToFirstPage()
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch users with pagination
  const { data: usersData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['users', pagination.page, pagination.pageSize, debouncedSearch],
    queryFn: () => apiClient.getUsers({
      page: pagination.page,
      per_page: pagination.pageSize,
      search: debouncedSearch || undefined
    })
  })

  // Extract data and pagination info
  const users = Array.isArray(usersData) ? usersData : (usersData as any)?.data || []
  const paginationInfo = (usersData as any)?.meta || { total: 0 }

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: ({ id }: { id: string, username: string }) => apiClient.deleteUser(id),
    onSuccess: (_, { username: deletedUsername }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toastHelpers.userDeleted(deletedUsername)
    },
    onError: (error: any) => {
      toastHelpers.apiError('Delete user', error)
    }
  })

  const requirePin = useRequirePin()

  const handleDeleteUser = useCallback(async (user: User) => {
    const displayName = `${user.first_name} ${user.last_name}`
    const verified = await requirePin('Delete User', `Enter PIN to delete ${displayName}`)
    if (verified) {
      deleteUserMutation.mutate({
        id: user.id.toString(),
        username: displayName
      })
    }
  }, [requirePin, deleteUserMutation])

  // User dialog handlers
  const handleAddUser = () => {
    setEditingUser(null)
    setUserDialogMode('create')
    setUserDialogOpen(true)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setUserDialogMode('edit')
    setUserDialogOpen(true)
  }

  const closeUserDialog = () => {
    setUserDialogOpen(false)
    setEditingUser(null)
    setUserDialogMode('create')
  }

  const totalUsers = paginationInfo.total || users.length
  const activeUsers = Array.isArray(users) ? users.filter((u: User) => u.is_active).length : 0
  const inactiveUsers = Array.isArray(users) ? users.filter((u: User) => !u.is_active).length : 0

  return (
    <div className="h-full flex flex-col overflow-hidden select-none">

      {/* ── Header Strip ─────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-zinc-300">STAFF</span>
          <div className="h-5 w-px bg-zinc-700" />
          <Pill color="bg-blue-500" count={totalUsers} label="Total" />
          <Pill color="bg-emerald-500" count={activeUsers} label="Active" />
          <Pill color="bg-zinc-500" count={inactiveUsers} label="Inactive" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-md bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </button>
          <button
            onClick={handleAddUser}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Add Staff
          </button>
        </div>
      </header>

      {/* ── Search + Add ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 bg-zinc-900/50 border-b border-zinc-800/60">
        <div className="flex items-center gap-2 text-zinc-500">
          <Users className="h-4 w-4" />
          <span className="text-sm font-medium text-zinc-400">All Staff</span>
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search staff by name, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-zinc-800 border border-zinc-700/50 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600 transition-colors"
          />
        </div>

      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-4">
          <AdminStaffTable
            data={users}
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
            isLoading={isLoading}
          />

          {users.length > 0 && (
            <PaginationControlsComponent
              pagination={pagination}
              total={totalUsers}
            />
          )}
        </div>
      </div>

      {/* User Create/Edit Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={(open) => { if (!open) closeUserDialog() }}>
        <DialogContent className="dark flex flex-col !max-w-none !w-screen !h-screen !rounded-none p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-zinc-800 flex-shrink-0 bg-zinc-900">
            <DialogTitle className="text-zinc-100">
              {userDialogMode === 'edit' ? 'Edit Staff Member' : 'Add New Staff Member'}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              {userDialogMode === 'edit'
                ? `Editing "${editingUser?.first_name} ${editingUser?.last_name}"`
                : 'Add a new staff member to your team'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <UserForm
              key={editingUser ? `edit-${editingUser.id}` : 'create'}
              user={editingUser || undefined}
              mode={userDialogMode}
              onSuccess={closeUserDialog}
              onCancel={closeUserDialog}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Pill (matches KDS/Menu style) ────────────────────────────────────────────

function Pill({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full', color)} />
      <span className="text-sm font-bold text-zinc-200 tabular-nums">{count}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  )
}
