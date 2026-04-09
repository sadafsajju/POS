import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the caller is authenticated and is admin/manager
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a client with the caller's JWT to verify their identity
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ success: false, message: `Unauthorized: ${authError?.message || 'No user found'}` }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check caller's role from app_metadata
    const callerRole = caller.app_metadata?.role
    if (callerRole !== 'admin' && callerRole !== 'manager') {
      return new Response(
        JSON.stringify({ success: false, message: `Only admins and managers can invite staff (your role: ${callerRole || 'none'})` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callerOrgId = caller.app_metadata?.org_id
    if (!callerOrgId) {
      return new Response(
        JSON.stringify({ success: false, message: 'No organization found for caller' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email, role, location_ids } = await req.json()

    if (!email || !role) {
      return new Response(
        JSON.stringify({ success: false, message: 'Email and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const validRoles = ['admin', 'manager', 'server', 'counter', 'kitchen']
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ success: false, message: `Invalid role. Must be one of: ${validRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service_role client to create the auth user and send invite
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check if email already exists in the org
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('org_id', callerOrgId)
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({ success: false, message: 'A user with this email already exists in your organization' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine redirect URL for the magic link
    const origin = req.headers.get('Origin') || Deno.env.get('SITE_URL') || ''
    const redirectTo = `${origin}/staff-onboarding`

    // Invite user via Supabase Auth (sends magic link email)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        invited_role: role,
        invited_org_id: callerOrgId,
        invited_location_ids: location_ids || [],
      },
    })

    if (inviteError) {
      return new Response(
        JSON.stringify({ success: false, message: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a pending user record in public.users
    const authUserId = inviteData.user.id
    const primaryLocationId = location_ids?.[0] || null

    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        auth_user_id: authUserId,
        username: email.split('@')[0],
        email,
        first_name: '',
        last_name: '',
        role,
        is_active: false, // Activated after onboarding
        org_id: callerOrgId,
        location_id: primaryLocationId,
        auth_provider: 'supabase',
      })
      .select()
      .single()

    if (insertError) {
      // Cleanup: delete the auth user if we can't create the public record
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
      return new Response(
        JSON.stringify({ success: false, message: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create location assignments
    if (location_ids && location_ids.length > 0) {
      const assignments = location_ids.map((locId: string, i: number) => ({
        user_id: newUser.id,
        location_id: locId,
        is_primary: i === 0,
      }))
      await supabaseAdmin.from('user_location_assignments').insert(assignments)
    }

    // Set app_metadata on the auth user so the JWT hook picks it up
    await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      app_metadata: {
        org_id: callerOrgId,
        role,
        location_id: primaryLocationId,
        user_id: newUser.id,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation sent to ${email}`,
        data: {
          id: newUser.id,
          email,
          role,
          auth_user_id: authUserId,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
