/**
 * InvitePanel — admin panel for sending invites and managing join requests.
 */
import { useState } from 'react';
import { Mail, Plus, X, Check, Clock, Loader2, UserCheck, UserX, Copy } from 'lucide-react';
import { sendInvite, cancelInvite, approveJoinRequest, denyJoinRequest } from '@/features/campaigns';
import { PLAYER_COLORS } from '@/config/theme';

export default function InvitePanel({ campaign, invites, players, onRefresh }) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [sending, setSending] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Separate pending invites from join requests
  const pendingInvites = invites.filter(i => i.type === 'invite' && i.status === 'pending');
  const joinRequests = invites.filter(i => i.type === 'join_request' && i.status === 'pending');

  const handleSendInvite = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setEmailError('Enter a valid email.'); return; }
    if (pendingInvites.some(i => i.invitee_email === e)) { setEmailError('Already invited.'); return; }
    setSending(true);
    setEmailError(null);
    try {
      await sendInvite({ campaignId: campaign.id, campaignName: campaign.name, inviteeEmail: e });
      setEmail('');
      onRefresh();
    } catch { setEmailError('Failed to send invite.'); }
    finally { setSending(false); }
  };

  const handleCancelInvite = async (inviteId) => {
    setBusyId(inviteId);
    try { await cancelInvite(inviteId); onRefresh(); }
    finally { setBusyId(null); }
  };

  const handleApprove = async (invite) => {
    setBusyId(invite.id);
    const takenColors = players.map(p => p.color);
    const freeColor = PLAYER_COLORS.find(c => !takenColors.includes(c.id))?.id ?? 'crimson';
    try {
      await approveJoinRequest(invite, {
        display_name: invite.invited_by_name,
        color: freeColor,
      });
      onRefresh();
    } finally { setBusyId(null); }
  };

  const handleDeny = async (inviteId) => {
    setBusyId(inviteId);
    try { await denyJoinRequest(inviteId); onRefresh(); }
    finally { setBusyId(null); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(campaign.invite_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Invite code */}
      <div className="space-y-1">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Invite Code</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-muted border border-border rounded px-3 py-2 text-sm font-mono tracking-widest text-primary">
            {campaign.invite_code}
          </code>
          <button
            onClick={copyCode}
            className="px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            {codeCopied ? <Check className="w-3.5 h-3.5 text-status-locked" /> : <Copy className="w-3.5 h-3.5" />}
            {codeCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Share this code so players can request to join.</p>
      </div>

      {/* Send invite by email */}
      <div className="space-y-2">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Invite by Email</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setEmailError(null); }}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSendInvite())}
            placeholder="player@example.com"
            className={`flex-1 bg-input border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${emailError ? 'border-destructive' : 'border-border'}`}
          />
          <button
            onClick={handleSendInvite}
            disabled={sending || !email.trim()}
            className="px-3 py-2 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
        {emailError && <p className="text-xs text-destructive">{emailError}</p>}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground flex items-center gap-1.5">
            <Mail className="w-3 h-3" /> Sent Invites ({pendingInvites.length})
          </p>
          {pendingInvites.map(inv => (
            <div key={inv.id} className="flex items-center justify-between px-3 py-2 rounded border border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-status-pending" />
                <span className="text-sm text-foreground">{inv.invitee_email}</span>
              </div>
              <button
                onClick={() => handleCancelInvite(inv.id)}
                disabled={busyId === inv.id}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                {busyId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Join requests */}
      {joinRequests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-display tracking-wider uppercase text-status-pending flex items-center gap-1.5">
            <UserCheck className="w-3 h-3" /> Join Requests ({joinRequests.length})
          </p>
          {joinRequests.map(req => (
            <div key={req.id} className="p-3 rounded border border-status-pending/30 bg-status-pending/5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{req.invited_by_name}</p>
                  <p className="text-xs text-muted-foreground">{req.invitee_email}</p>
                  {req.message && <p className="text-xs text-muted-foreground mt-1 italic">"{req.message}"</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(req)}
                  disabled={busyId === req.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-status-locked/20 text-status-locked border border-status-locked/30 text-xs font-display tracking-wider uppercase hover:bg-status-locked/30 transition-colors"
                >
                  {busyId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                  Approve
                </button>
                <button
                  onClick={() => handleDeny(req.id)}
                  disabled={busyId === req.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-destructive/10 text-destructive border border-destructive/30 text-xs font-display tracking-wider uppercase hover:bg-destructive/20 transition-colors"
                >
                  <UserX className="w-3 h-3" /> Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}