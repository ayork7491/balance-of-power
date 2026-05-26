/**
 * createTestPlayer — Create test player accounts.
 * ACCESS CONTROL: Platform admins only (user.role === 'admin')
 * 
 * RULES:
 *   - Only platform admins can create test users
 *   - Test players ALWAYS created with role='user' (never admin)
 *   - Campaign admins CANNOT create global users (use campaign invite flow instead)
 *   - This is for creating test accounts, not for adding players to campaigns
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Platform admin only - campaign admins cannot create global users
    if (user.role !== 'admin') {
      return Response.json({ error: 'Platform admin access required' }, { status: 403 });
    }

    const { email, display_name } = await req.json();

    if (!email || !display_name) {
      return Response.json({ error: 'email and display_name are required' }, { status: 400 });
    }

    // Check if user already exists
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
    if (existingUsers.length > 0) {
      return Response.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // Create user account - ALWAYS role='user' (never admin)
    // Campaign admins should use invite flow to add players to their campaigns
    const newUser = await base44.asServiceRole.entities.User.create({
      email,
      full_name: display_name,
      role: 'user', // Hardcoded - test players are never admins
    });

    // Note: We can't set password directly via entity creation
    // Admin will need to use invite flow or password reset
    return Response.json({ 
      success: true, 
      user: { 
        id: newUser.id, 
        email: newUser.email, 
        full_name: newUser.full_name,
        role: newUser.role 
      },
      note: 'Test user created with role="user". Use invite flow or password reset to set credentials. Campaign admins should use invite flow instead of this endpoint.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});