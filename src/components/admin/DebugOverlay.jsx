/**
 * DebugOverlay — Toggle to show all private decision data.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, EyeOff, Shield, Sword, Castle, Users } from 'lucide-react';
import { toast } from 'sonner';

const PHASE_ICONS = {
  faction_selection: Shield,
  territory_draft: Sword,
  initial_deploy: Users,
  deploy: Castle,
  attack: Sword,
  fortify: Castle,
};

export default function DebugOverlay({ campaign, enabled, onToggle }) {
  const [decisions, setDecisions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !campaign) return;
    loadDecisions();
  }, [enabled, campaign?.id, campaign?.current_round, campaign?.current_phase]);

  const loadDecisions = async () => {
    setIsLoading(true);
    try {
      const res = await base44.functions.invoke('getAllPhaseDecisions', {
        campaign_id: campaign.id,
        round: campaign.current_round,
        phase: campaign.current_phase,
      });
      setDecisions(res.data.decisions || []);
    } catch (err) {
      toast.error('Failed to load decisions');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getPhaseIcon = (phase) => {
    const Icon = PHASE_ICONS[phase] || Shield;
    return <Icon className="w-3 h-3" />;
  };

  if (!enabled) {
    return (
      <Button onClick={onToggle} variant="outline" className="w-full h-8 text-xs">
        <EyeOff className="w-3 h-3 mr-1" />
        Enable Debug Overlay
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs font-display tracking-widest uppercase text-primary">
            Debug Overlay Active
          </p>
        </div>
        <Button onClick={onToggle} variant="ghost" size="icon" className="h-6 w-6">
          <EyeOff className="w-3 h-3" />
        </Button>
      </div>

      <div className="p-2 rounded border border-status-pending/40 bg-status-pending/10">
        <p className="text-[10px] text-status-pending font-semibold">
          ⚠️ Platform Admin Only
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Debug overlay showing all private decisions. Campaign admins can only access this in test campaigns.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing all private decision data for Round {campaign?.current_round} • {campaign?.current_phase}
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      ) : decisions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No decisions found for current phase</p>
      ) : (
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {decisions.map((decision) => (
              <div
                key={decision.id}
                className="p-2 rounded border border-border bg-muted/10 text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {getPhaseIcon(decision.phase)}
                    <span className="font-medium text-foreground">
                      {decision.player_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {decision.is_locked && (
                      <Badge variant="outline" className="h-4 text-[10px]">
                        Locked
                      </Badge>
                    )}
                    {decision.is_auto_submitted && (
                      <Badge variant="secondary" className="h-4 text-[10px]">
                        Auto
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="text-muted-foreground space-y-1 mt-1">
                  {decision.phase === 'initial_deploy' && decision.data?.placements && (
                    <>
                      <p>Placements: {Object.keys(decision.data.placements).length} territories</p>
                      <p>Troops remaining: {decision.data.troops_remaining || 0}</p>
                    </>
                  )}

                  {decision.phase === 'deploy' && decision.data?.placements && (
                    <>
                      <p>Deployments: {Object.keys(decision.data.placements).length} territories</p>
                      <p>Troops remaining: {decision.data.troops_remaining || 0}</p>
                    </>
                  )}

                  {decision.phase === 'attack' && decision.data?.attacks && (
                    <>
                      <p>Attacks: {decision.data.attacks.length}</p>
                      {decision.data.attacks.slice(0, 2).map((attack, idx) => (
                        <p key={idx} className="text-[10px] pl-2">
                          → {attack.target_territory_id} ({attack.committed_troops} troops)
                        </p>
                      ))}
                    </>
                  )}

                  {decision.phase === 'fortify' && decision.data?.movements && (
                    <>
                      <p>Movements: {decision.data.movements.length}</p>
                      {decision.data.movements.slice(0, 2).map((move, idx) => (
                        <p key={idx} className="text-[10px] pl-2">
                          → {move.destination_territory_id} ({move.committed_troops} troops)
                        </p>
                      ))}
                    </>
                  )}

                  {!decision.data || Object.keys(decision.data).length === 0 && (
                    <p>No decisions staged</p>
                  )}
                </div>

                <div className="mt-1 text-[10px] text-muted-foreground">
                  Locked: {decision.locked_at ? new Date(decision.locked_at).toLocaleString() : 'No'}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}