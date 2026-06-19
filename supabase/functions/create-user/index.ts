import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get the authorization header to verify the caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the caller is an admin
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if caller has admin or branch manager role
    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role, is_global')
      .eq('user_id', callerUser.id)
      .in('role', ['admin', 'branch_manager'])
      .limit(1)
      .maybeSingle()

    if (!callerRole) {
      return new Response(
        JSON.stringify({ error: 'Only admins or branch managers can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { email, password, full_name, phone, role, is_global, selectedBranches, primaryBranchId, selectedPermissions } = await req.json()

    if (callerRole.role === 'branch_manager') {
      if (is_global || ['admin', 'branch_manager'].includes(role)) {
        return new Response(
          JSON.stringify({ error: 'Branch managers cannot create global admins or branch managers' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: callerBranches } = await supabaseAdmin
        .from('user_branch_assignments')
        .select('branch_id')
        .eq('user_id', callerUser.id)

      const allowedBranchIds = (callerBranches || []).map((branch: any) => branch.branch_id)
      const requestedBranches = selectedBranches || []
      const hasForbiddenBranch = requestedBranches.some((branchId: string) => !allowedBranchIds.includes(branchId))

      if (hasForbiddenBranch) {
        return new Response(
          JSON.stringify({ error: 'Branch managers can only assign users to their own branches' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Validate required fields
    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, full_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the user using admin API (won't affect current session)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const newUserId = userData.user.id

    // Update profile with phone
    if (phone) {
      await supabaseAdmin
        .from('profiles')
        .update({ phone })
        .eq('id', newUserId)
    }

    // Update user role (trigger already creates a default 'user' role)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .update({
        role: role || 'user',
        is_global: is_global || false
      })
      .eq('user_id', newUserId)

    if (roleError) {
      console.error('Error updating role:', roleError)
      // If update fails, try insert (in case trigger didn't fire)
      const { error: insertRoleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: newUserId,
          role: role || 'user',
          is_global: is_global || false
        })
      
      if (insertRoleError) {
        console.error('Error inserting role:', insertRoleError)
      }
    }

    console.log(`User ${newUserId} created with role: ${role}, is_global: ${is_global}`)

    // Insert branch assignments
    if (selectedBranches && selectedBranches.length > 0) {
      const branchAssignments = selectedBranches.map((branchId: string) => ({
        user_id: newUserId,
        branch_id: branchId,
        is_primary: branchId === primaryBranchId
      }))

      const { error: branchError } = await supabaseAdmin
        .from('user_branch_assignments')
        .insert(branchAssignments)

      if (branchError) {
        console.error('Error inserting branch assignments:', branchError)
      }
    }

    if (Array.isArray(selectedPermissions) && selectedPermissions.length > 0) {
      const customPermissions = selectedPermissions.map((permissionId: string) => ({
        user_id: newUserId,
        permission_id: permissionId,
        branch_id: null,
        is_granted: true,
      }))

      const { error: permissionsError } = await supabaseAdmin
        .from('user_permissions')
        .insert(customPermissions)

      if (permissionsError) {
        console.error('Error inserting user permissions:', permissionsError)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: newUserId, email: userData.user.email } 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})