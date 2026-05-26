/**
 * JoinCampaign — players join via invite code or accept pending invites.
 * Data: useMyInvites hook + requestToJoinByCode.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Bell, Loader2, AlertTriangle, Check, X, ChevronRight } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/ui/EmptyState';
import PlayerSetupPanel from '@/components/campaigns/lobby/PlayerSetupPanel';
import { useMyInvites, requestToJoinByCode, acceptInviteAndJoin, respondToInvite } from '@/features/campaigns';
import { base44 } from '@/api/base44Client';
import { PLAYER_COLORS } from '@/config/theme';

function InviteCard({ invite, onAccept, onDecline, busy }) {
  return (
    <div className="p-4 space-y-3 border-b border-border last:border-0">
      <div>
        <p className="font-display text-sm font-semibold tracking-wider text-foreground">{invite.campaign_name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Invited by <span className="text-foreground">{invite.invited_by_name}</span>
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onAccept(invite)}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded bg-status-locked/20 text-status-locked border border-status-locked/30 text-xs font-display tracking-wider uppercase hover:bg-status-locked/30 transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Accept
        </button>
        <button
          onClick={() => onDecline(invite.id)}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded bg-destructive/10 text-destructive border border-destructive/30 text-xs font-display tracking-wider uppercase hover:bg-destructive/20 transition-colors disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" /> Decline
        </button>
      </div>
    </div>
  );
}

export default function JoinCampaign() {
  const navigate = useNavigate();
  const { invites, loading: loadingInvites, reload: reloadInvites } = useMyInvites();

  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState(null);
  const [codeSuccess, setCodeSuccess] = useState(null);

  const [acceptingInvite, setAcceptingInvite] = useState(null); // the invite being accepted
  const [busyInviteId, setBusyInviteId] = useState(null);

  // Player setup for invite acceptance
  const [playerName, setPlayerName] = useState('');
  const [playerColor, setPlayerColor] = useState('cobalt');
  const [setupError, setSetupError] = useState(null);
  const [setupSaving, setSetupSaving] = useState(false);

  const handleCodeSubmit = async () => {
    if (!code.trim()) { setCodeError('Enter an invite code.'); return; }
    setCodeLoading(true);
    setCodeError(null);
    try {
      const campaign = await requestToJoinByCode(code.trim(), message.trim());
      setCodeSuccess(`Join request sent to "${campaign.name}". The admin will approve it shortly.`);
      setCode('');
      setMessage('');
    } catch (err) {
      setCodeError(err.message || 'Failed to send join request.');
    } finally {
      setCodeLoading(false);
    }
  };

  const handleStartAccept = async (invite) => {
    // Pre-fill name from user profile
    const user = await base44.auth.me();
    setPlayerName(user.display_name || user.full_name || '');
    setPlayerColor(user.default_color || 'cobalt');
    setAcceptingInvite(invite);
  };

  const handleConfirmAccept = async () => {
    if (!playerName.trim()) { setSetupError('Enter a display name.'); return; }
    setSetupSaving(true);
    setSetupError(null);
    try {
      await acceptInviteAndJoin(acceptingInvite, {
        display_name: playerName.trim(),
        color: playerColor,
      });
      reloadInvites();
      setAcceptingInvite(null);
      navigate(`/campaigns/${acceptingInvite.campaign_id}/lobby`);
    } catch (err) {
      setSetupError(err.message || 'Failed to join campaign.');
    } finally {
      setSetupSaving(false);
    }
  };

  const handleDecline = async (inviteId) => {
    setBusyInviteId(inviteId);
    try { await respondToInvite(inviteId, false); reloadInvites(); }
    finally { setBusyInviteId(null); }
  };

  // Player setup modal for accepting an invite
  if (acceptingInvite) {
    return (
      <AppShell showBack title="Join Campaign">
        <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
          <div className="panel">
            <div className="panel-header">
              <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground">
                Set Up Your Commander — {acceptingInvite.campaign_name}
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                  Display Name in Campaign
                </label>
                <input
                  value={playerName}
                  onChange={e => { setPlayerName(e.target.value); setSetupError(null); }}
                  placeholder="Commander name…"
                  maxLength={32}
                  className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {/* Color */}
              <div className="space-y-2">
                <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Player Color</label>
                <div className="flex flex-wrap gap-2">
                  {PLAYER_COLORS.map(pc => (
                    <button
                      key={pc.id}
                      type="button"
                      onClick={() => setPlayerColor(pc.id)}
                      title={pc.label}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${playerColor === pc.id ? 'border-white scale-110 ring-2 ring-white/40' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: pc.hex }}
                    />
                  ))}
                </div>
              </div>

              {setupError && (
                <div className="flex items-center gap-2 p-2 rounded border border-destructive/40 bg-destructive/5">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">{setupError}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setAcceptingInvite(null)}
                  className="px-4 py-2 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAccept}
                  disabled={setupSaving}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {setupSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {setupSaving ? 'Joining…' : 'Join Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell showBack title="Join Campaign">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* Via invite code */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <LogIn className="w-3.5 h-3.5" /> Join by Invite Code
            </h2>
          </div>
          <div className="p-4 space-y-4">
            {codeSuccess ? (
              <div className="flex items-start gap-2 p-3 rounded border border-status-locked/40 bg-status-locked/5">
                <Check className="w-3.5 h-3.5 text-status-locked shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-status-locked">{codeSuccess}</p>
                  <button onClick={() => setCodeSuccess(null)} className="mt-2 text-xs text-muted-foreground hover:text-foreground underline">
                    Send another request
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Invite Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setCodeError(null); }}
                    onKeyDown={e => e.key === 'Enter' && handleCodeSubmit()}
                    placeholder="e.g. ABC123"
                    maxLength={8}
                    className={`w-full bg-input border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono tracking-widest ${codeError ? 'border-destructive' : 'border-border'}`}
                  />
                  {codeError && <p className="text-xs text-destructive">{codeError}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                    Message <span className="text-muted-foreground/50">(optional)</span>
                  </label>
                  <input
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="e.g. Hey, it's Dave from the group…"
                    maxLength={120}
                    className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground">A join request will be sent to the campaign admin for approval.</p>
                <button
                  onClick={handleCodeSubmit}
                  disabled={codeLoading || !code.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {codeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                  {codeLoading ? 'Sending…' : 'Send Join Request'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Pending invites */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Bell className="w-3.5 h-3.5" />
              Pending Invites
              {invites.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-status-pending/20 text-status-pending text-xs">
                  {invites.length}
                </span>
              )}
            </h2>
          </div>
          {loadingInvites ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading invites…
            </div>
          ) : invites.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No pending invites"
              description="Campaign invitations will appear here."
            />
          ) : (
            invites.map(invite => (
              <InviteCard
                key={invite.id}
                invite={invite}
                onAccept={handleStartAccept}
                onDecline={handleDecline}
                busy={busyInviteId === invite.id}
              />
            ))
          )}
        </div>

      </div>
    </AppShell>
  );
}