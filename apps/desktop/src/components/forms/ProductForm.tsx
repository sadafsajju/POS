import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  TextInputField,
  TextareaField,
  PriceInputField,
  NumberInputField,
  SelectField,
  FormSubmitButton,
  DietaryTypeField,
  productStatusOptions
} from '@/components/forms/FormComponents'
import { createProductSchema, updateProductSchema, type CreateProductData, type UpdateProductData } from '@/lib/form-schemas'
import { OptionGroupsEditor } from '@/components/forms/OptionGroupsEditor'
import { ComboSlotsEditor, type DraftComboSlot } from '@/components/forms/ComboSlotsEditor'
import { toastHelpers } from '@/lib/toast-helpers'
import { useSettingsStore } from '@pos/core'
import apiClient from '@/api/client'
import type { Product, CreateOptionGroupRequest, CreateComboSlotRequest } from '@/types'

interface ProductFormProps {
  product?: Product // If provided, we're editing; otherwise creating
  onSuccess?: () => void
  onCreated?: (product: Product) => void // Called after creation to auto-switch to edit mode
  onCancel?: () => void
  mode?: 'create' | 'edit'
}

export function ProductForm({ product, onSuccess, onCreated, onCancel, mode = 'create' }: ProductFormProps) {
  const queryClient = useQueryClient()
  const { settings } = useSettingsStore()
  const isEditing = mode === 'edit' && product

  // Draft option groups for create mode (stored locally until product is saved)
  const [pendingGroups, setPendingGroups] = useState<CreateOptionGroupRequest[]>([])
  // Draft combo slots for create mode (stored locally until product is saved)
  const [pendingComboSlots, setPendingComboSlots] = useState<DraftComboSlot[]>([])

  // Fetch categories for dropdown
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories().then(res => res.data)
  })

  // Create category options for select field
  const categoryOptions = categories.map(cat => ({
    value: cat.id.toString(),
    label: cat.name
  }))

  // Choose the appropriate schema and default values
  const schema = isEditing ? updateProductSchema : createProductSchema
  const defaultValues = isEditing
    ? {
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price,
        category_id: product.category_id,
        image_url: product.image_url || '',
        status: product.status as any,
        preparation_time: product.preparation_time || 5,
        dietary_type: product.dietary_type,
        product_type: product.product_type || 'simple',
      }
    : {
        name: '',
        description: '',
        price: 0,
        category_id: categories[0]?.id || 1,
        image_url: '',
        status: 'active' as const,
        preparation_time: 5,
        dietary_type: undefined,
        product_type: 'simple' as const,
      }

  const form = useForm<CreateProductData | UpdateProductData>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  // Watch product_type to reactively show combo vs option groups
  const watchedProductType = form.watch('product_type')
  const isCombo = watchedProductType === 'combo'

  // Create mutation - also batch-creates any pending option groups
  const createMutation = useMutation({
    mutationFn: async (data: CreateProductData) => {
      const response = await apiClient.createProduct(data)
      if (response.data) {
        const productId = response.data.id
        // Batch-create pending option groups after product is created
        for (const group of pendingGroups) {
          try {
            await apiClient.createOptionGroup(productId, group)
          } catch (err) {
            console.error('Failed to create option group:', err)
          }
        }
        // Batch-create pending combo slots (with inline choices) after product is created
        for (const slot of pendingComboSlots) {
          try {
            const slotRequest: CreateComboSlotRequest = {
              name: slot.name,
              is_required: slot.is_required,
              sort_order: slot.sort_order,
              choices: slot.choices.map(c => ({
                product_id: c.product_id,
                price_override: c.price_override,
                sort_order: c.sort_order,
              })),
            }
            await apiClient.createComboSlot(productId, slotRequest)
          } catch (err) {
            console.error('Failed to create combo slot:', err)
          }
        }
      }
      return response
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toastHelpers.productCreated(form.getValues('name'))
      // Auto-switch to edit mode so editors become fully available
      if (response.data && onCreated) {
        onCreated(response.data)
      } else {
        form.reset()
        onSuccess?.()
      }
    },
    onError: (error) => {
      toastHelpers.apiError('Create product', error)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateProductData) => apiClient.updateProduct(data.id.toString(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toastHelpers.apiSuccess('Update', `Product "${form.getValues('name')}"`)
      onSuccess?.()
    },
    onError: (error) => {
      toastHelpers.apiError('Update product', error)
    },
  })

  const onSubmit = (data: CreateProductData | UpdateProductData) => {
    if (isEditing) {
      updateMutation.mutate(data as UpdateProductData)
    } else {
      createMutation.mutate(data as CreateProductData)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  if (categories.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          You need to create at least one category before adding products.
        </p>
        <Button onClick={onCancel} variant="outline">
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form id="product-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto space-y-6 p-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <TextInputField
                  control={form.control}
                  name="name"
                  label="Product Name"
                  placeholder="Enter product name"
                  description="The name that will appear on the menu"
                />

                <TextareaField
                  control={form.control}
                  name="description"
                  label="Description"
                  placeholder="Describe the product..."
                  rows={3}
                  description="Optional description for staff and customers"
                />

                <TextInputField
                  control={form.control}
                  name="image_url"
                  label="Image URL"
                  placeholder="https://example.com/image.jpg"
                  description="Optional product image URL"
                />
              </CardContent>
            </Card>

            {/* Pricing & Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pricing & Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PriceInputField
                    control={form.control}
                    name="price"
                    label="Price"
                    currency={settings.currencySymbol || '$'}
                    description="Product selling price"
                  />

                  <NumberInputField
                    control={form.control}
                    name="preparation_time"
                    label="Preparation Time (minutes)"
                    min={1}
                    max={120}
                    description="Estimated cooking/prep time"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Category & Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Category & Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField
                    control={form.control}
                    name="category_id"
                    label="Category"
                    options={categoryOptions}
                    placeholder="Select a category"
                    description="Product category for menu organization"
                  />

                  <SelectField
                    control={form.control}
                    name="status"
                    label="Status"
                    options={productStatusOptions}
                    description="Active products appear on the menu"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Product Type & Variants */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Product Type & Variants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="is_combo"
                    checked={isCombo}
                    onCheckedChange={(checked) => {
                      form.setValue('product_type', checked ? 'combo' : 'simple')
                    }}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <label
                      htmlFor="is_combo"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Combo Product
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Bundle multiple products together as a combo meal
                    </p>
                  </div>
                </div>

                <DietaryTypeField
                  control={form.control}
                  name="dietary_type"
                  label="Dietary Type"
                  description="Select the dietary classification for this product"
                />

                <div className="border-t pt-6">
                  {isCombo ? (
                    <ComboSlotsEditor
                      productId={isEditing && product ? product.id : undefined}
                      draftSlots={!isEditing ? pendingComboSlots : undefined}
                      onDraftSlotsChange={!isEditing ? setPendingComboSlots : undefined}
                    />
                  ) : (
                    <OptionGroupsEditor
                      productId={isEditing && product ? product.id : undefined}
                      draftGroups={!isEditing ? pendingGroups : undefined}
                      onDraftGroupsChange={!isEditing ? setPendingGroups : undefined}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="flex-shrink-0 border-t bg-background px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-end gap-3">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
            <FormSubmitButton
              isLoading={isLoading}
              loadingText={isEditing ? "Updating..." : "Creating..."}
            >
              {isEditing ? 'Update Product' : 'Create Product'}
            </FormSubmitButton>
          </div>
        </div>
      </form>
    </Form>
  )
}
