/**
 * ProfileCard — displays a single tabletop game profile in the list.
 */
import { Link } from 'react-router-dom';
import { Shield, Swords, Users, Edit2, Copy, Trash2 } from 'lucide-react';

export default function ProfileCard({ profile, onDuplicate, onDelete }) {
  const factionCount = profile.factions?.length ?? 0;
  const hasTerminology = Object.values(profile.terminology ?? {}).some(Boolean);

  return (
    <div className="panel hover:border-primary/40 transition-colors">
      <div className="panel-header flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-display font-semibold text-sm tracking-wider text-foreground truncate">
            {profile.game_name}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            to={`/profiles/${profile.id}/edit`}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => onDuplicate(profile)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Duplicate"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(profile)}
            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat
          icon={<Swords className="w-3.5 h-3.5" />}
          label="Currency"
          value={profile.troop_currency_name || 'Troops'}
        />
        <Stat
          icon={<Shield className="w-3.5 h-3.5" />}
          label="Avg Battle Size"
          value={profile.average_battle_size ?? '—'}
        />
        <Stat
          icon={<Users className="w-3.5 h-3.5" />}
          label="Factions"
          value={factionCount === 0 ? 'None' : factionCount}
        />
        <Stat
          icon={<Shield className="w-3.5 h-3.5" />}
          label="Terminology"
          value={hasTerminology ? 'Custom' : 'Default'}
        />
      </div>

      {factionCount > 0 && (
        <div className="px-4 pb-4 flex flex-wrap gap-1.5">
          {profile.factions.slice(0, 8).map((f) => (
            <span key={f.id} className="badge-info text-xs">{f.name}</span>
          ))}
          {factionCount > 8 && (
            <span className="text-xs text-muted-foreground self-center">+{factionCount - 8} more</span>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-xs font-display tracking-wider uppercase">{label}</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}