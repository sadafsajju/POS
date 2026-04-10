import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Form } from '@/components/ui/form'
import {
  TextInputField,
  TextareaField,
  PriceInputField,
  NumberInputField,
  SelectField,
  SwitchField,
  FormSubmitButton,
  DietaryTypeField,
  AllergenMultiSelectField,
  ProductTypeSelector,
} from '@/components/forms/FormComponents'
import { ImagePickerField } from '@/components/forms/ImagePickerField'
import { LocationMultiSelectField } from '@/components/forms/LocationMultiSelectField'
import { createProductSchema, updateProductSchema, type CreateProductData, type UpdateProductData } from '@/lib/form-schemas'
import { ComboSlotsEditor, type DraftComboSlot } from '@/components/forms/ComboSlotsEditor'
import { ProductVariationsEditor, type DraftVariationData } from '@/components/forms/ProductVariationsEditor'
import { toastHelpers } from '@/lib/toast-helpers'
import { useSettingsStore } from '@pos/core'
import apiClient from '@/api/client'
import type { Product, CreateComboSlotRequest } from '@/types'

interface ProductFormProps {
  product?: Product // If provided, we're editing; otherwise creating
  onSuccess?: () => void
  onCreated?: (product: Product) => void // Called after creation to auto-switch to edit mode
  onCancel?: () => void
  mode?: 'create' | 'edit'
  /** When true, hides the built-in footer so the parent can render buttons externally using form="product-form" */
  hideFooter?: boolean
  /** Called when the form's loading state changes, so parent can reflect it on external buttons */
  onLoadingChange?: (isLoading: boolean) => void
}

export function ProductForm({ product, onSuccess, onCreated, onCancel, mode = 'create', hideFooter, onLoadingChange }: ProductFormProps) {
  const queryClient = useQueryClient()
  const { settings } = useSettingsStore()
  const isEditing = mode === 'edit' && product

  // Draft combo slots for create mode (stored locally until product is saved)
  const [pendingComboSlots, setPendingComboSlots] = useState<DraftComboSlot[]>([])
  // Draft variation data for create mode (stored locally until product is saved)
  const [pendingVariationData, setPendingVariationData] = useState<DraftVariationData>({ title: '', items: [] })
  // Whether this product has variation-based pricing (hides base price field)
  const [hasVariations, setHasVariations] = useState(false)

  // Fetch categories for dropdown
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories().then(res => res.data)
  })

  // Create category options for select field
  const categoryOptions = Array.isArray(categories) ? categories.map(cat => ({
    value: cat.id.toString(),
    label: cat.name
  })) : []

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
        is_available: product.is_available ?? true,
        preparation_time: product.preparation_time || 5,
        dietary_type: product.dietary_type,
        calorie_count: product.calorie_count || undefined,
        food_allergens: product.food_allergens || '',
        product_type: product.product_type || 'simple',
        location_ids: product.location_ids || undefined,
      }
    : {
        name: '',
        description: '',
        price: 0,
        category_id: categories[0]?.id || 1,
        image_url: '',
        is_available: true,
        preparation_time: 5,
        dietary_type: undefined,
        calorie_count: undefined,
        food_allergens: '',
        product_type: 'simple' as const,
        location_ids: undefined,
      }

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as any,
  })

  // Watch product_type to reactively show combo vs option groups
  const watchedProductType = form.watch('product_type')
  const isCombo = watchedProductType === 'combo'

  // Create mutation - also batch-creates any pending variation links and combo slots
  const createMutation = useMutation({
    mutationFn: async (data: CreateProductData) => {
      const response = await apiClient.createProduct(data)
      if (response.data) {
        const productId = response.data.id
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
        // Batch-save pending variations: link existing group or create new one
        const validItems = pendingVariationData.items.filter(i => i.name.trim())
        if (validItems.length > 0) {
          try {
            if (pendingVariationData.selectedGroupId) {
              // Existing group selected — fetch it to get item IDs, then link with prices
              const groupRes = await apiClient.getVariationGroup(pendingVariationData.selectedGroupId)
              if (groupRes.data) {
                const group = groupRes.data
                await apiClient.linkVariationsToProduct(productId, [{
                  variation_group_id: group.id,
                  sort_order: 1,
                  item_prices: (group.items || []).map((vi: { id: string }, i: number) => ({
                    variation_item_id: vi.id,
                    price: parseFloat(validItems[i]?.price || '0') || 0,
                  })),
                }])
              }
            } else {
              // Create new group, then link with prices
              const groupRes = await apiClient.createVariationGroup({
                name: pendingVariationData.title.trim() || 'Variations',
                selection_type: 'single',
                is_required: true,
                min_selections: 0,
                max_selections: 0,
                sort_order: 0,
                items: validItems.map((item, i) => ({
                  name: item.name.trim(),
                  is_default: i === 0,
                  sort_order: i + 1,
                })),
              })
              if (groupRes.data) {
                const group = groupRes.data
                await apiClient.linkVariationsToProduct(productId, [{
                  variation_group_id: group.id,
                  sort_order: 1,
                  item_prices: (group.items || []).map((vi: { id: string }, i: number) => ({
                    variation_item_id: vi.id,
                    price: parseFloat(validItems[i]?.price || '0') || 0,
                  })),
                }])
              }
            }
          } catch (err) {
            console.error('Failed to save variations:', err)
          }
        }
      }
      return response
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toastHelpers.productCreated(form.getValues('name') ?? '')
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

  useEffect(() => {
    onLoadingChange?.(isLoading)
  }, [isLoading, onLoadingChange])

  if (categories.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500 mb-4">
          You need to create at least one category before adding products.
        </p>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-md text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form id="product-form" onSubmit={form.handleSubmit(onSubmit as any)} className="flex flex-col h-full overflow-hidden">
        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-auto bg-zinc-950">
          <div className="max-w-5xl mx-auto p-6">
            <div className="flex gap-6">
              {/* Main content */}
              <div className="flex-1 min-w-0 space-y-4">
                {/* Product Type */}
                <section className="rounded-lg border border-zinc-800 bg-zinc-900">
                  <div className="p-5">
                    <ProductTypeSelector
                      control={form.control as any}
                      name="product_type"
                      label="Item type"
                    />
                  </div>
                </section>

                {/* Basic Information */}
                <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="px-5 py-3 border-b border-zinc-800">
                    <h3 className="text-sm font-semibold text-zinc-300">Basic Information</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <TextInputField
                      control={form.control as any}
                      name="name"
                      label="Product Name"
                      placeholder="Enter product name"
                      description="The name that will appear on the menu"
                    />

                    <TextareaField
                      control={form.control as any}
                      name="description"
                      label="Description"
                      placeholder="Describe the product..."
                      rows={3}
                      description="Optional description for staff and customers"
                    />
                  </div>
                </section>

                {/* Image */}
                <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="px-5 py-3 border-b border-zinc-800">
                    <h3 className="text-sm font-semibold text-zinc-300">Image</h3>
                  </div>
                  <div className="p-5">
                    <ImagePickerField
                      control={form.control as any}
                      name="image_url"
                      label="Product Image"
                      description="Upload a product image"
                    />
                  </div>
                </section>

                {/* Pricing & Details */}
                <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="px-5 py-3 border-b border-zinc-800">
                    <h3 className="text-sm font-semibold text-zinc-300">Pricing & Details</h3>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {!hasVariations ? (
                        <PriceInputField
                          control={form.control as any}
                          name="price"
                          label="Price"
                          currency={settings.currencySymbol || '$'}
                          description="Product selling price"
                        />
                      ) : (
                        <div className="flex items-center">
                          <p className="text-xs text-zinc-500">
                            Price is set per variation below
                          </p>
                        </div>
                      )}

                      <NumberInputField
                        control={form.control as any}
                        name="preparation_time"
                        label="Preparation Time (minutes)"
                        min={1}
                        max={120}
                        description="Estimated cooking/prep time"
                      />
                    </div>
                  </div>
                </section>

                {/* Nutritional Info (hidden for combo) */}
                {!isCombo && (
                  <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
                    <div className="px-5 py-3 border-b border-zinc-800">
                      <h3 className="text-sm font-semibold text-zinc-300">Nutritional Info</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <DietaryTypeField
                        control={form.control as any}
                        name="dietary_type"
                        label="Dietary Type"
                        description="Select the dietary classification for this product"
                      />
                      <NumberInputField
                        control={form.control as any}
                        name="calorie_count"
                        label="Calorie Count (kcal)"
                        min={0}
                        max={10000}
                        description="Calories per serving"
                      />
                      <AllergenMultiSelectField
                        control={form.control as any}
                        name="food_allergens"
                        label="Food Allergens"
                        description="Select all allergens present in this product"
                      />
                    </div>
                  </section>
                )}

                {/* Variations (only for non-combo products) */}
                {!isCombo && (
                  <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
                    <div className="p-5">
                      <ProductVariationsEditor
                        productId={isEditing && product ? product.id : undefined}
                        draft={!isEditing ? pendingVariationData : undefined}
                        onDraftChange={!isEditing ? setPendingVariationData : undefined}
                        onHasVariations={setHasVariations}
                      />
                    </div>
                  </section>
                )}

                {/* Combo Slots (only for combo products) */}
                {isCombo && (
                  <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
                    <div className="p-5">
                      <ComboSlotsEditor
                        productId={isEditing && product ? product.id : undefined}
                        draftSlots={!isEditing ? pendingComboSlots : undefined}
                        onDraftSlotsChange={!isEditing ? setPendingComboSlots : undefined}
                      />
                    </div>
                  </section>
                )}
              </div>

              {/* Sidebar */}
              <div className="w-80 shrink-0">
                <div className="sticky top-6 space-y-4">
                  <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
                    <div className="px-5 py-3 border-b border-zinc-800">
                      <h3 className="text-sm font-semibold text-zinc-300">Category & Availability</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <SelectField
                        control={form.control as any}
                        name="category_id"
                        label="Category"
                        options={categoryOptions}
                        placeholder="Select a category"
                        description="Product category for menu organization"
                      />

                      <SwitchField
                        control={form.control as any}
                        name="is_available"
                        label="Available"
                        description="Available products appear on the menu"
                      />
                    </div>
                  </section>

                  {/* Location Availability - only shows when multiple locations exist */}
                  <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
                    <div className="px-5 py-3 border-b border-zinc-800">
                      <h3 className="text-sm font-semibold text-zinc-300">Location Availability</h3>
                    </div>
                    <div className="p-5">
                      <LocationMultiSelectField
                        control={form.control as any}
                        name="location_ids"
                        label="Available at"
                        description="Leave empty for all locations"
                      />
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - hidden when parent renders actions in header */}
        {!hideFooter && (
          <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900 px-6 py-4">
            <div className="max-w-3xl mx-auto flex items-center justify-end gap-3">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-md text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
              )}
              <FormSubmitButton
                isLoading={isLoading}
                loadingText={isEditing ? "Updating..." : "Creating..."}
              >
                {isEditing ? 'Update Product' : 'Create Product'}
              </FormSubmitButton>
            </div>
          </div>
        )}
      </form>
    </Form>
  )
}
