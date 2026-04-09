import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings,
  Building2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import apiClient from '@/api/client'
import { toastHelpers } from '@/lib/toast-helpers'
import { TableForm } from '@/components/forms/TableForm'
import { PaginationControlsComponent } from '@/components/ui/pagination-controls'
import { usePagination } from '@/hooks/usePagination'
import { TableGridSkeleton, SearchingSkeleton, FilteringSkeleton } from '@/components/ui/skeletons'
import { InlineLoading } from '@/components/ui/loading-spinner'
import { useRequirePin } from '@pos/core'
import type { DiningTable, Location } from '@/types'

const TABLES_LOCATION_KEY = 'pos-tables-selected-location'

export function AdminTableManagement() {
  const [tableDialogOpen, setTableDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => {
    return localStorage.getItem(TABLES_LOCATION_KEY) || ''
  })
  const [isSearching, setIsSearching] = useState(false)
  const [isFiltering, setIsFiltering] = useState(false)

  const queryClient = useQueryClient()

  // Fetch locations for filter
  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => apiClient.getLocations(),
  })
  const locations: Location[] = Array.isArray(locationsData)
    ? locationsData
    : Array.isArray((locationsData as any)?.data)
      ? (locationsData as any).data
      : []

  // Sort locations by created_at (oldest first) and set default
  const sortedLocations = [...locations].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  // Set default location to oldest if no selection yet
  useEffect(() => {
    if (sortedLocations.length > 0 && !selectedLocationId) {
      const defaultId = sortedLocations[0].id
      setSelectedLocationId(defaultId)
      localStorage.setItem(TABLES_LOCATION_KEY, defaultId)
    }
    // If saved location no longer exists, reset to oldest
    if (selectedLocationId && sortedLocations.length > 0 && !sortedLocations.find(l => l.id === selectedLocationId)) {
      const defaultId = sortedLocations[0].id
      setSelectedLocationId(defaultId)
      localStorage.setItem(TABLES_LOCATION_KEY, defaultId)
    }
  }, [sortedLocations.length])

  const handleLocationChange = (locationId: string) => {
    setSelectedLocationId(locationId)
    localStorage.setItem(TABLES_LOCATION_KEY, locationId)
    pagination.goToFirstPage()
  }


  // Pagination hook
  const pagination = usePagination({ 
    initialPage: 1, 
    initialPageSize: 12,
    total: 0 
  })

  // Debounce search term
  useEffect(() => {
    if (searchTerm !== debouncedSearch) {
      setIsSearching(true)
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      pagination.goToFirstPage()
      setIsSearching(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm, debouncedSearch])

  // Reset pagination when status filter changes
  useEffect(() => {
    if (filterStatus !== 'all') {
      setIsFiltering(true)
      setTimeout(() => setIsFiltering(false), 300)
    }
    pagination.goToFirstPage()
  }, [filterStatus])

  // Fetch tables with pagination (scoped to selected location)
  const { data: tablesData, isLoading, isFetching } = useQuery({
    queryKey: ['admin-tables', pagination.page, pagination.pageSize, debouncedSearch, filterStatus, selectedLocationId],
    queryFn: () => apiClient.getAdminTables({
      page: pagination.page,
      per_page: pagination.pageSize,
      search: debouncedSearch || undefined,
      status: filterStatus !== 'all' ? filterStatus : undefined,
      location_id: selectedLocationId || undefined,
    }),
    enabled: !!selectedLocationId,
  })

  // Also fetch summary stats (all tables for stats calculation, scoped to location)
  const { data: allTablesData } = useQuery({
    queryKey: ['tables-summary', selectedLocationId],
    queryFn: () => apiClient.getAdminTables({
      page: 1,
      per_page: 100,
      location_id: selectedLocationId || undefined,
    }).then(res => (res as any)?.data || res),
    enabled: !!selectedLocationId,
  })

  // Ensure allTables is always an array (API may return null when empty)
  const allTables = Array.isArray(allTablesData) ? allTablesData : []

  // Extract data and pagination info
  const tables = Array.isArray(tablesData) ? tablesData : (tablesData as any)?.data || []
  const paginationInfo = (tablesData as any)?.meta || { total: 0 }


  // Delete table mutation
  const deleteTableMutation = useMutation({
    mutationFn: ({ id }: { id: string, tableNumber: string }) => apiClient.deleteTable(id),
    onSuccess: (_, { tableNumber }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-tables'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['tables-summary'] })
      toastHelpers.apiSuccess('Delete', `Table ${tableNumber}`)
    },
    onError: (error: any) => {
      toastHelpers.apiError('Delete table', error)
    }
  })

  // Form handlers
  const closeTableDialog = () => {
    setTableDialogOpen(false)
    setEditingTable(null)
  }

  const requirePin = useRequirePin()

  // Delete handler
  const handleDeleteTable = useCallback(async (table: DiningTable) => {
    // Note: DiningTable type may need to be updated to include status field
    const tableStatus = (table as any).status
    if (tableStatus === 'occupied') {
      toastHelpers.warning(
        'Cannot Delete Table',
        `Table ${table.table_number} is currently occupied. Please clear the table first.`
      )
      return
    }

    const verified = await requirePin('Delete Table', `Enter PIN to delete Table ${table.table_number}`)
    if (verified) {
      deleteTableMutation.mutate({
        id: table.id.toString(),
        tableNumber: table.table_number
      })
    }
  }, [requirePin, deleteTableMutation])

  // Data is already filtered on the server side
  const filteredTables = tables

  // Get status badge styling (dark theme - matching KDS)
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        }
      case 'occupied':
        return {
          icon: <Users className="h-3 w-3" />,
          className: 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        }
      case 'reserved':
        return {
          icon: <Clock className="h-3 w-3" />,
          className: 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
        }
      case 'maintenance':
        return {
          icon: <AlertCircle className="h-3 w-3" />,
          className: 'bg-red-500/20 text-red-400 border border-red-500/30'
        }
      default:
        return {
          icon: <Settings className="h-3 w-3" />,
          className: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
        }
    }
  }

  // Calculate stats from all tables (for accurate totals)
  const stats = {
    total: allTables.length,
    available: allTables.filter(t => (t as any).status === 'available').length,
    occupied: allTables.filter(t => (t as any).status === 'occupied').length,
    reserved: allTables.filter(t => (t as any).status === 'reserved').length,
    maintenance: allTables.filter(t => (t as any).status === 'maintenance').length,
  }

  // Status accent colors for card left border
  const getStatusAccent = (status: string) => {
    switch (status) {
      case 'available': return 'border-l-emerald-500'
      case 'occupied': return 'border-l-amber-500'
      case 'reserved': return 'border-l-sky-500'
      case 'maintenance': return 'border-l-red-500'
      default: return 'border-l-zinc-500'
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100 select-none">
      <div className="w-full flex flex-col flex-1 min-h-0">

      {/* Header Strip — matching KDS */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-zinc-300">Tables</span>

          {/* Location Filter Dropdown */}
          {sortedLocations.length > 1 && (
            <>
              <div className="h-5 w-px bg-zinc-700" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600 transition-colors">
                    <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="font-medium">{sortedLocations.find(l => l.id === selectedLocationId)?.name || 'Select location'}</span>
                    <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-zinc-900 border-zinc-700 min-w-[180px]">
                  {sortedLocations.filter(l => l.is_active).map((loc) => (
                    <DropdownMenuItem
                      key={loc.id}
                      onClick={() => handleLocationChange(loc.id)}
                      className={cn(
                        'gap-2 text-sm',
                        selectedLocationId === loc.id
                          ? 'text-emerald-400 font-medium bg-emerald-500/10'
                          : 'text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100'
                      )}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      {loc.name}
                      {selectedLocationId === loc.id && (
                        <CheckCircle className="h-3.5 w-3.5 ml-auto text-emerald-400" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <div className="h-5 w-px bg-zinc-700" />
          <StatPill color="bg-zinc-400" count={stats.total} label="Total" />
          <StatPill color="bg-emerald-500" count={stats.available} label="Open" />
          <StatPill color="bg-amber-500" count={stats.occupied} label="Busy" />
          {stats.reserved > 0 && <StatPill color="bg-sky-500" count={stats.reserved} label="Rsvd" />}
          {stats.maintenance > 0 && <StatPill color="bg-red-500" count={stats.maintenance} label="Maint" />}
        </div>
        <button
          onClick={() => {
            setEditingTable(null)
            setTableDialogOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Table
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto px-6 pb-6 space-y-5 pt-5">

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            placeholder="Search tables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-colors"
          />
          {isSearching && (
            <div className="absolute right-2 top-2.5">
              <InlineLoading size="sm" />
            </div>
          )}
        </div>
        <div className="flex gap-1.5">
          {isFiltering && (
            <div className="flex items-center mr-2">
              <FilteringSkeleton />
            </div>
          )}
          {(['all', 'available', 'occupied', 'reserved', 'maintenance'] as const).map((status) => {
            const count = status === 'all' ? stats.total : stats[status]
            const isActive = filterStatus === status
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Tables Grid */}
      {isLoading ? (
        <TableGridSkeleton count={pagination.pageSize} />
      ) : isSearching && searchTerm ? (
        <SearchingSkeleton />
      ) : filteredTables.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Search className="mx-auto h-10 w-10 text-zinc-700 mb-3" />
            <p className="text-sm font-semibold text-zinc-500">No tables found</p>
            <p className="text-xs text-zinc-600 mt-1">
              {searchTerm || filterStatus !== 'all'
                ? 'No tables match your current filters.'
                : 'Get started by adding your first table.'}
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                onClick={() => { setEditingTable(null); setTableDialogOpen(true) }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Table
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredTables.map((table: any) => {
            const tableStatus = table.status || (table.is_occupied ? 'occupied' : 'available')
            const statusBadge = getStatusBadge(tableStatus)
            return (
              <div
                key={table.id}
                className="group rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base font-black tracking-tight text-zinc-100 shrink-0">{table.table_number}</span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${statusBadge.className}`}>
                      {statusBadge.icon}
                      {tableStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-zinc-500 tabular-nums">{table.seating_capacity}<Users className="inline h-3 w-3 ml-0.5 -mt-px" /></span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded-md text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-zinc-200 hover:bg-zinc-800 transition-all">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 min-w-[120px]">
                        <DropdownMenuItem
                          onClick={() => { setEditingTable(table); setTableDialogOpen(true) }}
                          className="gap-2 text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 text-xs"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteTable(table)}
                          disabled={deleteTableMutation.isPending || table.status === 'occupied'}
                          className="gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-300 text-xs"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {(table.location_name || table.floor || table.location) && (
                  <div className="flex items-center gap-1.5 px-3 pb-2.5 text-[11px] text-zinc-500 truncate">
                    {table.location_name && <span className="text-zinc-400 font-medium">{table.location_name}</span>}
                    {table.location_name && (table.floor || table.location) && <span className="text-zinc-700">·</span>}
                    {table.floor && <span>{table.floor}</span>}
                    {table.floor && table.location && <span className="text-zinc-700">·</span>}
                    {table.location && <span className="truncate">{table.location}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {filteredTables.length > 0 && (
        <div className="mt-6 space-y-4">
          {isFetching && !isLoading && (
            <div className="flex justify-center">
              <InlineLoading text="Updating tables..." />
            </div>
          )}
          <PaginationControlsComponent
            pagination={pagination}
            total={paginationInfo.total || tables.length}
            pageSizeOptions={[6, 12, 24, 48]}
          />
        </div>
      )}
      </div>
      </div>

      {/* Create / Edit Table Dialog */}
      <Dialog open={tableDialogOpen} onOpenChange={(v) => { if (!v) closeTableDialog() }}>
        <DialogContent className="dark flex flex-col !max-w-none !w-screen !h-screen !rounded-none p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-zinc-800 flex-shrink-0 bg-zinc-900">
            <DialogTitle className="text-zinc-100">
              {editingTable ? 'Edit Table' : 'Create New Table'}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              {editingTable
                ? `Editing Table ${editingTable.table_number}`
                : 'Add a new table to your restaurant'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <TableForm
              key={editingTable ? `edit-${editingTable.id}` : 'create'}
              table={editingTable || undefined}
              mode={editingTable ? 'edit' : 'create'}
              onSuccess={closeTableDialog}
              onCancel={closeTableDialog}
              hideChrome
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── StatPill (matching KDS Pill style) ────────────────────────────────────────

function StatPill({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full', color)} />
      <span className="text-sm font-bold text-zinc-200 tabular-nums">{count}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  )
}
