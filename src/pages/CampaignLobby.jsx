/**
 * CampaignLobby — pre-game lobby. Players ready up, admin starts campaign.
 * Data: useCampaign hook (real-time player subscription).
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Users, Play, Loader2, AlertTriangle, RefreshCw, Settings, Bell, Check, X, Trash2, FlaskConical, Eye, User, Link as LinkIcon, TestTube } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/ui/EmptyState';
import PlayerSlot from '@/components/campaigns/lobby/PlayerSlot';
import PlayerSetupPanel from '@/components/campaigns/lobby/PlayerSetupPanel';
import InvitePanel from '@/components/campaigns/lobby/InvitePanel';
import ConfirmCleanupModal from '@/components/campaigns/ConfirmCleanupModal';
import { useCampaign, setPlayerReady, startCampaign, kickPlayer, cleanupCampaign } from '@/features/campaigns';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';

export default function CampaignLobby() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campaign, players, invites, myPlayer, loading, error, reload } = useCampaign(id);
  const [userId, setUserId] = useState(null);
  const [activeTab, setActiveTab]   = useState('players'); // players | setup | invites
  const [actionError, setActionError] = useState(null);
  const [starting, setStarting]     = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentPerspective, setCurrentPerspective] = useState(null); // For admin test mode in lobby
  const [actingAsPlayerId, setActingAsPlayerId] = useState(null); // Action delegation in lobby

  useEffect(() => {
    base44.auth.me().then(u => setUserId(u?.id));
  }, []);

  // Redirect if campaign already started
  useEffect(() => {
    if (campaign && campaign.status === 'active') {
      navigate(`/campaigns/${id}`, { replace: true });
    }
  }, [campaign, id, navigate]);

  if (loading) {
    return (
      <AppShell showBack title="Loading lobby…">
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground text-xs">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  if (error || !campaign) {
    return (
      <AppShell showBack title="Error">
        <div className="max-w-xl mx-auto px-4 py-10">
          <div className="flex items-start gap-3 p-4 rounded border border-destructive/40 bg-destructive/5">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-destructive">{error ?? 'Campaign not found.'}</p>
              <button onClick={reload} className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const isAdmin = myPlayer?.is_admin ?? false;
  const joinRequests = invites.filter(i => i.type === 'join_request' && i.status === 'pending');
  const readyCount = players.filter(p => p.is_ready).length;
  const canStart = isAdmin && players.length >= 2 && players.every(p => p.is_ready);
  const hasTestPlayers = players?.some(p => p.is_test_player) === true;
  const showPerspectiveSelector = isAdmin && (campaign?.status === 'lobby' || hasTestPlayers);
  
  // Acting As available for: test campaigns, test players, or admin override
  const isTestCampaign = campaign?.name.toLowerCase().includes('test');
  const availableActingAsPlayers = players.filter(p => 
    p.user_id === userId || // Own player
    p.is_test_player || // Test players
    isTestCampaign // All players in test campaign
  );

  const handleToggleReady = async () => {
    if (!myPlayer) return;
    setActionError(null);
    try {
      await setPlayerReady(myPlayer.id, !myPlayer.is_ready);
    } catch { setActionError('Failed to update ready status.'); }
  };

  const handleStart = async () => {
    setActionError(null);
    setStarting(true);
    try {
      await startCampaign(campaign.id, userId, players);
      navigate(`/campaigns/${id}`);
    } catch (err) {
      setActionError(err.message || 'Failed to start campaign. Please try again.');
      setStarting(false);
    }
  };

  const handleKick = async (player) => {
    if (!confirm(`Remove ${player.display_name} from the campaign?`)) return;
    setActionError(null);
    try {
      await kickPlayer(player.id);
      reload();
    } catch { setActionError('Failed to remove player.'); }
  };

  const s = campaign.settings ?? {};

  return (
    <AppShell>
      {/* Custom top bar with perspective selector for lobby */}
      <div className="h-11 bg-panel-header border-b border-panel-border flex items-center px-3 sm:px-4 gap-3 shrink-0">
        <Link to="/" className="flex items-center gap-2 shrink-0 group touch-manipulation active:scale-95 transition-transform" title="Back to Dashboard">
          <Shield className="w-4 h-4 text-primary group-hover:brightness-125 transition-all" />
          <span className="font-mono text-xs font-bold tracking-widest text-primary uppercase hidden xs:block">BoP</span>
        </Link>
        <div className="w-px h-5 bg-border shrink-0" />
        <span className="font-display text-sm font-semibold tracking-wide text-foreground truncate">{campaign.name}</span>
        <div className="flex-1" />
        
        {/* Admin Test Mode controls (Viewing As + Acting As) */}
        {showPerspectiveSelector && players.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {/* Viewing As selector */}
            <div className="flex items-center gap-1.5 bg-muted/10 border border-border px-2 py-1 rounded">
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider hidden sm:inline">Viewing As</span>
              <Select value={currentPerspective?.id || 'admin'} onValueChange={(val) => {
                const player = val === 'admin' ? null : players.find(p => p.id === val);
                setCurrentPerspective(player);
              }}>
                <SelectTrigger className="h-7 text-xs w-32 sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3 h-3" /> Admin / My View
                    </span>
                  </SelectItem>
                  {players.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: player.color ? `hsl(var(--${player.color}))` : '#888' }} />
                        {player.display_name} {player.is_test_player && ' (Test)'}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Acting As selector (action delegation) */}
            <div className="flex items-center gap-1.5 bg-status-pending/10 border border-status-pending/40 px-2 py-1 rounded">
              <TestTube className="w-3.5 h-3.5 text-status-pending" />
              <span className="text-[10px] text-status-pending uppercase tracking-wider hidden sm:inline">Acting As</span>
              <Select value={actingAsPlayerId || 'admin'} onValueChange={(val) => {
                setActingAsPlayerId(val === 'admin' ? null : val);
              }}>
                <SelectTrigger className="h-7 text-xs w-32 sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3 h-3" /> My Player
                    </span>
                  </SelectItem>
                  {availableActingAsPlayers.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: player.color ? `hsl(var(--${player.color}))` : '#888' }} />
                        {player.display_name} {player.is_test_player && ' (Test)'}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Link
              to={`/campaigns/${id}/admin`}
              className="flex items-center gap-1 bg-status-pending/20 border border-status-pending/40 text-status-pending px-2 py-0.5 rounded text-xs font-display tracking-wider uppercase shrink-0 hover:brightness-125 transition-all"
              title="Open Admin Test Mode"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin Mode</span>
            </Link>
          </div>
        )}
      </div>
      
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Campaign summary */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" /> Campaign Details
            </h2>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Info label="Game" value={campaign.game_profile_name || '—'} />
            <Info label="Map" value={campaign.map_id === 'map_v1_standard' ? 'Standard V1' : (campaign.map_id || '—')} />
            <Info label="Schedule" value={s.phase_schedule ? capitalize(s.phase_schedule) : '—'} />
            <Info label="Max Players" value={s.max_players ?? '—'} />
          </div>
          {campaign.description && (
            <p className="px-4 pb-4 text-xs text-muted-foreground">{campaign.description}</p>
          )}
        </div>

        {/* Error */}
        {actionError && (
          <div className="flex items-center gap-2 p-3 rounded border border-destructive/40 bg-destructive/5">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive flex-1">{actionError}</p>
            <button onClick={() => setActionError(null)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex border-b border-border gap-0">
          {[
            { id: 'players', label: `Players (${players.length})`, icon: Users },
            myPlayer && { id: 'setup', label: 'My Setup', icon: Settings },
            isAdmin && { id: 'invites', label: `Invites${joinRequests.length > 0 ? ` (${joinRequests.length})` : ''}`, icon: Bell },
          ].filter(Boolean).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-display tracking-wider uppercase border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === 'invites' && joinRequests.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-status-pending text-primary-foreground text-xs flex items-center justify-center font-bold">
                  {joinRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="panel">
          {activeTab === 'players' && (
            <>
              <div className="panel-header flex items-center justify-between">
                <p className="font-display text-xs tracking-widest uppercase text-muted-foreground">
                  {readyCount}/{players.length} Ready
                </p>
                {myPlayer && (
                  <button
                    onClick={handleToggleReady}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-display tracking-wider uppercase transition-all ${
                      myPlayer.is_ready
                        ? 'bg-status-locked/20 text-status-locked border border-status-locked/40 hover:bg-status-locked/30'
                        : 'bg-primary text-primary-foreground hover:brightness-110'
                    }`}
                  >
                    {myPlayer.is_ready ? <><Check className="w-3 h-3" /> Ready</> : 'Mark Ready'}
                  </button>
                )}
              </div>
              {players.length === 0 ? (
                <EmptyState icon={Users} title="No players yet" description="Invite players using the Invites tab." />
              ) : (
                players.map(p => (
                  <PlayerSlot
                    key={p.id}
                    player={p}
                    isMe={p.user_id === userId}
                    canKick={isAdmin}
                    onKick={handleKick}
                  />
                ))
              )}
            </>
          )}

          {activeTab === 'setup' && myPlayer && (
            <div className="p-4">
              <PlayerSetupPanel
                myPlayer={myPlayer}
                players={players}
                gameProfile={null}
                onUpdated={reload}
              />
            </div>
          )}

          {activeTab === 'invites' && isAdmin && (
            <div className="p-4">
              <InvitePanel
                campaign={campaign}
                invites={invites}
                players={players}
                onRefresh={reload}
              />
            </div>
          )}
        </div>

        {/* Danger zone — admin only, lobby status only */}
        {isAdmin && campaign.status === 'lobby' && (
          <div className="panel border-destructive/30">
            <div className="panel-header flex items-center justify-between">
              <p className="font-display text-xs tracking-widest uppercase text-destructive/70">Danger Zone</p>
            </div>
            <div className="p-4 flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                Permanently delete this campaign and all its player slots and invites.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded border border-destructive/50 text-destructive text-xs font-display tracking-wider uppercase hover:bg-destructive/10 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Campaign
              </button>
            </div>
          </div>
        )}

        {/* Admin tools — admin only, lobby status only */}
        {isAdmin && (
          <div className="panel border-status-pending/30">
            <div className="panel-header flex items-center justify-between">
              <p className="font-display text-xs tracking-widest uppercase text-status-pending/70 flex items-center gap-2">
                <FlaskConical className="w-3.5 h-3.5" /> Test Mode
              </p>
            </div>
            <div className="p-4 flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                Create test players and simulate campaign setup for testing.
              </p>
              <button
                onClick={() => navigate(`/campaigns/${id}/admin`)}
                className="flex items-center gap-1.5 px-3 py-2 rounded border border-status-pending/50 text-status-pending text-xs font-display tracking-wider uppercase hover:bg-status-pending/10 transition-colors shrink-0"
              >
                <Settings className="w-3.5 h-3.5" /> Open Admin Mode
              </button>
            </div>
          </div>
        )}

        {/* Start campaign — admin only */}
        {isAdmin && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {!canStart
                ? players.length < 2
                  ? 'At least 2 players needed to start.'
                  : 'All players must be ready before starting.'
                : 'All players are ready. The campaign can be started.'}
            </p>
            <button
              onClick={handleStart}
              disabled={!canStart || starting}
              className={`flex items-center gap-2 px-6 py-3 rounded text-xs font-display tracking-widest uppercase transition-all ${
                canStart
                  ? 'bg-primary text-primary-foreground hover:brightness-110 glow-primary'
                  : 'bg-primary/20 text-primary-foreground/40 border border-primary/20 cursor-not-allowed'
              }`}
            >
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {starting ? 'Starting…' : 'Start Campaign'}
            </button>
          </div>
        )}

      </div>

      {showDeleteModal && (
        <ConfirmCleanupModal
          campaign={campaign}
          onConfirm={async () => {
            await cleanupCampaign(campaign.id, userId);
            setShowDeleteModal(false);
            navigate('/');
          }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </AppShell>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}