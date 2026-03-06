import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Form } from '@/components/ui/form'
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
import { X } from 'lucide-react'

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
        sort_order: category.sort_order || 0,
      }
    : {
        name: '',
        description: '',
        image_url: '',
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

              <TextInputField
                control={form.control}
                name="image_url"
                label="Image URL"
                placeholder="https://example.com/image.jpg"
                description="Optional category image URL"
              />
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
