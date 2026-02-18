import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toastHelpers } from '@/lib/toast-helpers'
import apiClient from '@/api/client'
import type { ProductOptionGroup, CreateOptionGroupRequest, CreateOptionItemRequest } from '@/types'
import { cn } from '@/lib/utils'
import { Plus, X, Check } from 'lucide-react'

interface OptionGroupsEditorProps {
  productId?: string
  draftGroups?: CreateOptionGroupRequest[]
  onDraftGroupsChange?: (groups: CreateOptionGroupRequest[]) => void
}

const defaultItem: CreateOptionItemRequest = {
  name: '',
  price_adjustment: 0,
  is_default: false,
  sort_order: 0,
}

const emptyGroup: CreateOptionGroupRequest = {
  name: '',
  selection_type: 'single',
  is_required: false,
  min_selections: 0,
  max_selections: 0,
  sort_order: 0,
  items: [{ ...defaultItem, sort_order: 1 }],
}

/** Dialog for adding a single option item to an existing API group */
interface AddItemDialog {
  groupId: string
  groupName: string
}

export function OptionGroupsEditor({ productId, draftGroups, onDraftGroupsChange }: OptionGroupsEditorProps) {
  const queryClient = useQueryClient()
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false)
  const [newGroup, setNewGroup] = useState<CreateOptionGroupRequest>({ ...emptyGroup })
  const [addItemDialog, setAddItemDialog] = useState<AddItemDialog | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')

  const isDraftMode = !productId

  // Fetch existing option groups (only when productId exists)
  const { data: apiGroups = [], isLoading } = useQuery({
    queryKey: ['option-groups', productId],
    queryFn: async () => {
      const res = await apiClient.getOptionGroups(productId!)
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: !!productId,
  })

  const invalidateGroups = () => {
    queryClient.invalidateQueries({ queryKey: ['option-groups', productId] })
  }

  // Mutations
  const createGroupMutation = useMutation({
    mutationFn: (data: CreateOptionGroupRequest) => apiClient.createOptionGroup(productId!, data),
    onSuccess: () => {
      invalidateGroups()
      setShowNewGroupDialog(false)
      resetNewGroup()
      toastHelpers.success('Variation created')
    },
    onError: (err) => toastHelpers.apiError('Create variation', err),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => apiClient.deleteOptionGroup(productId!, groupId),
    onSuccess: () => {
      invalidateGroups()
      toastHelpers.success('Variation deleted')
    },
    onError: (err) => toastHelpers.apiError('Delete variation', err),
  })

  const createItemMutation = useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: CreateOptionItemRequest }) =>
      apiClient.createOptionItem(groupId, data),
    onSuccess: () => {
      invalidateGroups()
      toastHelpers.success('Option added')
      setNewItemName('')
      setNewItemPrice('')
    },
    onError: (err) => toastHelpers.apiError('Add option', err),
  })

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => apiClient.deleteOptionItem(itemId),
    onSuccess: () => invalidateGroups(),
    onError: (err) => toastHelpers.apiError('Delete option', err),
  })

  const resetNewGroup = () => {
    setNewGroup({ ...emptyGroup, items: [{ ...defaultItem, sort_order: 1 }] })
  }

  const openNewGroupDialog = () => {
    resetNewGroup()
    setShowNewGroupDialog(true)
  }

  // --- New group form handlers ---
  const updateNewGroupItem = (index: number, field: string, value: unknown) => {
    const items = [...newGroup.items]
    items[index] = { ...items[index], [field]: value }
    setNewGroup({ ...newGroup, items })
  }

  const addNewGroupItem = () => {
    setNewGroup({
      ...newGroup,
      items: [...newGroup.items, { ...defaultItem, sort_order: newGroup.items.length + 1 }],
    })
  }

  const removeNewGroupItem = (index: number) => {
    if (newGroup.items.length <= 1) return
    setNewGroup({
      ...newGroup,
      items: newGroup.items.filter((_, i) => i !== index),
    })
  }

  const handleSaveNewGroup = () => {
    if (!newGroup.name.trim()) return
    const validItems = newGroup.items.filter(i => i.name.trim())
    if (validItems.length === 0) return

    const groupData: CreateOptionGroupRequest = {
      ...newGroup,
      items: validItems.map((item, i) => ({ ...item, sort_order: i + 1 })),
    }

    if (isDraftMode && onDraftGroupsChange && draftGroups) {
      onDraftGroupsChange([...draftGroups, groupData])
      setShowNewGroupDialog(false)
      resetNewGroup()
    } else {
      createGroupMutation.mutate(groupData)
    }
  }

  const handleDeleteDraftGroup = (index: number) => {
    if (onDraftGroupsChange && draftGroups) {
      onDraftGroupsChange(draftGroups.filter((_, i) => i !== index))
    }
  }

  const handleAddItem = () => {
    if (!addItemDialog || !newItemName.trim()) return
    const priceAdj = newItemPrice.trim() !== '' ? parseFloat(newItemPrice) : 0
    createItemMutation.mutate({
      groupId: addItemDialog.groupId,
      data: {
        name: newItemName.trim(),
        price_adjustment: isNaN(priceAdj) ? 0 : priceAdj,
        is_default: false,
        sort_order: 0,
      },
    })
  }

  const groupCount = isDraftMode ? (draftGroups?.length || 0) : apiGroups.length

  if (!isDraftMode && isLoading) {
    return <div className="text-sm text-zinc-500 py-4">Loading variations...</div>
  }

  // Render a group card (shared between draft and API modes)
  const renderGroupCard = (
    key: string,
    name: string,
    selectionType: string,
    isRequired: boolean,
    items: { id?: string; name: string; priceAdjustment: number; isDefault?: boolean }[],
    onDelete: () => void,
    onDeleteItem?: (itemId: string) => void,
    onOpenAddItem?: () => void,
  ) => (
    <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-800/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{name}</span>
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium leading-none",
            selectionType === 'single'
              ? "bg-zinc-700 text-zinc-300"
              : "bg-violet-500/10 text-violet-400"
          )}>
            {selectionType === 'single' ? 'Pick one' : 'Pick many'}
          </span>
          {isRequired && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 leading-none">Required</span>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Items as chips */}
      <div className="px-3 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {items.map((item, idx) => (
            <span
              key={item.id || idx}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-zinc-700/50 text-zinc-300 border border-zinc-700"
            >
              {item.name}
              {item.priceAdjustment !== 0 && (
                <span className={cn(
                  "font-medium",
                  item.priceAdjustment > 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {item.priceAdjustment > 0 ? '+' : ''}{item.priceAdjustment.toFixed(2)}
                </span>
              )}
              {item.isDefault && (
                <span className="text-[9px] text-zinc-500 font-medium">default</span>
              )}
              {onDeleteItem && item.id ? (
                <button
                  type="button"
                  onClick={() => onDeleteItem(item.id!)}
                  className="ml-0.5 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}
          {onOpenAddItem && (
            <button
              type="button"
              onClick={onOpenAddItem}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-500 border border-dashed border-zinc-700 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="space-y-3">
        {/* Draft mode groups */}
        {isDraftMode && draftGroups?.map((group, index) => {
          const items = group.items.filter(i => i.name.trim()).map((item, i) => ({
            id: undefined as string | undefined,
            name: item.name,
            priceAdjustment: item.price_adjustment,
            isDefault: item.is_default,
          }))

          return renderGroupCard(
            `draft-${index}`,
            group.name,
            group.selection_type,
            group.is_required,
            items,
            () => handleDeleteDraftGroup(index),
          )
        })}

        {/* API mode groups */}
        {!isDraftMode && apiGroups.map((group: ProductOptionGroup) => {
          const items = (group.items || []).map(item => ({
            id: item.id,
            name: item.name,
            priceAdjustment: item.price_adjustment,
            isDefault: item.is_default,
          }))

          return renderGroupCard(
            group.id,
            group.name,
            group.selection_type,
            group.is_required,
            items,
            () => deleteGroupMutation.mutate(group.id),
            (itemId) => deleteItemMutation.mutate(itemId),
            () => setAddItemDialog({ groupId: group.id, groupName: group.name }),
          )
        })}

        {/* Add variant button */}
        <button
          type="button"
          onClick={openNewGroupDialog}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs text-zinc-500 border border-dashed border-zinc-700 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Variation
        </button>

        {groupCount === 0 && (
          <p className="text-xs text-zinc-500 text-center py-1">
            Add variations like "Size" or "Toppings" to make this product configurable.
          </p>
        )}
      </div>

      {/* New variant group dialog */}
      <Dialog open={showNewGroupDialog} onOpenChange={(open) => { if (!open) setShowNewGroupDialog(false) }}>
        <DialogContent className="max-w-md bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">New Variation</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Create a variation group like "Size" or "Toppings".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Group name */}
            <input
              autoFocus
              className="w-full h-9 text-sm rounded-md bg-zinc-800 border border-zinc-700 px-3 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
              placeholder='Variation name (e.g. Size, Crust Type)'
              value={newGroup.name}
              onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
            />

            {/* Settings row */}
            <div className="flex items-center gap-4">
              <Select
                value={newGroup.selection_type}
                onValueChange={val => setNewGroup({ ...newGroup, selection_type: val as 'single' | 'multiple' })}
              >
                <SelectTrigger className="h-8 text-xs w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Pick one</SelectItem>
                  <SelectItem value="multiple">Pick many</SelectItem>
                </SelectContent>
              </Select>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={newGroup.is_required}
                  onCheckedChange={(checked) => setNewGroup({ ...newGroup, is_required: checked === true })}
                />
                <span className="text-xs text-zinc-400">Required</span>
              </label>

              {newGroup.selection_type === 'multiple' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500">Max:</span>
                  <input
                    type="number"
                    className="h-8 w-16 text-xs rounded-md bg-zinc-800 border border-zinc-700 px-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                    value={newGroup.max_selections}
                    onChange={e => setNewGroup({ ...newGroup, max_selections: parseInt(e.target.value) || 0 })}
                    min={0}
                    placeholder="0"
                  />
                </div>
              )}
            </div>

            {/* Options */}
            <div className="space-y-2">
              <span className="text-xs text-zinc-400">Options</span>
              {newGroup.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="h-8 text-sm flex-1 rounded-md bg-zinc-800 border border-zinc-700 px-3 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
                    placeholder="Option name"
                    value={item.name}
                    onChange={e => updateNewGroupItem(i, 'name', e.target.value)}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-500">$</span>
                    <input
                      type="number"
                      className="h-8 w-20 text-sm rounded-md bg-zinc-800 border border-zinc-700 px-2 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
                      placeholder="0"
                      value={item.price_adjustment || ''}
                      onChange={e => updateNewGroupItem(i, 'price_adjustment', parseFloat(e.target.value) || 0)}
                      step="0.01"
                    />
                  </div>
                  <button
                    type="button"
                    className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-30"
                    onClick={() => removeNewGroupItem(i)}
                    disabled={newGroup.items.length <= 1}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                onClick={addNewGroupItem}
              >
                <Plus className="h-3 w-3" />
                Add option
              </button>
            </div>

            {/* Save */}
            <button
              type="button"
              className="w-full h-9 rounded-md text-sm font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              onClick={handleSaveNewGroup}
              disabled={createGroupMutation.isPending || !newGroup.name.trim() || newGroup.items.every(i => !i.name.trim())}
            >
              <Check className="h-4 w-4" />
              {createGroupMutation.isPending ? 'Saving...' : 'Save Variation'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add item to existing group dialog */}
      <Dialog open={!!addItemDialog} onOpenChange={(open) => { if (!open) { setAddItemDialog(null); setNewItemName(''); setNewItemPrice('') } }}>
        <DialogContent className="max-w-sm bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Add option to "{addItemDialog?.groupName}"</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Add a new option to this variation group.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <input
              autoFocus
              className="w-full h-9 text-sm rounded-md bg-zinc-800 border border-zinc-700 px-3 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
              placeholder="Option name"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem() } }}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Price adjustment $</span>
              <input
                type="number"
                className="h-8 w-24 text-sm rounded-md bg-zinc-800 border border-zinc-700 px-2 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
                placeholder="0"
                value={newItemPrice}
                onChange={e => setNewItemPrice(e.target.value)}
                step="0.01"
              />
            </div>
            <button
              type="button"
              className="w-full h-9 rounded-md text-sm font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              onClick={handleAddItem}
              disabled={!newItemName.trim() || createItemMutation.isPending}
            >
              <Check className="h-4 w-4" />
              {createItemMutation.isPending ? 'Adding...' : 'Add Option'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
