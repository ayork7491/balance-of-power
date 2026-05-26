/**
 * getMyInvites — Returns only pending invites for the authenticated user.
 * Security: Filters to user's own invites, returns minimal necessary data.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch only pending invites for this user
    const allInvites = await base44.entities.CampaignInvite.list();
    const userInvites = allInvites.filter(
      i => i.invitee_user_id === user.id && i.status === 'pending'
    );

    return Response.json({ invites: userInvites });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});