import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Form, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { PinInput } from '@/components/ui/pin-input'
import {
  TextInputField,
  SelectField,
  FormSubmitButton,
  roleOptions
} from '@/components/forms/FormComponents'
import { LocationMultiSelectField } from '@/components/forms/LocationMultiSelectField'
import { updateUserSchema, type UpdateUserData } from '@/lib/form-schemas'
import { emailSchema, userRoleSchema } from '@/lib/form-schemas'
import { toastHelpers } from '@/lib/toast-helpers'
import apiClient from '@/api/client'
import type { User } from '@/types'
import { Shield, Mail } from 'lucide-react'

// Invite schema — just email, role, locations
const inviteStaffSchema = z.object({
  email: emailSchema,
  email_confirmation: emailSchema,
  role: userRoleSchema,
  location_ids: z.array(z.string()).optional(),
}).refine((data) => data.email === data.email_confirmation, {
  message: "Email addresses don't match",
  path: ["email_confirmation"],
})

type InviteStaffData = z.infer<typeof inviteStaffSchema>

interface UserFormProps {
  user?: User // If provided, we're editing; otherwise inviting
  onSuccess?: () => void
  onCancel?: () => void
  mode?: 'create' | 'edit'
}

export function UserForm({ user, onSuccess, onCancel, mode = 'create' }: UserFormProps) {
  const isEditing = mode === 'edit' && user

  if (isEditing) {
    return (
      <EditUserForm
        user={user}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    )
  }

  return (
    <InviteStaffForm
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  )
}

// ── Invite Form (Create) ─────────────────────────────────────────────────────

function InviteStaffForm({ onSuccess, onCancel }: { onSuccess?: () => void; onCancel?: () => void }) {
  const queryClient = useQueryClient()

  const form = useForm<InviteStaffData>({
    resolver: zodResolver(inviteStaffSchema),
    defaultValues: {
      email: '',
      email_confirmation: '',
      role: 'server',
      location_ids: [],
    },
  })

  const inviteMutation = useMutation({
    mutationFn: (data: InviteStaffData) => apiClient.inviteStaff({
      email: data.email,
      role: data.role,
      location_ids: data.location_ids,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toastHelpers.apiSuccess('Invite', `Invitation sent to ${form.getValues('email')}`)
      form.reset()
      onSuccess?.()
    },
    onError: (error) => {
      toastHelpers.apiError('Invite staff', error)
    },
  })

  const onSubmit = (data: InviteStaffData) => {
    inviteMutation.mutate(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto bg-zinc-950">
          <div className="max-w-3xl mx-auto p-6 space-y-4">

            {/* Info banner */}
            <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
              <p className="text-sm text-blue-400 flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  <span className="font-semibold">Magic Link Invite: </span>
                  Staff will receive an email with a link to set up their name, password, and PIN.
                </span>
              </p>
            </div>

            {/* Email */}
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300">Staff Email</h3>
              </div>
              <div className="p-5 space-y-4">
                <TextInputField
                  control={form.control}
                  name="email"
                  label="Email Address"
                  type="email"
                  placeholder="staff@example.com"
                  autoComplete="email"
                  description="Invitation email will be sent here"
                />
                <TextInputField
                  control={form.control}
                  name="email_confirmation"
                  label="Confirm Email Address"
                  type="email"
                  placeholder="Re-enter email address"
                  autoComplete="email"
                  description="Must match the email address above"
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
                  description="Determines what features the staff member can access"
                />
                <LocationMultiSelectField
                  control={form.control}
                  name="location_ids"
                  label="Locations"
                  description="Branches this staff member can access"
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
                disabled={inviteMutation.isPending}
                className="px-4 py-2 rounded-md text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
            )}
            <FormSubmitButton
              isLoading={inviteMutation.isPending}
              loadingText="Sending Invite..."
            >
              Send Invitation
            </FormSubmitButton>
          </div>
        </div>
      </form>
    </Form>
  )
}

// ── Edit Form ────────────────────────────────────────────────────────────────

function EditUserForm({ user, onSuccess, onCancel }: { user: User; onSuccess?: () => void; onCancel?: () => void }) {
  const queryClient = useQueryClient()

  const form = useForm<UpdateUserData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role as any,
      password: '',
      pin: '',
      location_ids: user.location_ids || [],
    },
  })

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

  const onSubmit = (data: UpdateUserData) => {
    const updateData = { ...data }
    if (!updateData.password || updateData.password.trim() === '') {
      delete updateData.password
    }
    if (!updateData.pin || updateData.pin.trim() === '') {
      delete updateData.pin
    }
    updateMutation.mutate(updateData)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto bg-zinc-950">
          <div className="max-w-3xl mx-auto p-6 space-y-4">

            {/* Personal Information */}
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300">Personal Information</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInputField control={form.control} name="first_name" label="First Name" placeholder="Enter first name" autoComplete="given-name" />
                  <TextInputField control={form.control} name="last_name" label="Last Name" placeholder="Enter last name" autoComplete="family-name" />
                </div>
              </div>
            </section>

            {/* Account Information */}
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300">Account Information</h3>
              </div>
              <div className="p-5 space-y-4">
                <TextInputField control={form.control} name="email" label="Email Address" type="email" placeholder="Enter email address" autoComplete="email" />
                <TextInputField
                  control={form.control}
                  name="password"
                  label="New Password (leave blank to keep current)"
                  type="password"
                  placeholder="Enter new password or leave blank"
                  autoComplete="new-password"
                  description="Leave blank to keep the current password"
                />
              </div>
            </section>

            {/* Role & Location */}
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300">Role & Location</h3>
              </div>
              <div className="p-5 space-y-4">
                <SelectField control={form.control} name="role" label="Role" placeholder="Select user role" options={roleOptions} description="Determines what features the user can access" />
                <LocationMultiSelectField control={form.control} name="location_ids" label="Locations" description="Branches this staff member can access" />
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
                        New PIN (leave blank to keep current)
                      </FormLabel>
                      <PinInput value={field.value || ''} onChange={field.onChange} autoFocus={false} error={!!form.formState.errors.pin} />
                      <FormDescription>Leave blank to keep the current PIN</FormDescription>
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
                disabled={updateMutation.isPending}
                className="px-4 py-2 rounded-md text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
            )}
            <FormSubmitButton isLoading={updateMutation.isPending} loadingText="Updating...">
              Update User
            </FormSubmitButton>
          </div>
        </div>
      </form>
    </Form>
  )
}
