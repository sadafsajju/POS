import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Form, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { PinInput } from '@/components/ui/pin-input'
import {
  TextInputField,
  SelectField,
  FormSubmitButton,
  roleOptions
} from '@/components/forms/FormComponents'
import { LocationMultiSelectField } from '@/components/forms/LocationMultiSelectField'
import { createUserSchema, updateUserSchema, type CreateUserData, type UpdateUserData } from '@/lib/form-schemas'
import { toastHelpers } from '@/lib/toast-helpers'
import apiClient from '@/api/client'
import type { User } from '@/types'
import { Shield } from 'lucide-react'

interface UserFormProps {
  user?: User // If provided, we're editing; otherwise creating
  onSuccess?: () => void
  onCancel?: () => void
  mode?: 'create' | 'edit'
}

export function UserForm({ user, onSuccess, onCancel, mode = 'create' }: UserFormProps) {
  const queryClient = useQueryClient()
  const isEditing = mode === 'edit' && user

  // Choose the appropriate schema and default values
  const schema = isEditing ? updateUserSchema : createUserSchema
  const defaultValues = isEditing
    ? {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role as any,
        password: '', // Don't pre-fill password for editing
        pin: '', // Don't pre-fill PIN for editing
        location_ids: user.location_ids || [],
      }
    : {
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'server' as const,
        pin: '',
        location_ids: [] as string[],
      }

  const form = useForm<CreateUserData | UpdateUserData>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateUserData) => apiClient.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toastHelpers.userCreated(`${form.getValues('first_name')} ${form.getValues('last_name')}`)
      form.reset()
      onSuccess?.()
    },
    onError: (error) => {
      toastHelpers.apiError('Create user', error)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateUserData) => apiClient.updateUser(data.id.toString(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toastHelpers.apiSuccess('Update', `User ${form.getValues('first_name')} ${form.getValues('last_name')}`)
      onSuccess?.()
    },
    onError: (error) => {
      toastHelpers.apiError('Update user', error)
    },
  })

  const onSubmit = (data: CreateUserData | UpdateUserData) => {
    if (isEditing) {
      // Filter out empty password/pin for updates
      const updateData = { ...data } as UpdateUserData
      if (!updateData.password || updateData.password.trim() === '') {
        delete updateData.password
      }
      if (!updateData.pin || updateData.pin.trim() === '') {
        delete updateData.pin
      }
      updateMutation.mutate(updateData)
    } else {
      // Filter out empty pin for creates
      const createData = { ...data } as CreateUserData
      if (!createData.pin || createData.pin.trim() === '') {
        delete createData.pin
      }
      createMutation.mutate(createData)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-auto bg-zinc-950">
          <div className="max-w-3xl mx-auto p-6 space-y-4">

            {/* Personal Information */}
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300">Personal Information</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInputField
                    control={form.control}
                    name="first_name"
                    label="First Name"
                    placeholder="Enter first name"
                    autoComplete="given-name"
                  />
                  <TextInputField
                    control={form.control}
                    name="last_name"
                    label="Last Name"
                    placeholder="Enter last name"
                    autoComplete="family-name"
                  />
                </div>
              </div>
            </section>

            {/* Account Information */}
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300">Account Information</h3>
              </div>
              <div className="p-5 space-y-4">
                <TextInputField
                  control={form.control}
                  name="username"
                  label="Username"
                  placeholder="Enter username"
                  autoComplete="username"
                  description="Used for logging into the system"
                />
                <TextInputField
                  control={form.control}
                  name="email"
                  label="Email Address"
                  type="email"
                  placeholder="Enter email address"
                  autoComplete="email"
                />
                <TextInputField
                  control={form.control}
                  name="password"
                  label={isEditing ? "New Password (leave blank to keep current)" : "Password"}
                  type="password"
                  placeholder={isEditing ? "Enter new password or leave blank" : "Enter password"}
                  autoComplete={isEditing ? "new-password" : "new-password"}
                  description={isEditing ? "Leave blank to keep the current password" : "Minimum 6 characters"}
                />
              </div>
            </section>

            {/* Role & Location */}
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300">Role & Location</h3>
              </div>
              <div className="p-5 space-y-4">
                <SelectField
                  control={form.control}
                  name="role"
                  label="Role"
                  placeholder="Select user role"
                  options={roleOptions}
                  description="Determines what features the user can access"
                />
                <LocationMultiSelectField
                  control={form.control}
                  name="location_ids"
                  label="Locations"
                  description="Branches this staff member can access"
                />
              </div>
            </section>

            {/* Security PIN */}
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300">Security</h3>
              </div>
              <div className="p-5">
                <FormField
                  control={form.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {isEditing ? 'New PIN (leave blank to keep current)' : '4-Digit PIN'}
                      </FormLabel>
                      <PinInput
                        value={field.value || ''}
                        onChange={field.onChange}
                        autoFocus={false}
                        error={!!form.formState.errors.pin}
                      />
                      <FormDescription>
                        {isEditing ? 'Leave blank to keep the current PIN' : 'Used for quick login and confirming actions'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

          </div>
        </div>

        {/* Fixed Footer */}
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
              {isEditing ? 'Update User' : 'Create User'}
            </FormSubmitButton>
          </div>
        </div>
      </form>
    </Form>
  )
}
