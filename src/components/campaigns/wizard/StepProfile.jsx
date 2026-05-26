/**
 * StepProfile — Select a tabletop game profile for the campaign.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, CheckCircle2, Plus, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function StepProfile({ form, setField, errors }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(user =>
      base44.entities.TabletopGameProfile.filter({ owner_user_id: user.id }, '-created_date')
    ).then(data => {
      setProfiles(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const select = (profile) => {
    setField('game_profile_id', profile.id);
    setField('game_profile_name', profile.game_name);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-xs">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading profiles…
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="text-center py-10 space-y-3">
        <Shield className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">No game profiles yet. Create one to continue.</p>
        <Link
          to="/profiles/create"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Create Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        The game profile sets the tabletop system, faction options, and terminology for this campaign.
      </p>
      {errors.game_profile_id && (
        <p className="text-xs text-destructive">{errors.game_profile_id}</p>
      )}
      <div className="grid gap-2">
        {profiles.map(profile => {
          const selected = form.game_profile_id === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => select(profile)}
              className={`w-full text-left p-3 rounded border transition-all ${
                selected
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-border bg-muted/30 hover:border-primary/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-sm font-semibold tracking-wider text-foreground">
                    {profile.game_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {profile.troop_currency_name || 'Troops'} · Avg battle: {profile.average_battle_size ?? 1000}
                    {profile.factions?.length > 0 && ` · ${profile.factions.length} factions`}
                  </p>
                </div>
                {selected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
      <Link
        to="/profiles/create"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="w-3 h-3" /> Create new profile
      </Link>
    </div>
  );
}