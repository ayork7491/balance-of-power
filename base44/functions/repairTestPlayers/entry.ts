/**
 * repairTestPlayers — Migration helper to fix existing test players missing is_test_player field.
 * ACCESS CONTROL: Platform admins only.
 * 
 * This function scans all CampaignPlayer records and fixes test players created before
 * the schema was updated to include is_test_player.
 * 
 * REPAIR LOGIC:
 *   - If user_id starts with 'test_player_' but is_test_player is false/missing → set is_test_player: true
 *   - If display_name matches test player pattern (Test Player Alpha, etc.) → set is_test_player: true
 *   - Add test_player_label if missing
 * 
 * Safe to run multiple times (idempotent).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Platform admin only
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Platform admin access required' }, { status: 403 });
    }

    // Load all CampaignPlayer records
    const allPlayers = await base44.asServiceRole.entities.CampaignPlayer.filter({});
    
    const repaired = [];
    const errors = [];

    for (const player of allPlayers) {
      try {
        const isTestPlayerById = player.is_test_player === true;
        const isTestPlayerByUserId = player.user_id && player.user_id.startsWith('test_player_');
        const isTestPlayerByName = /Test Player/i.test(player.display_name);
        
        // Determine if this should be a test player
        const shouldBeTestPlayer = isTestPlayerById || isTestPlayerByUserId || isTestPlayerByName;
        
        if (shouldBeTestPlayer && !isTestPlayerById) {
          // Repair: set is_test_player to true
          const updates = { is_test_player: true };
          
          // Add test_player_label if missing
          if (!player.test_player_label) {
            updates.test_player_label = player.display_name;
          }
          
          // Add test_player_created_by_user_id if we can infer it
          if (!player.test_player_created_by_user_id && player.user_id) {
            // Try to extract admin ID from user_id pattern if available
            // Format: test_player_{timestamp}_{adminUserId} (if such pattern exists)
            // For now, leave null - admin can be manually assigned if needed
          }
          
          await base44.asServiceRole.entities.CampaignPlayer.update(player.id, updates);
          
          repaired.push({
            player_id: player.id,
            campaign_id: player.campaign_id,
            display_name: player.display_name,
            user_id: player.user_id,
            reason: isTestPlayerByUserId ? 'user_id pattern' : 'name pattern',
          });
        }
      } catch (err) {
        errors.push({
          player_id: player.id,
          error: err.message,
        });
      }
    }

    return Response.json({
      success: true,
      summary: {
        total_scanned: allPlayers.length,
        total_repaired: repaired.length,
        total_errors: errors.length,
      },
      repaired,
      errors: errors.length > 0 ? errors : undefined,
      note: 'Test players now have is_test_player: true and will work with admin ready controls.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});