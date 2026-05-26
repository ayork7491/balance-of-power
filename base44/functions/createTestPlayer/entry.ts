/**
 * createTestPlayer — Admin-only endpoint to create test player accounts.
 * CRITICAL: Only accessible by workspace admins. Creates users with test credentials.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { email, display_name, role = 'user' } = await req.json();

    if (!email || !display_name) {
      return Response.json({ error: 'email and display_name are required' }, { status: 400 });
    }

    // Check if user already exists
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
    if (existingUsers.length > 0) {
      return Response.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // Generate test password
    const testPassword = `Test${Math.random().toString(36).slice(-8)}!`;

    // Create user account
    const newUser = await base44.asServiceRole.entities.User.create({
      email,
      full_name: display_name,
      role,
    });

    // Note: We can't set password directly via entity creation
    // Admin will need to use password reset or invite flow
    return Response.json({ 
      success: true, 
      user: { 
        id: newUser.id, 
        email: newUser.email, 
        full_name: newUser.full_name,
        role: newUser.role 
      },
      note: 'User created. Use invite flow or password reset to set credentials.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});