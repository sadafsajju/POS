import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { PinInput } from '@/components/ui/pin-input'
import {
  TextInputField,
  SelectField,
  FormSubmitButton,
  roleOptions
} from '@/components/forms/FormComponents'
import { createUserSchema, updateUserSchema, type CreateUserData, type UpdateUserData } from '@/lib/form-schemas'
import { toastHelpers } from '@/lib/toast-helpers'
import apiClient from '@/api/client'
import type { User, Location } from '@/types'
import { X, Shield } from 'lucide-react'

interface UserFormProps {
  user?: User // If provided, we're editing; otherwise creating
  onSuccess?: () => void
  onCancel?: () => void
  mode?: 'create' | 'edit'
}

export function UserForm({ user, onSuccess, onCancel, mode = 'create' }: UserFormProps) {
  const queryClient = useQueryClient()
  const isEditing = mode === 'edit' && user

  // Fetch locations for the dropdown
  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => apiClient.getLocations(),
  })
  const locations: Location[] = Array.isArray(locationsData)
    ? locationsData
    : Array.isArray((locationsData as any)?.data)
      ? (locationsData as any).data
      : []

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
        location_id: user.location_id || '',
      }
    : {
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'server' as const,
        pin: '',
        location_id: '',
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
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          {isEditing ? 'Edit User' : 'Create New User'}
        </CardTitle>
        {onCancel && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information */}
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

            {/* Account Information */}
            <div className="space-y-4">
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

            {/* Role Selection */}
            <SelectField
              control={form.control}
              name="role"
              label="Role"
              placeholder="Select user role"
              options={roleOptions}
              description="Determines what features the user can access"
            />

            {/* Location Assignment */}
            {locations.length > 0 && (
              <SelectField
                control={form.control}
                name="location_id"
                label="Location"
                placeholder="Select assigned location"
                options={[
                  { value: '', label: 'No specific location (org-level)' },
                  ...locations
                    .filter((l) => l.is_active)
                    .map((l) => ({ value: l.id, label: `${l.name} (${l.code})` })),
                ]}
                description="Branch this staff member is assigned to"
              />
            )}

            {/* PIN */}
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

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <FormSubmitButton
                isLoading={isLoading}
                loadingText={isEditing ? "Updating..." : "Creating..."}
                className="flex-1"
              >
                {isEditing ? 'Update User' : 'Create User'}
              </FormSubmitButton>
              
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
