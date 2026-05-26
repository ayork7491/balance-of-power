/**
 * addCampaignTestPlayer — Add a test player directly to a campaign.
 * ACCESS CONTROL: Campaign admins or platform admins only.
 * 
 * RULES:
 *   - Creates a CampaignPlayer record with is_test_player: true
 *   - Does NOT require a real user account (uses placeholder user_id)
 *   - Test players have unique colors, names, and can be ready/unready
 *   - Only works when campaign status is 'lobby'
 *   - Test players are removed when campaign starts or is deleted
 * 
 * TEST PLAYER REPRESENTATION:
 *   - user_id: "test_player_{timestamp}" (placeholder, not a real User.id)
 *   - is_test_player: true (flag to identify test players)
 *   - Can be kicked/removed by admin at any time during lobby phase
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaign_id, display_name, color } = await req.json();

    if (!campaign_id || !display_name || !color) {
      return Response.json({ error: 'campaign_id, display_name, and color are required' }, { status: 400 });
    }

    // Load campaign to check admin status and phase
    const campaign = await base44.entities.Campaign.get(campaign_id);
    if (!campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check if campaign is in lobby phase
    if (campaign.status !== 'lobby') {
      return Response.json({ error: 'Test players can only be added during lobby phase' }, { status: 400 });
    }

    // Verify admin access (campaign admin or platform admin)
    const isAdmin = user.role === 'admin' || campaign.admin_user_id === user.id;
    if (!isAdmin) {
      return Response.json({ error: 'Campaign admin access required' }, { status: 403 });
    }

    // Check if color is already taken
    const existingPlayers = await base44.entities.CampaignPlayer.filter({ campaign_id });
    if (existingPlayers.some(p => p.color === color)) {
      return Response.json({ error: 'This color is already taken' }, { status: 409 });
    }

    // Check max players limit
    const maxPlayers = campaign.settings?.max_players ?? 6;
    if (existingPlayers.length >= maxPlayers) {
      return Response.json({ error: `Maximum player count (${maxPlayers}) reached` }, { status: 409 });
    }

    // Create test player with placeholder user_id
    const testPlayerId = `test_player_${Date.now()}`;
    const newTestPlayer = await base44.entities.CampaignPlayer.create({
      campaign_id,
      user_id: testPlayerId, // Placeholder - not a real User.id
      display_name,
      color,
      is_test_player: true, // Flag to identify test players
      test_player_created_by_user_id: user.id, // Track which admin created this test player
      test_player_label: display_name, // Use display name as initial label
      is_admin: false,
      is_ready: false,
      faction_name: null,
      troop_count: 0,
      is_eliminated: false,
    });

    return Response.json({ 
      success: true, 
      player: {
        id: newTestPlayer.id,
        campaign_id: newTestPlayer.campaign_id,
        user_id: newTestPlayer.user_id,
        display_name: newTestPlayer.display_name,
        color: newTestPlayer.color,
        is_test_player: newTestPlayer.is_test_player,
        is_ready: newTestPlayer.is_ready,
        is_admin: newTestPlayer.is_admin,
      },
      note: 'Test player added to campaign lobby. Test players are removed when campaign starts.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});