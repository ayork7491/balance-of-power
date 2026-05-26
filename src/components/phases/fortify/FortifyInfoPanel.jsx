/**
 * FortifyInfoPanel — right dock info panel for fortify phase.
 * Shows public information about fortification rules and construction projects.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Castle, Hammer } from 'lucide-react';

const STRUCTURE_CONFIG = {
  castle: {
    cost: { brick: 2, lumber: 1, ore: 1 },
    rounds: 2,
    effect: 'Defensive bonus in battles',
  },
  barracks: {
    cost: { brick: 1, lumber: 2, wool: 1 },
    rounds: 1,
    effect: '+1 troop income per turn',
  },
  stables: {
    cost: { lumber: 2, wool: 2, grain: 1 },
    rounds: 1,
    effect: 'Increased fortification range',
  },
};

export default function FortifyInfoPanel({ campaign, players }) {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!campaign) {
      setIsLoading(false);
      return;
    }

    async function loadProjects() {
      setIsLoading(true);
      try {
        const allProjects = await base44.asServiceRole.entities.ConstructionProject.filter({
          campaign_id: campaign.id,
          status: 'in_progress',
        });
        setProjects(allProjects);
      } catch (err) {
        console.error('[FortifyInfoPanel] error loading projects:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadProjects();
  }, [campaign?.id]);

  return (
    <div className="p-4 space-y-4">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-4">
        <p className="font-display text-xs tracking-widest uppercase text-muted-foreground">
          Fortify Phase Info
        </p>
      </div>

      {/* Rules Summary */}
      <div className="space-y-2">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Rules
        </p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>• Max {campaign.settings?.max_fortifications_per_phase ?? 3} movements per turn</p>
          <p>• Max distance: {campaign.settings?.max_fortification_distance ?? 4} territories</p>
          <p>• One structure per territory</p>
          <p>• One active construction project at a time</p>
        </div>
      </div>

      {/* Structure Types */}
      <div className="space-y-2">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Structures
        </p>
        <div className="space-y-2">
          {Object.entries(STRUCTURE_CONFIG).map(([type, config]) => (
            <div key={type} className="p-2 rounded border border-border bg-muted/10">
              <div className="flex items-center gap-2 mb-1">
                {type === 'castle' ? <Castle className="w-3 h-3 text-primary" /> : <Hammer className="w-3 h-3 text-primary" />}
                <p className="text-xs font-medium text-foreground capitalize">{type}</p>
              </div>
              <p className="text-xs text-muted-foreground">{config.effect}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Cost: {Object.entries(config.cost).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ')}
              </p>
              <p className="text-xs text-muted-foreground">
                Build time: {config.rounds} round{config.rounds > 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Active Construction Projects (PUBLIC ONLY - after reveal) */}
      <div className="space-y-2">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Construction Projects
        </p>
        <p className="text-xs text-muted-foreground">
          Projects are private during fortify phase. Completed structures appear here after phase reveal.
        </p>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading...
          </div>
        ) : projects.length === 0 ? (
          <p className="text-xs text-muted-foreground">No public construction projects</p>
        ) : (
          <div className="space-y-1.5">
            {projects.map(project => {
              const player = players.find(p => p.id === project.player_id);
              const progress = Math.round((project.rounds_completed / project.rounds_required) * 100);
              return (
                <div key={project.id} className="p-2 rounded border border-border bg-muted/10">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-foreground capitalize">{project.structure_type}</p>
                    <p className="text-xs text-muted-foreground">{progress}%</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {player?.display_name ?? 'Unknown'} • Round {project.round_started}
                  </p>
                  <div className="mt-1 h-1.5 rounded-full bg-border overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}