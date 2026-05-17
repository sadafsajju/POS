import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, queryKeys, staleTime } from '@pos/api-client'
import type { DiscountItem } from '@pos/api-client'
import {
  Percent,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toastHelpers } from '@/lib/toast-helpers'

export const Route = createFileRoute('/admin/more/discounts')({
  component: DiscountsSettingsPage,
})

const inputClass =
  'w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors'

function DiscountsSettingsPage() {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newPercent, setNewPercent] = useState<string>('')

  const { data: res, isLoading } = useQuery({
    queryKey: queryKeys.discounts.admin,
    queryFn: () => adminApi.getDiscounts(),
    staleTime: staleTime.discounts,
  })

  const discounts: DiscountItem[] = Array.isArray(res?.data) ? res.data : []

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.discounts.all })

  const createMutation = useMutation({
    mutationFn: (input: { name: string; percent: number }) =>
      adminApi.createDiscount(input),
    onSuccess: (r: any) => {
      if (!r?.success) {
        toastHelpers.error('Failed to add discount', r?.message || '')
        return
      }
      setNewName('')
      setNewPercent('')
      invalidate()
      toastHelpers.success('Discount added')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) =>
      adminApi.updateDiscount(id, patch),
    onSuccess: () => invalidate(),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => adminApi.toggleDiscount(id),
    onSuccess: () => invalidate(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteDiscount(id),
    onSuccess: () => invalidate(),
  })

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; display_order: number }[]) =>
      adminApi.reorderDiscounts(items),
    onSuccess: () => invalidate(),
  })

  const handleAdd = () => {
    const trimmedName = newName.trim()
    const pct = parseFloat(newPercent)
    if (!trimmedName) {
      toastHelpers.error('Name required', 'Give the discount a label like “Staff 20%”.')
      return
    }
    if (Number.isNaN(pct) || pct <= 0 || pct > 100) {
      toastHelpers.error('Invalid percent', 'Pick a value between 0 and 100.')
      return
    }
    createMutation.mutate({ name: trimmedName, percent: pct })
  }

  const move = (index: number, direction: 'up' | 'down') => {
    const swap = direction === 'up' ? index - 1 : index + 1
    if (swap < 0 || swap >= discounts.length) return
    const reordered = discounts.map((d, i) => {
      if (i === index) return { id: d.id, display_order: swap }
      if (i === swap) return { id: d.id, display_order: index }
      return { id: d.id, display_order: i }
    })
    reorderMutation.mutate(reordered)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-800 rounded-lg text-zinc-300">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">Discounts</h2>
            <p className="text-sm text-zinc-500">
              Named percentage discounts the cashier picks at the payment step.
            </p>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Add row */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3">Add a discount</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3">
            <input
              className={inputClass}
              placeholder="Name (e.g. Staff, NHS, Senior)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <div className="relative">
              <input
                className={inputClass + ' pr-8'}
                placeholder="0"
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={newPercent}
                onChange={(e) => setNewPercent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
            </div>
            <button
              onClick={handleAdd}
              disabled={createMutation.isPending}
              className="h-10 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium text-sm flex items-center gap-2"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-bold">
              {discounts.length} discount{discounts.length === 1 ? '' : 's'} · drag to reorder
            </span>
          </div>

          {isLoading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : discounts.length === 0 ? (
            <div className="p-10 text-center">
              <Percent className="w-10 h-10 mx-auto text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">No discounts yet.</p>
              <p className="text-xs text-zinc-600 mt-1">
                Add one above to make it available at the payment step.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {discounts.map((discount, idx) => (
                <DiscountRow
                  key={discount.id}
                  discount={discount}
                  index={idx}
                  total={discounts.length}
                  onMoveUp={() => move(idx, 'up')}
                  onMoveDown={() => move(idx, 'down')}
                  onToggle={() => toggleMutation.mutate(discount.id)}
                  onUpdate={(patch) =>
                    updateMutation.mutate({ id: discount.id, patch })
                  }
                  onDelete={() => deleteMutation.mutate(discount.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

interface DiscountRowProps {
  discount: DiscountItem
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
  onToggle: () => void
  onUpdate: (patch: { name?: string; percent?: number }) => void
  onDelete: () => void
}

function DiscountRow({
  discount,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onToggle,
  onUpdate,
  onDelete,
}: DiscountRowProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(discount.name)
  const [percent, setPercent] = useState(String(discount.percent))

  const commit = () => {
    const trimmedName = name.trim()
    const pct = parseFloat(percent)
    const patch: { name?: string; percent?: number } = {}
    if (trimmedName && trimmedName !== discount.name) patch.name = trimmedName
    if (!Number.isNaN(pct) && pct >= 0 && pct <= 100 && pct !== discount.percent) patch.percent = pct
    if (Object.keys(patch).length > 0) onUpdate(patch)
    setEditing(false)
  }

  return (
    <li className={cn('flex items-center gap-3 px-4 py-3', !discount.is_active && 'opacity-50')}>
      {/* Drag handle / reorder buttons */}
      <div className="flex flex-col flex-shrink-0">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
      <GripVertical className="w-4 h-4 text-zinc-600 flex-shrink-0" />

      {/* Body */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <input
              autoFocus
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
            />
            <div className="relative">
              <input
                className={inputClass + ' pr-8'}
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commit()}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="w-full text-left"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-zinc-100 truncate">{discount.name}</span>
              <span className="text-sm text-emerald-400 font-mono">{discount.percent}% off</span>
            </div>
            <span className="text-xs text-zinc-600">Click to edit</span>
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {editing && (
          <button
            onClick={commit}
            className="h-8 px-3 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium"
          >
            Save
          </button>
        )}
        <button
          onClick={onToggle}
          title={discount.is_active ? 'Disable' : 'Enable'}
          className={cn(
            'h-9 w-9 rounded-md flex items-center justify-center',
            discount.is_active
              ? 'text-emerald-400 hover:bg-emerald-500/10'
              : 'text-zinc-500 hover:bg-zinc-800',
          )}
        >
          {discount.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Delete “${discount.name}”?`)) onDelete()
          }}
          title="Delete"
          className="h-9 w-9 rounded-md flex items-center justify-center text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  )
}
