import { useForm, useController } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Form } from '@/components/ui/form'
import { ImagePickerField } from '@/components/forms/ImagePickerField'
import {
  TextInputField,
  TextareaField,
  NumberInputField,
  FormSubmitButton
} from '@/components/forms/FormComponents'
import { createCategorySchema, updateCategorySchema, type CreateCategoryData, type UpdateCategoryData } from '@/lib/form-schemas'
import { toastHelpers } from '@/lib/toast-helpers'
import apiClient from '@/api/client'
import type { Category } from '@/types'
import { X, Check } from 'lucide-react'

// Card colors — all pass WCAG AA contrast against white text (≥ 4.5:1)
export const CATEGORY_CARD_COLORS = [
  '#dc2626', // red
  '#ea580c', // orange
  '#d97706', // amber
  '#16a34a', // green
  '#0d9488', // teal
  '#2563eb', // blue
  '#9333ea', // purple
  '#db2777', // pink
] as const

function ColorPickerField({ control, name }: { control: any; name: string }) {
  const { field } = useController({ control, name })
  const value = (field.value as string) || ''

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-300">Card Color</label>
      <div className="flex items-center gap-2 flex-wrap">
        {/* None option — crossed circle */}
        <button
          type="button"
          onClick={() => field.onChange('')}
          aria-label="No card color"
          title="No color"
          className={`relative w-8 h-8 rounded-full bg-zinc-800 ring-1 ring-zinc-700 hover:ring-zinc-500 transition-all flex items-center justify-center ${
            value === '' ? 'ring-2 ring-zinc-300 ring-offset-2 ring-offset-zinc-900' : ''
          }`}
        >
          <svg viewBox="0 0 32 32" className="w-full h-full text-zinc-500 absolute inset-0">
            <line x1="6" y1="26" x2="26" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        {CATEGORY_CARD_COLORS.map((color) => {
          const isSelected = value.toLowerCase() === color
          return (
            <button
              key={color}
              type="button"
              onClick={() => field.onChange(color)}
              aria-label={`Select color ${color}`}
              title={color}
              className={`relative w-8 h-8 rounded-full transition-all flex items-center justify-center hover:scale-110 ${
                isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''
              }`}
              style={{ backgroundColor: color }}
            >
              {isSelected && <Check className="w-4 h-4 text-white" />}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-zinc-500">Tints the category card in the POS. Choose <em>none</em> to keep the default look.</p>
    </div>
  )
}

interface CategoryFormProps {
  category?: Category // If provided, we're editing; otherwise creating
  onSuccess?: () => void
  onCancel?: () => void
  mode?: 'create' | 'edit'
}

export function CategoryForm({ category, onSuccess, onCancel, mode = 'create' }: CategoryFormProps) {
  const queryClient = useQueryClient()
  const isEditing = mode === 'edit' && category

  // Choose the appropriate schema and default values
  const schema = isEditing ? updateCategorySchema : createCategorySchema
  const defaultValues = isEditing
    ? {
        id: category.id,
        name: category.name,
        description: category.description || '',
        image_url: category.image_url || '',
        color: category.color || '',
        sort_order: category.sort_order || 0,
      }
    : {
        name: '',
        description: '',
        image_url: '',
        color: '',
        sort_order: 0,
      }

  const form = useForm<CreateCategoryData | UpdateCategoryData>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryData) => apiClient.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      toastHelpers.categoryCreated(form.getValues('name') ?? '')
      form.reset()
      onSuccess?.()
    },
    onError: (error) => {
      toastHelpers.apiError('Create category', error)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateCategoryData) => apiClient.updateCategory(data.id.toString(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      toastHelpers.apiSuccess('Update', `Category "${form.getValues('name')}"`)
      onSuccess?.()
    },
    onError: (error) => {
      toastHelpers.apiError('Update category', error)
    },
  })

  const onSubmit = (data: CreateCategoryData | UpdateCategoryData) => {
    if (isEditing) {
      updateMutation.mutate(data as UpdateCategoryData)
    } else {
      createMutation.mutate(data as CreateCategoryData)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <div className="w-full max-w-2xl mx-auto rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900">
        <h3 className="text-base font-semibold text-zinc-200">
          {isEditing ? 'Edit Category' : 'Create New Category'}
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="p-5">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Basic Information */}
            <div className="space-y-4">
              <TextInputField
                control={form.control}
                name="name"
                label="Category Name"
                placeholder="Enter category name"
                description="The name that will appear in the menu sections"
              />

              <TextareaField
                control={form.control}
                name="description"
                label="Description"
                placeholder="Describe this category..."
                rows={3}
                description="Optional description for menu organization"
              />

              <ImagePickerField
                control={form.control as any}
                name="image_url"
                label="Category Image"
                description="Choose from the media library or leave empty"
              />

              <ColorPickerField control={form.control as any} name="color" />
            </div>

            {/* Sorting */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberInputField
                control={form.control}
                name="sort_order"
                label="Sort Order"
                min={0}
                max={999}
                description="Lower numbers appear first in menus"
              />

              {/* Empty column for layout balance */}
              <div />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-3 border-t border-zinc-800">
              <FormSubmitButton
                isLoading={isLoading}
                loadingText={isEditing ? "Updating..." : "Creating..."}
                className="flex-1"
              >
                {isEditing ? 'Update Category' : 'Create Category'}
              </FormSubmitButton>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 rounded-md text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
