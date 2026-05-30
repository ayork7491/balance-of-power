/**
 * VictoryScreen — shown when campaign.current_phase === 'complete'.
 * Displays the winner and final standings.
 */
import { useMemo } from 'react';
import { Trophy, Shield, Crown } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';

function getPlayerHex(players, playerId) {
  const p = players.find(pl => pl.id === playerId);
  if (!p) return null;
  const pc = PLAYER_COLORS.find(c => c.id === p.color);
  return pc?.hex ?? null;
}

export default function VictoryScreen({ campaign, players, stateById, myPlayer }) {
  const activePlayers = players.filter(p => !p.is_eliminated);
  const victor = activePlayers.length === 1 ? activePlayers[0] : null;
  const isVictor = victor && myPlayer && victor.id === myPlayer.id;

  const standings = useMemo(() => {
    return [...players]
      .map(p => {
        const owned = Object.values(stateById).filter(s => s.owner_player_id === p.id);
        const troops = owned.reduce((s, t) => s + (t.troop_count || 0), 0);
        return { ...p, territories: owned.length, troops };
      })
      .sort((a, b) => b.territories - a.territories || b.troops - a.troops);
  }, [players, stateById]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-background/95 backdrop-blur-md">
      <div className="max-w-sm w-full mx-4 space-y-6 text-center">

        {/* Victory header */}
        <div className="space-y-2">
          {victor ? (
            <>
              <div className="flex justify-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center border-2"
                  style={{ borderColor: getPlayerHex(players, victor.id) ?? '#f59e0b', background: `${getPlayerHex(players, victor.id) ?? '#f59e0b'}22` }}
                >
                  <Crown className="w-8 h-8" style={{ color: getPlayerHex(players, victor.id) ?? '#f59e0b' }} />
                </div>
              </div>
              <h1 className="font-display text-3xl tracking-widest uppercase text-primary">
                {isVictor ? 'Victory!' : `${victor.display_name} Wins`}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isVictor
                  ? `You have conquered The Shattered Crown after ${campaign.current_round} rounds.`
                  : `${victor.display_name} has conquered The Shattered Crown after ${campaign.current_round} rounds.`
                }
              </p>
            </>
          ) : (
            <>
              <Trophy className="w-12 h-12 mx-auto text-primary" />
              <h1 className="font-display text-2xl tracking-widest uppercase">Campaign Complete</h1>
              <p className="text-muted-foreground text-sm">The campaign has ended after {campaign.current_round} rounds.</p>
            </>
          )}
        </div>

        {/* Final standings */}
        <div className="panel divide-y divide-border">
          <div className="panel-header px-4 py-2">
            <p className="font-display text-xs tracking-widest uppercase text-muted-foreground">Final Standings</p>
          </div>
          {standings.map((p, i) => {
            const hex = getPlayerHex(players, p.id);
            const isWinner = victor?.id === p.id;
            return (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${isWinner ? 'bg-primary/5' : ''}`}>
                <span className="text-muted-foreground text-xs font-mono w-4">{i + 1}</span>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: hex ?? '#64748b' }} />
                <span className={`flex-1 text-sm font-display tracking-wide ${isWinner ? 'text-primary' : 'text-foreground'}`}>
                  {p.display_name}
                  {isWinner && <Crown className="inline-block w-3 h-3 ml-1.5 text-primary" />}
                  {p.is_eliminated && <span className="ml-1.5 text-muted-foreground text-xs">(eliminated)</span>}
                </span>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{p.territories} territories</div>
                  <div>{p.troops} troops</div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">Campaign #{campaign.id.slice(0, 8)}</p>
      </div>
    </div>
  );
}