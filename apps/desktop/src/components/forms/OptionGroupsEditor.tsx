import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toastHelpers } from '@/lib/toast-helpers'
import apiClient from '@/api/client'
import type { ProductOptionGroup, CreateOptionGroupRequest, CreateOptionItemRequest } from '@/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'

interface OptionGroupsEditorProps {
  productId?: string
  /** Draft groups stored in parent state (used when no productId yet) */
  draftGroups?: CreateOptionGroupRequest[]
  /** Callback when draft groups change */
  onDraftGroupsChange?: (groups: CreateOptionGroupRequest[]) => void
}

// Default empty item for new items
const defaultItem: CreateOptionItemRequest = {
  name: '',
  price_adjustment: 0,
  is_default: false,
  sort_order: 0,
}

// Default empty group for new groups
const defaultGroup: CreateOptionGroupRequest = {
  name: '',
  selection_type: 'single',
  is_required: false,
  min_selections: 0,
  max_selections: 0,
  sort_order: 0,
  items: [{ ...defaultItem, sort_order: 1 }],
}

export function OptionGroupsEditor({ productId, draftGroups, onDraftGroupsChange }: OptionGroupsEditorProps) {
  const queryClient = useQueryClient()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [newGroup, setNewGroup] = useState<CreateOptionGroupRequest | null>(null)

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

  // Mutations (only used in API mode)
  const createGroupMutation = useMutation({
    mutationFn: (data: CreateOptionGroupRequest) => apiClient.createOptionGroup(productId!, data),
    onSuccess: () => {
      invalidateGroups()
      setNewGroup(null)
      toastHelpers.apiSuccess('Create', 'Variant created')
    },
    onError: (err) => toastHelpers.apiError('Create variant', err),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => apiClient.deleteOptionGroup(productId!, groupId),
    onSuccess: () => {
      invalidateGroups()
      toastHelpers.apiSuccess('Delete', 'Variant deleted')
    },
    onError: (err) => toastHelpers.apiError('Delete variant', err),
  })

  const createItemMutation = useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: CreateOptionItemRequest }) =>
      apiClient.createOptionItem(groupId, data),
    onSuccess: () => {
      invalidateGroups()
      toastHelpers.apiSuccess('Create', 'Option item added')
    },
    onError: (err) => toastHelpers.apiError('Create option item', err),
  })

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => apiClient.deleteOptionItem(itemId),
    onSuccess: () => {
      invalidateGroups()
    },
    onError: (err) => toastHelpers.apiError('Delete option item', err),
  })

  const updateGroupMutation = useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: Record<string, unknown> }) =>
      apiClient.updateOptionGroup(productId!, groupId, data as Partial<CreateOptionGroupRequest>),
    onSuccess: () => {
      invalidateGroups()
    },
    onError: (err) => toastHelpers.apiError('Update option group', err),
  })

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: Record<string, unknown> }) =>
      apiClient.updateOptionItem(itemId, data as Partial<CreateOptionItemRequest>),
    onSuccess: () => {
      invalidateGroups()
    },
    onError: (err) => toastHelpers.apiError('Update option item', err),
  })

  const toggleExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  // Handle saving the new group form
  const handleSaveNewGroup = () => {
    if (!newGroup) return
    if (!newGroup.name.trim()) return
    const validItems = newGroup.items.filter(i => i.name.trim())
    if (validItems.length === 0) return

    const groupData: CreateOptionGroupRequest = {
      ...newGroup,
      items: validItems.map((item, i) => ({ ...item, sort_order: i + 1 })),
    }

    if (isDraftMode && onDraftGroupsChange && draftGroups) {
      // Draft mode: add to local state
      onDraftGroupsChange([...draftGroups, groupData])
      setNewGroup(null)
    } else {
      // API mode: create via API
      createGroupMutation.mutate(groupData)
    }
  }

  const handleDeleteDraftGroup = (index: number) => {
    if (onDraftGroupsChange && draftGroups) {
      onDraftGroupsChange(draftGroups.filter((_, i) => i !== index))
    }
  }

  const groupCount = isDraftMode ? (draftGroups?.length || 0) : apiGroups.length

  if (!isDraftMode && isLoading) {
    return (
      <div className="space-y-3 py-4">
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        <div className="h-16 w-full rounded-md bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Variants ({groupCount})
        </h3>
        {!newGroup && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNewGroup({ ...defaultGroup })}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Variant
          </Button>
        )}
      </div>

      {/* Draft mode: show pending groups */}
      {isDraftMode && draftGroups?.map((group, index) => (
        <DraftGroupCard
          key={index}
          group={group}
          onDelete={() => handleDeleteDraftGroup(index)}
        />
      ))}

      {/* API mode: show existing groups */}
      {!isDraftMode && apiGroups.map((group) => (
        <ExistingGroupCard
          key={group.id}
          group={group}
          isExpanded={expandedGroups.has(group.id)}
          onToggle={() => toggleExpanded(group.id)}
          onDelete={() => deleteGroupMutation.mutate(group.id)}
          onUpdateGroup={(data) => updateGroupMutation.mutate({ groupId: group.id, data })}
          onAddItem={(data) => createItemMutation.mutate({ groupId: group.id, data })}
          onDeleteItem={(itemId) => deleteItemMutation.mutate(itemId)}
          onUpdateItem={(itemId, data) => updateItemMutation.mutate({ itemId, data })}
          isDeleting={deleteGroupMutation.isPending}
        />
      ))}

      {/* New group form */}
      {newGroup && (
        <NewGroupCard
          group={newGroup}
          onChange={setNewGroup}
          onSave={handleSaveNewGroup}
          onCancel={() => setNewGroup(null)}
          isSaving={!isDraftMode && createGroupMutation.isPending}
        />
      )}

      {groupCount === 0 && !newGroup && (
        <p className="text-sm text-muted-foreground text-center py-6">
          No variants yet. Add variants like "Size" or "Toppings" to make this product configurable.
        </p>
      )}
    </div>
  )
}

// --- Draft Group Card (read-only summary for unsaved groups) ---
function DraftGroupCard({ group, onDelete }: { group: CreateOptionGroupRequest; onDelete: () => void }) {
  const validItems = group.items.filter(i => i.name.trim())

  return (
    <Card className="border">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">{group.name}</CardTitle>
            <Badge variant={group.selection_type === 'single' ? 'default' : 'secondary'} className="text-xs">
              {group.selection_type === 'single' ? 'Pick one' : 'Pick many'}
            </Badge>
            {group.is_required && (
              <Badge variant="destructive" className="text-xs">Required</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{validItems.length} options</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-3">
        <div className="space-y-1">
          {validItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-0.5">
              <span className="text-sm">{item.name}</span>
              <span className={`text-xs font-mono ${item.price_adjustment > 0 ? 'text-green-600' : item.price_adjustment < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {item.price_adjustment > 0 ? '+' : ''}{item.price_adjustment.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// --- Existing Group Card ---
interface ExistingGroupCardProps {
  group: ProductOptionGroup
  isExpanded: boolean
  onToggle: () => void
  onDelete: () => void
  onUpdateGroup: (data: Record<string, unknown>) => void
  onAddItem: (data: CreateOptionItemRequest) => void
  onDeleteItem: (itemId: string) => void
  onUpdateItem: (itemId: string, data: Record<string, unknown>) => void
  isDeleting: boolean
}

function ExistingGroupCard({
  group,
  isExpanded,
  onToggle,
  onDelete,
  onUpdateGroup,
  onAddItem,
  onDeleteItem,
  onUpdateItem,
  isDeleting,
}: ExistingGroupCardProps) {
  const [addingItem, setAddingItem] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState(0)

  const handleAddItem = () => {
    if (!newItemName.trim()) return
    onAddItem({
      name: newItemName.trim(),
      price_adjustment: newItemPrice,
      is_default: false,
      sort_order: (group.items?.length || 0) + 1,
    })
    setNewItemName('')
    setNewItemPrice(0)
    setAddingItem(false)
  }

  return (
    <Card className="border">
      {/* Group Header */}
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <CardTitle className="text-sm font-medium">{group.name}</CardTitle>
            <Badge variant={group.selection_type === 'single' ? 'default' : 'secondary'} className="text-xs">
              {group.selection_type === 'single' ? 'Pick one' : 'Pick many'}
            </Badge>
            {group.is_required && (
              <Badge variant="destructive" className="text-xs">Required</Badge>
            )}
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <span className="text-xs text-muted-foreground">{group.items?.length || 0} options</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive"
              onClick={onDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Expanded Content */}
      {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4">
          {/* Group settings */}
          <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-muted/50 rounded-md">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={group.selection_type}
                onValueChange={val => onUpdateGroup({ selection_type: val })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single (radio)</SelectItem>
                  <SelectItem value="multiple">Multiple (checkbox)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Required</Label>
              <div className="pt-0.5">
                <Switch
                  checked={group.is_required}
                  onCheckedChange={val => onUpdateGroup({ is_required: val })}
                />
              </div>
            </div>
            {group.selection_type === 'multiple' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Min</Label>
                  <Input
                    type="number"
                    className="h-8 w-20 text-xs"
                    value={group.min_selections}
                    onChange={e => onUpdateGroup({ min_selections: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max</Label>
                  <Input
                    type="number"
                    className="h-8 w-20 text-xs"
                    value={group.max_selections}
                    onChange={e => onUpdateGroup({ max_selections: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
              </>
            )}
          </div>

          {/* Items list */}
          <div className="space-y-1">
            {group.items?.map((item) => (
              <div key={item.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 group">
                <span className="flex-1 text-sm">{item.name}</span>
                <span className={`text-sm font-mono ${item.price_adjustment > 0 ? 'text-green-600' : item.price_adjustment < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {item.price_adjustment > 0 ? '+' : ''}{item.price_adjustment.toFixed(2)}
                </span>
                {item.is_default && (
                  <Badge variant="outline" className="text-xs">Default</Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={() => onDeleteItem(item.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                {!item.is_default && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1 text-xs opacity-0 group-hover:opacity-100"
                    onClick={() => onUpdateItem(item.id, { is_default: true })}
                  >
                    Set default
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Add item form */}
          {addingItem ? (
            <div className="flex items-center gap-2 mt-2">
              <Input
                className="h-8 text-sm flex-1"
                placeholder="Option name"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                autoFocus
              />
              <Input
                type="number"
                className="h-8 text-sm w-24"
                placeholder="Price +/-"
                value={newItemPrice}
                onChange={e => setNewItemPrice(parseFloat(e.target.value) || 0)}
                step="0.01"
              />
              <Button type="button" size="sm" className="h-8" onClick={handleAddItem}>
                Add
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setAddingItem(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => setAddingItem(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Option
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// --- New Group Card ---
interface NewGroupCardProps {
  group: CreateOptionGroupRequest
  onChange: (group: CreateOptionGroupRequest) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
}

function NewGroupCard({ group, onChange, onSave, onCancel, isSaving }: NewGroupCardProps) {
  const updateItem = (index: number, field: string, value: unknown) => {
    const items = [...group.items]
    items[index] = { ...items[index], [field]: value }
    onChange({ ...group, items })
  }

  const addItem = () => {
    onChange({
      ...group,
      items: [...group.items, { ...defaultItem, sort_order: group.items.length + 1 }],
    })
  }

  const removeItem = (index: number) => {
    if (group.items.length <= 1) return
    onChange({
      ...group,
      items: group.items.filter((_, i) => i !== index),
    })
  }

  return (
    <Card className="border-2 border-primary/50">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium">New Variant</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Group name */}
        <div className="space-y-1.5">
          <Label className="text-xs">Variant Name</Label>
          <Input
            className="h-8 text-sm"
            placeholder='e.g., "Size", "Crust Type", "Extra Toppings"'
            value={group.name}
            onChange={e => onChange({ ...group, name: e.target.value })}
            autoFocus
          />
        </div>

        {/* Group settings row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select
              value={group.selection_type}
              onValueChange={val => onChange({ ...group, selection_type: val as 'single' | 'multiple' })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single (pick one)</SelectItem>
                <SelectItem value="multiple">Multiple (pick many)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Required</Label>
            <div className="pt-0.5">
              <Switch
                checked={group.is_required}
                onCheckedChange={val => onChange({ ...group, is_required: val })}
              />
            </div>
          </div>
          {group.selection_type === 'multiple' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Max selections</Label>
              <Input
                type="number"
                className="h-8 text-sm"
                value={group.max_selections}
                onChange={e => onChange({ ...group, max_selections: parseInt(e.target.value) || 0 })}
                min={0}
                placeholder="0 = unlimited"
              />
            </div>
          )}
        </div>

        {/* Items */}
        <div>
          <Label className="text-xs mb-2 block">Options</Label>
          <div className="space-y-2">
            {group.items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="h-8 text-sm flex-1"
                  placeholder="Option name"
                  value={item.name}
                  onChange={e => updateItem(i, 'name', e.target.value)}
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    className="h-8 text-sm w-20"
                    placeholder="+/-"
                    value={item.price_adjustment}
                    onChange={e => updateItem(i, 'price_adjustment', parseFloat(e.target.value) || 0)}
                    step="0.01"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive"
                  onClick={() => removeItem(i)}
                  disabled={group.items.length <= 1}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-2 text-xs" onClick={addItem}>
            <Plus className="h-3 w-3 mr-1" />
            Add Option
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={isSaving || !group.name.trim() || group.items.every(i => !i.name.trim())}
          >
            {isSaving ? 'Saving...' : 'Save Variant'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
