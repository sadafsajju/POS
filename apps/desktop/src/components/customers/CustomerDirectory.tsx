import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Users,
  Search,
  Phone,
  Mail,
  ShoppingBag,
  DollarSign,
  Calendar,
  Edit2,
  Plus,
  Loader2,
  User,
  Clock,
  Receipt,
  Package,
  Car,
  AlertCircle
} from 'lucide-react'
import apiClient from '@/api/client'
import { useSettingsStore } from '@pos/core'
import type { Customer, Order } from '@pos/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-500/20 text-blue-400' },
  preparing: { label: 'Preparing', color: 'bg-orange-500/20 text-orange-400' },
  ready: { label: 'Ready', color: 'bg-emerald-500/20 text-emerald-400' },
  served: { label: 'Served', color: 'bg-purple-500/20 text-purple-400' },
  paid: { label: 'Paid', color: 'bg-indigo-500/20 text-indigo-400' },
  completed: { label: 'Completed', color: 'bg-emerald-500/20 text-emerald-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
}

const orderTypeIcons: Record<string, React.ReactNode> = {
  dine_in: <Users className="w-4 h-4" />,
  takeout: <Package className="w-4 h-4" />,
  delivery: <Car className="w-4 h-4" />
}

function formatElapsedTime(startTime: string): string {
  const start = new Date(startTime).getTime()
  const now = Date.now()
  const elapsed = Math.floor((now - start) / 1000 / 60)
  if (elapsed < 60) return `${elapsed}m`
  const hours = Math.floor(elapsed / 60)
  const mins = elapsed % 60
  return `${hours}h ${mins}m`
}

// ── Main Component ──────────────────────────────────────────────────────────

export function CustomerDirectory() {
  const { settings } = useSettingsStore()

  // Customer list state
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  // Selection & detail state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerOrders, setCustomerOrders] = useState<Order[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersTotalPages, setOrdersTotalPages] = useState(1)

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '' })
  const [isSaving, setIsSaving] = useState(false)

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', phone: '', email: '' })
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const formatCurrency = useCallback((amount: number) => {
    const symbol = settings.currencySymbol || '$'
    return `${symbol}${amount.toFixed(2)}`
  }, [settings.currencySymbol])

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // ── Data Fetching ───────────────────────────────────────────────────────

  const fetchCustomers = async () => {
    setIsLoading(true)
    try {
      const response = await apiClient.getCustomers({ page, per_page: pageSize })
      if ((response as any)?.success && Array.isArray((response as any)?.data)) {
        setCustomers((response as any).data)
        if ((response as any).meta) {
          setTotalPages((response as any).meta.total_pages || 1)
          setTotalCount((response as any).meta.total || 0)
        }
      } else {
        setCustomers([])
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error)
      setCustomers([])
    } finally {
      setIsLoading(false)
    }
  }

  const searchCustomersApi = async (query: string) => {
    if (!query || query.length < 2) {
      fetchCustomers()
      return
    }
    setIsLoading(true)
    try {
      const response = await apiClient.searchCustomers(query, 50)
      if ((response as any)?.success && Array.isArray((response as any)?.data)) {
        setCustomers((response as any).data)
        setTotalPages(1)
        setTotalCount((response as any).data.length)
      } else {
        setCustomers([])
      }
    } catch (error) {
      console.error('Failed to search customers:', error)
      setCustomers([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCustomerOrders = async (customerId: string, orderPage = 1) => {
    setIsLoadingOrders(true)
    try {
      const response = await apiClient.getCustomerOrders(customerId, { page: orderPage, per_page: 10 })
      if ((response as any)?.success && Array.isArray((response as any)?.data)) {
        setCustomerOrders((response as any).data)
        if ((response as any).meta) {
          setOrdersTotalPages((response as any).meta.total_pages || 1)
        }
      } else {
        setCustomerOrders([])
      }
    } catch (error) {
      console.error('Failed to fetch customer orders:', error)
      setCustomerOrders([])
    } finally {
      setIsLoadingOrders(false)
    }
  }

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => searchCustomersApi(searchQuery), 300)
      return () => clearTimeout(timer)
    } else {
      fetchCustomers()
    }
  }, [page, searchQuery])

  useEffect(() => {
    if (selectedCustomerId) {
      const customer = customers.find(c => c.id === selectedCustomerId) || null
      setSelectedCustomer(customer)
      setOrdersPage(1)
      fetchCustomerOrders(selectedCustomerId, 1)
    } else {
      setSelectedCustomer(null)
      setCustomerOrders([])
    }
  }, [selectedCustomerId])

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerOrders(selectedCustomerId, ordersPage)
    }
  }, [ordersPage])

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleSelectCustomer = useCallback((customerId: string) => {
    setSelectedCustomerId(customerId)
    setOrdersPage(1)
  }, [])

  const openEditDialog = (customer: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditForm({
      name: customer.name || '',
      phone: customer.phone,
      email: customer.email || ''
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedCustomer) return
    setIsSaving(true)
    try {
      const response = await apiClient.updateCustomer(selectedCustomer.id, {
        name: editForm.name || undefined,
        phone: editForm.phone,
        email: editForm.email || undefined
      })
      if ((response as any)?.success) {
        setEditDialogOpen(false)
        setSuccessMessage('Customer updated successfully')
        setTimeout(() => setSuccessMessage(null), 3000)
        fetchCustomers()
        setSelectedCustomer({
          ...selectedCustomer,
          name: editForm.name || null,
          phone: editForm.phone,
          email: editForm.email || null
        } as Customer)
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to update customer')
      setTimeout(() => setErrorMessage(null), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  const openCreateDialog = () => {
    setCreateForm({ name: '', phone: '', email: '' })
    setCreateError(null)
    setCreateDialogOpen(true)
  }

  const handleCreate = async () => {
    if (!createForm.phone || createForm.phone.length < 10) {
      setCreateError('Please enter a valid phone number')
      return
    }
    setIsCreating(true)
    setCreateError(null)
    try {
      const response = await apiClient.createCustomer({
        phone: createForm.phone,
        name: createForm.name || undefined,
        email: createForm.email || undefined
      })
      if ((response as any)?.success) {
        setCreateDialogOpen(false)
        setSuccessMessage('Customer created successfully')
        setTimeout(() => setSuccessMessage(null), 3000)
        fetchCustomers()
      } else {
        setCreateError((response as any)?.message || 'Failed to create customer')
      }
    } catch (error: any) {
      setCreateError(error?.message || 'Failed to create customer')
    } finally {
      setIsCreating(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 select-none">
      {/* Messages */}
      {(errorMessage || successMessage) && (
        <div className="flex-shrink-0 px-4 pt-3">
          {errorMessage && (
            <div className="p-4 bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg flex items-center gap-3 text-base">
              <AlertCircle className="w-5 h-5" />
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="p-4 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-lg text-base">
              {successMessage}
            </div>
          )}
        </div>
      )}

      {/* Main Content — Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Customer List — Left Panel */}
        <div className="flex-1 overflow-hidden flex flex-col border-r border-zinc-800">
          <CustomerList
            customers={customers}
            isLoading={isLoading}
            searchQuery={searchQuery}
            totalCount={totalCount}
            selectedCustomerId={selectedCustomerId}
            page={page}
            totalPages={totalPages}
            onSelectCustomer={handleSelectCustomer}
            onSearchChange={(q) => { setSearchQuery(q); setPage(1) }}
            onPageChange={setPage}
            onAddCustomer={openCreateDialog}
            formatCurrency={formatCurrency}
          />
        </div>

        {/* Customer Detail — Right Panel */}
        <div className="w-[480px] flex-shrink-0 flex flex-col bg-zinc-900 overflow-hidden">
          <CustomerDetailPanel
            customer={selectedCustomer}
            orders={customerOrders}
            isLoadingOrders={isLoadingOrders}
            ordersPage={ordersPage}
            ordersTotalPages={ordersTotalPages}
            onOrdersPageChange={setOrdersPage}
            onEditCustomer={openEditDialog}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            formatDateTime={formatDateTime}
          />
        </div>
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-xl text-zinc-100">Edit Customer</DialogTitle>
            <DialogDescription className="text-zinc-400">Update customer information</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-phone" className="text-base text-zinc-300">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '') })}
                  className="pl-12 h-12 text-base bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
                  maxLength={15}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-base text-zinc-300">Name</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="pl-12 h-12 text-base bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
                  placeholder="Customer name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email" className="text-base text-zinc-300">Email (optional)</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="pl-12 h-12 text-base bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
                  placeholder="customer@email.com"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3 sm:gap-3">
            <Button variant="outline" className="h-12 text-base px-6 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button className="h-12 text-base px-6 bg-amber-500 text-white hover:bg-amber-400" onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-xl text-zinc-100">Add New Customer</DialogTitle>
            <DialogDescription className="text-zinc-400">Create a new customer record</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-phone" className="text-base text-zinc-300">Phone Number *</Label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                <Input
                  id="create-phone"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value.replace(/\D/g, '') })}
                  className="pl-12 h-12 text-base bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
                  maxLength={15}
                  placeholder="Phone number (required)"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-name" className="text-base text-zinc-300">Name</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                <Input
                  id="create-name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="pl-12 h-12 text-base bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
                  placeholder="Customer name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email" className="text-base text-zinc-300">Email (optional)</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                <Input
                  id="create-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="pl-12 h-12 text-base bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
                  placeholder="customer@email.com"
                />
              </div>
            </div>
            {createError && <p className="text-base text-red-400">{createError}</p>}
          </div>
          <DialogFooter className="gap-3 sm:gap-3">
            <Button variant="outline" className="h-12 text-base px-6 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button className="h-12 text-base px-6 bg-emerald-500 text-white hover:bg-emerald-400" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Creating...</> : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Customer List (Left Panel) ──────────────────────────────────────────────

interface CustomerListProps {
  customers: Customer[]
  isLoading: boolean
  searchQuery: string
  totalCount: number
  selectedCustomerId: string | null
  page: number
  totalPages: number
  onSelectCustomer: (id: string) => void
  onSearchChange: (query: string) => void
  onPageChange: (page: number) => void
  onAddCustomer: () => void
  formatCurrency: (amount: number) => string
}

function CustomerList({
  customers,
  isLoading,
  searchQuery,
  totalCount,
  selectedCustomerId,
  page,
  totalPages,
  onSelectCustomer,
  onSearchChange,
  onPageChange,
  onAddCustomer,
  formatCurrency
}: CustomerListProps) {
  return (
    <>
      {/* Filter Bar */}
      <div className="p-4 border-b border-zinc-800 space-y-3 bg-zinc-900">
        {/* Header row with count + add button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-zinc-400" />
            <span className="text-base font-medium text-zinc-300">{totalCount} customer{totalCount !== 1 ? 's' : ''}</span>
          </div>
          <Button size="lg" className="h-11 text-sm px-5 bg-emerald-500 text-white hover:bg-emerald-400" onClick={onAddCustomer}>
            <Plus className="w-5 h-5 mr-1.5" />
            Add Customer
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <Input
            placeholder="Search name or phone..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-12 h-12 text-base bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
          />
        </div>
      </div>

      {/* Customer Rows */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-10 h-10 animate-spin text-zinc-600" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
            <Users className="w-14 h-14 mb-3 opacity-30" />
            <p className="text-lg font-medium">No customers found</p>
            <p className="text-base text-zinc-600">
              {searchQuery ? 'Try a different search term' : 'Customers will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {customers.map(customer => {
              const isSelected = selectedCustomerId === customer.id

              return (
                <div
                  key={customer.id}
                  className={`px-5 py-4 cursor-pointer transition-colors active:bg-zinc-800 hover:bg-zinc-800/50 ${
                    isSelected ? 'bg-amber-500/10 border-l-4 border-l-amber-500' : 'border-l-4 border-l-transparent'
                  }`}
                  onClick={() => onSelectCustomer(customer.id)}
                >
                  {/* Top row: name + total spent */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-zinc-400" />
                      </div>
                      <span className="font-semibold text-base truncate text-zinc-100">
                        {customer.name || 'No name'}
                      </span>
                      {(customer.total_orders || 0) > 0 && (
                        <Badge className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 border-0">
                          {customer.total_orders} order{(customer.total_orders || 0) !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <span className="font-bold text-base flex-shrink-0 text-zinc-200">
                      {formatCurrency(customer.total_spent || 0)}
                    </span>
                  </div>

                  {/* Bottom row: phone, email, last order */}
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-zinc-500 ml-[52px]">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {customer.phone}
                    </span>

                    {customer.email && (
                      <span className="truncate max-w-[150px]">{customer.email}</span>
                    )}

                    {customer.last_order_at && (
                      <span className="flex items-center gap-1 ml-auto flex-shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        {formatElapsedTime(customer.last_order_at)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !searchQuery && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-900">
          <span className="text-sm text-zinc-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="lg"
              className="h-11 text-sm px-5 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-11 text-sm px-5 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Customer Detail Panel (Right Panel) ─────────────────────────────────────

interface CustomerDetailPanelProps {
  customer: Customer | null
  orders: Order[]
  isLoadingOrders: boolean
  ordersPage: number
  ordersTotalPages: number
  onOrdersPageChange: (page: number) => void
  onEditCustomer: (customer: Customer, e?: React.MouseEvent) => void
  formatCurrency: (amount: number) => string
  formatDate: (dateString: string | null | undefined) => string
  formatDateTime: (dateString: string | null | undefined) => string
}

function CustomerDetailPanel({
  customer,
  orders,
  isLoadingOrders,
  ordersPage,
  ordersTotalPages,
  onOrdersPageChange,
  onEditCustomer,
  formatCurrency,
  formatDate,
  formatDateTime
}: CustomerDetailPanelProps) {
  // No selection — empty state
  if (!customer) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600">
        <div className="text-center p-8">
          <User className="w-20 h-20 mx-auto mb-4 opacity-20" />
          <p className="text-xl font-semibold text-zinc-500">Select a Customer</p>
          <p className="text-base mt-2 text-zinc-600">Tap on a customer to view details</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center">
              <User className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-zinc-100">{customer.name || 'No name'}</h3>
              <div className="flex items-center gap-3 text-sm text-zinc-400 mt-0.5">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4" />
                  {customer.phone}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    {customer.email}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" className="h-11 text-sm px-4 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100" onClick={(e) => onEditCustomer(customer, e)}>
            <Edit2 className="w-4 h-4 mr-1.5" />
            Edit
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-zinc-800">
          <div className="text-center py-2 rounded-lg bg-zinc-800/50">
            <div className="flex items-center justify-center gap-1.5 text-zinc-500 mb-1">
              <ShoppingBag className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider font-medium">Orders</span>
            </div>
            <p className="text-2xl font-bold text-zinc-100">{customer.total_orders || 0}</p>
          </div>
          <div className="text-center py-2 rounded-lg bg-zinc-800/50">
            <div className="flex items-center justify-center gap-1.5 text-zinc-500 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider font-medium">Spent</span>
            </div>
            <p className="text-2xl font-bold text-zinc-200">{formatCurrency(customer.total_spent || 0)}</p>
          </div>
          <div className="text-center py-2 rounded-lg bg-zinc-800/50">
            <div className="flex items-center justify-center gap-1.5 text-zinc-500 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider font-medium">Last</span>
            </div>
            <p className="text-base font-bold text-zinc-200">{formatDate(customer.last_order_at)}</p>
          </div>
        </div>
      </div>

      {/* Scrollable content — Order History */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/80">
          <h4 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Order History
          </h4>
        </div>

        {isLoadingOrders ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-10 h-10 animate-spin text-zinc-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
            <ShoppingBag className="w-14 h-14 mb-3 opacity-20" />
            <p className="text-base font-medium text-zinc-500">No orders yet</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {orders.map(order => {
              const status = statusConfig[order.status] || statusConfig.pending

              return (
                <div key={order.id} className="px-5 py-4 hover:bg-zinc-800/30 transition-colors">
                  {/* Top row: order number, status, amount */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-semibold text-base text-zinc-200">#{order.order_number}</span>
                      <Badge className={`${status.color} text-xs px-2 py-0.5 border-0`}>
                        {status.label}
                      </Badge>
                    </div>
                    <span className="font-bold text-base flex-shrink-0 text-zinc-100">
                      {formatCurrency(order.total_amount || 0)}
                    </span>
                  </div>

                  {/* Bottom row: type, items count, date */}
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      {orderTypeIcons[order.order_type] || <Receipt className="w-4 h-4" />}
                      <span className="capitalize">{order.order_type?.replace('_', '-') || 'N/A'}</span>
                    </span>

                    {(order.items?.length || 0) > 0 && (
                      <span>{order.items?.length} item{(order.items?.length || 0) !== 1 ? 's' : ''}</span>
                    )}

                    <span className="flex items-center gap-1 ml-auto flex-shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDateTime(order.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Orders Pagination */}
      {ordersTotalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800">
          <span className="text-sm text-zinc-500">Page {ordersPage} of {ordersTotalPages}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="lg"
              className="h-11 text-sm px-5 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
              disabled={ordersPage <= 1}
              onClick={() => onOrdersPageChange(ordersPage - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-11 text-sm px-5 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
              disabled={ordersPage >= ordersTotalPages}
              onClick={() => onOrdersPageChange(ordersPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
