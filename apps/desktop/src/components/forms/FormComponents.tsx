import React from 'react'
import { Control, FieldPath, FieldValues } from 'react-hook-form'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Loader2, UtensilsCrossed, Layers, ChevronDown } from 'lucide-react'

// Generic form field wrapper
interface FormFieldWrapperProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
  children: React.ReactNode
}

export function FormFieldWrapper<T extends FieldValues>({
  control,
  name,
  label,
  description,
  children,
}: FormFieldWrapperProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={() => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {children}
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// Text Input Field
interface TextInputFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  placeholder?: string
  description?: string
  type?: 'text' | 'email' | 'password' | 'tel'
  autoComplete?: string
}

export function TextInputField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  type = 'text',
  autoComplete,
}: TextInputFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              autoComplete={autoComplete}
              {...field}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// Number Input Field
interface NumberInputFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  placeholder?: string
  description?: string
  min?: number
  max?: number
  step?: number
}

export function NumberInputField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  min,
  max,
  step = 1,
}: NumberInputFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              placeholder={placeholder}
              min={min}
              max={max}
              step={step}
              {...field}
              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// Price Input Field (specialized number field)
interface PriceInputFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  placeholder?: string
  description?: string
  currency?: string
}

export function PriceInputField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = "0.00",
  description,
  currency = "$",
}: PriceInputFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currency}
              </span>
              <Input
                type="number"
                placeholder={placeholder}
                min="0"
                step="0.01"
                className="pl-8"
                {...field}
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              />
            </div>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// Select Field
interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  placeholder?: string
  description?: string
  options: SelectOption[]
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = "Select an option",
  description,
  options,
}: SelectFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value != null ? String(field.value) : undefined}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem 
                  key={option.value} 
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// Textarea Field
interface TextareaFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  placeholder?: string
  description?: string
  rows?: number
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  rows = 3,
}: TextareaFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              placeholder={placeholder}
              rows={rows}
              {...field}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// Switch Field
interface SwitchFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
}

export function SwitchField<T extends FieldValues>({
  control,
  name,
  label,
  description,
}: SwitchFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <FormLabel className="text-base">{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}
          </div>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </FormControl>
        </FormItem>
      )}
    />
  )
}

// Submit Button with loading state
interface FormSubmitButtonProps {
  isLoading?: boolean
  loadingText?: string
  children: React.ReactNode
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  disabled?: boolean
}

export function FormSubmitButton({
  isLoading = false,
  loadingText = "Saving...",
  children,
  variant = "default",
  size = "default",
  className,
  disabled = false,
}: FormSubmitButtonProps) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={isLoading || disabled}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

// POS-specific role select options
export const roleOptions: SelectOption[] = [
  { value: 'admin', label: 'Administrator' },
  { value: 'manager', label: 'Manager' },
  { value: 'server', label: 'Server' },
  { value: 'counter', label: 'Counter/Checkout' },
  { value: 'kitchen', label: 'Kitchen Staff' },
]

// POS-specific status options
export const productStatusOptions: SelectOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

export const orderTypeOptions: SelectOption[] = [
  { value: 'dine-in', label: 'Dine In' },
  { value: 'take-away', label: 'Take Away' },
  { value: 'delivery', label: 'Delivery' },
]

export const tableStatusOptions: SelectOption[] = [
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'maintenance', label: 'Under Maintenance' },
]

// Dietary type options with colors for visual indicators
export const dietaryTypeOptions = [
  { value: 'veg', label: 'Vegetarian', color: '#22C55E' },
  { value: 'non-veg', label: 'Non-Vegetarian', color: '#EF4444' },
  { value: 'egg', label: 'Egg', color: '#EAB308' },
  { value: 'vegan', label: 'Vegan', color: '#16A34A' },
] as const

// Dietary Type Indicator Component (colored dot)
interface DietaryIndicatorProps {
  type: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function DietaryIndicator({ type, size = 'md', showLabel = false }: DietaryIndicatorProps) {
  if (!type) return null

  const option = dietaryTypeOptions.find(opt => opt.value === type)
  if (!option) return null

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`${sizeClasses[size]} rounded-full border-2`}
        style={{
          backgroundColor: option.color,
          borderColor: option.color,
        }}
        title={option.label}
      />
      {showLabel && (
        <span className="text-xs text-muted-foreground">{option.label}</span>
      )}
    </div>
  )
}

// Allergen Multi-Select Field
const allergenOptions = [
  { value: 'gluten', label: 'Gluten' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'nuts', label: 'Nuts' },
  { value: 'peanuts', label: 'Peanuts' },
  { value: 'soy', label: 'Soy' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'fish', label: 'Fish' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'sesame', label: 'Sesame' },
  { value: 'celery', label: 'Celery' },
  { value: 'mustard', label: 'Mustard' },
  { value: 'lupin', label: 'Lupin' },
  { value: 'sulphites', label: 'Sulphites' },
] as const

interface AllergenMultiSelectFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
}

export function AllergenMultiSelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
}: AllergenMultiSelectFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selected: string[] = field.value
          ? String(field.value).split(',').map((s: string) => s.trim()).filter(Boolean)
          : []

        const toggle = (value: string) => {
          const next = selected.includes(value)
            ? selected.filter((v) => v !== value)
            : [...selected, value]
          field.onChange(next.join(', ') || undefined)
        }

        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <div className="flex flex-wrap gap-2">
                {allergenOptions.map((option) => {
                  const isSelected = selected.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggle(option.value)}
                      className={`
                        px-3 py-1.5 rounded-lg border-2 text-sm transition-all
                        ${isSelected
                          ? 'border-red-500/60 bg-red-500/10 text-red-300 font-medium'
                          : 'border-zinc-700 hover:border-zinc-500 text-zinc-400'
                        }
                      `}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

// Dietary Type Field - Visual selector with colored dots
interface DietaryTypeFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
}

export function DietaryTypeField<T extends FieldValues>({
  control,
  name,
  label,
  description,
}: DietaryTypeFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="flex flex-wrap gap-2">
              {dietaryTypeOptions.map((option) => {
                const isSelected = field.value === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => field.onChange(isSelected ? undefined : option.value)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all
                      ${isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                      }
                    `}
                  >
                    <div
                      className="w-3 h-3 rounded-full border-2"
                      style={{
                        backgroundColor: option.color,
                        borderColor: option.color,
                      }}
                    />
                    <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>
                      {option.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// Product Type Selector — card-style dropdown with icons and descriptions
const productTypeOptions = [
  {
    value: 'simple',
    label: 'Prepared food and beverage',
    description: 'Best for restaurants or other food venues.',
    icon: UtensilsCrossed,
  },
  {
    value: 'combo',
    label: 'Combo',
    description: 'Best for selling a group of food and beverage items.',
    icon: Layers,
  },
] as const

interface ProductTypeSelectorProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
}

export function ProductTypeSelector<T extends FieldValues>({
  control,
  name,
  label,
}: ProductTypeSelectorProps<T>) {
  const [open, setOpen] = React.useState(false)

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selected = productTypeOptions.find((o) => o.value === field.value) || productTypeOptions[0]
        const Icon = selected.icon

        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpen(!open)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-800 hover:border-zinc-500 transition-colors text-left"
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-md bg-zinc-700">
                    <Icon className="w-5 h-5 text-zinc-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200">{selected.label}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && (
                  <div className="absolute z-50 mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl overflow-hidden">
                    {productTypeOptions.map((option) => {
                      const OptIcon = option.icon
                      const isSelected = field.value === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            field.onChange(option.value)
                            setOpen(false)
                          }}
                          className={`
                            w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                            ${isSelected
                              ? 'bg-primary/10'
                              : 'hover:bg-zinc-700/50'
                            }
                          `}
                        >
                          <div className={`flex items-center justify-center w-9 h-9 rounded-md ${isSelected ? 'bg-primary/20' : 'bg-zinc-700'}`}>
                            <OptIcon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-zinc-400'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-zinc-200'}`}>{option.label}</p>
                            <p className="text-xs text-zinc-500">{option.description}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
