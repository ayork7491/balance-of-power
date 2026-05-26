/**
 * SnapshotInspector — View and analyze campaign state snapshots.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, Map, Users, TrendingUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PlayerColorDot from '@/components/ui/PlayerColorDot';

export default function SnapshotInspector({ campaign }) {
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('territories');

  useEffect(() => {
    if (!campaign) return;
    loadSnapshots();
  }, [campaign?.id]);

  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      const res = await base44.functions.invoke('getPhaseSnapshots', {
        campaign_id: campaign.id,
        limit: 20,
      });
      setSnapshots(res.data.snapshots || []);
      if (res.data.snapshots?.length > 0) {
        setSelectedSnapshot(res.data.snapshots[0]);
      }
    } catch (err) {
      toast.error('Failed to load snapshots');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!campaign) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Camera className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-xs font-display tracking-widest uppercase text-muted-foreground">
          Snapshot Inspector
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading snapshots...
        </div>
      ) : snapshots.length === 0 ? (
        <p className="text-xs text-muted-foreground">No snapshots available</p>
      ) : (
        <div className="space-y-3">
          {/* Snapshot List */}
          <ScrollArea className="h-[120px]">
            <div className="space-y-1">
              {snapshots.map((snapshot, idx) => (
                <button
                  key={snapshot.id}
                  onClick={() => setSelectedSnapshot(snapshot)}
                  className={`w-full p-2 rounded border text-xs text-left transition-colors ${
                    selectedSnapshot?.id === snapshot.id
                      ? 'bg-primary/10 border-primary/40 text-foreground'
                      : 'bg-muted/10 border-border hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">
                      {snapshot.phase.replace(/_/g, ' ')}
                    </span>
                    <span className="text-muted-foreground">
                      R{snapshot.round} • {snapshot.snapshot_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Snapshot Details */}
          {selectedSnapshot && (
            <div className="panel p-3 space-y-3">
              {/* Tabs */}
              <div className="flex gap-2 border-b border-border pb-2">
                <button
                  onClick={() => setActiveTab('territories')}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                    activeTab === 'territories'
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Map className="w-3 h-3" />
                  Territories
                </button>
                <button
                  onClick={() => setActiveTab('players')}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                    activeTab === 'players'
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  Players
                </button>
                <button
                  onClick={() => setActiveTab('income')}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                    activeTab === 'income'
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  Income
                </button>
              </div>

              {/* Tab Content */}
              <ScrollArea className="h-[200px]">
                {activeTab === 'territories' && (
                  <div className="space-y-1 text-xs">
                    <p className="text-muted-foreground mb-2">
                      {selectedSnapshot.territory_states?.length || 0} territories
                    </p>
                    {selectedSnapshot.territory_states?.slice(0, 10).map((ts, idx) => (
                      <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-muted/10">
                        <span className="font-medium">{ts.territory_id}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{ts.troop_count} troops</span>
                          {ts.owner_player_id && (
                            <span className="text-xs truncate max-w-[100px]">
                              {selectedSnapshot.player_standings?.find(p => p.player_id === ts.owner_player_id)?.display_name || ts.owner_player_id}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'players' && (
                  <div className="space-y-2 text-xs">
                    {selectedSnapshot.player_standings?.map((player, idx) => (
                      <div key={player.player_id} className="p-2 rounded border border-border bg-muted/10">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <PlayerColorDot color={player.color || 'gray'} size="sm" />
                            <span className="font-medium">{player.display_name}</span>
                          </div>
                          {player.is_eliminated && (
                            <span className="text-status-danger text-[10px]">Eliminated</span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                          <div>
                            <p className="text-[10px]">Territories</p>
                            <p className="font-semibold">{player.territory_count}</p>
                          </div>
                          <div>
                            <p className="text-[10px]">Troops</p>
                            <p className="font-semibold">{player.troop_total}</p>
                          </div>
                          <div>
                            <p className="text-[10px]">Income</p>
                            <p className="font-semibold">{player.deploy_income}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'income' && (
                  <div className="space-y-2 text-xs">
                    {Object.entries(selectedSnapshot.deploy_incomes || {}).map(([playerId, income]) => (
                      <div key={playerId} className="p-2 rounded border border-border bg-muted/10">
                        <p className="font-medium mb-2">
                          {selectedSnapshot.player_standings?.find(p => p.player_id === playerId)?.display_name || playerId}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                          <div>
                            <p className="text-[10px]">Territory Bonus</p>
                            <p className="font-semibold">{income.territory_bonus || 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px]">Troop Bonus</p>
                            <p className="font-semibold">{income.troop_bonus || 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px]">Region Bonus</p>
                            <p className="font-semibold">{income.region_bonus || 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px]">Total</p>
                            <p className="font-semibold text-primary">{income.total || 0}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </div>
  );
}