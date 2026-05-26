/**
 * CreateEditProfile — full form to create or edit a tabletop game profile.
 * Supports: basic config, faction list, terminology overrides.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield, Swords, BookOpen, Users, Loader2, AlertTriangle } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import FactionListEditor from '@/components/profiles/FactionListEditor';
import TerminologyEditor from '@/components/profiles/TerminologyEditor';
import { base44 } from '@/api/base44Client';

const DEFAULT_FORM = {
  game_name: '',
  troop_currency_name: '',
  average_battle_size: 1000,
  factions: [],
  terminology: {},
  notes: '',
};

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="panel-header flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-primary" />
      <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground">{title}</h2>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
      {children}
    </div>
  );
}

export default function CreateEditProfile() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    base44.entities.TabletopGameProfile.filter({ id }).then(([profile]) => {
      if (profile) {
        setForm({
          game_name: profile.game_name ?? '',
          troop_currency_name: profile.troop_currency_name ?? '',
          average_battle_size: profile.average_battle_size ?? 1000,
          factions: profile.factions ?? [],
          terminology: profile.terminology ?? {},
          notes: profile.notes ?? '',
        });
      }
      setLoading(false);
    });
  }, [id, isEdit]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.game_name.trim()) { setError('Game name is required.'); return; }

    setSaving(true);
    const user = await base44.auth.me();
    const payload = { ...form, owner_user_id: user.id };

    if (isEdit) {
      await base44.entities.TabletopGameProfile.update(id, payload);
    } else {
      await base44.entities.TabletopGameProfile.create(payload);
    }

    navigate('/profiles');
  };

  if (loading) {
    return (
      <AppShell showBack title="Loading…">
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading profile…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell showBack title={isEdit ? 'Edit Game Profile' : 'New Game Profile'}>
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── Basic Info ─────────────────────────────────────────── */}
        <div className="panel">
          <SectionHeader icon={Shield} title="Profile Details" />
          <div className="p-4 space-y-4">

            <Field label="Game Name *" hint="The tabletop game system this profile represents.">
              <input
                value={form.game_name}
                onChange={(e) => set('game_name', e.target.value)}
                placeholder="e.g. Warhammer 40K, Age of Sigmar, Bolt Action"
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Troop Currency Name" hint="What armies/troops are measured in.">
                <input
                  value={form.troop_currency_name}
                  onChange={(e) => set('troop_currency_name', e.target.value)}
                  placeholder="e.g. Points, Power Level, Wounds"
                  className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>

              <Field
                label="Average Battle Size"
                hint="Used to scale strategic armies to tabletop-sized battles."
              >
                <input
                  type="number"
                  min={1}
                  value={form.average_battle_size}
                  onChange={(e) => set('average_battle_size', Number(e.target.value))}
                  placeholder="e.g. 1000"
                  className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
            </div>

            <Field label="Notes" hint="Optional notes about this profile.">
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="e.g. For matched play using Leviathan rules pack…"
                rows={2}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </Field>
          </div>
        </div>

        {/* ── Factions ───────────────────────────────────────────── */}
        <div className="panel">
          <SectionHeader icon={Users} title="Factions / Army Types" />
          <div className="p-4">
            <FactionListEditor
              factions={form.factions}
              onChange={(factions) => set('factions', factions)}
            />
          </div>
        </div>

        {/* ── Terminology ────────────────────────────────────────── */}
        <div className="panel">
          <SectionHeader icon={BookOpen} title="Terminology Overrides" />
          <div className="p-4">
            <TerminologyEditor
              terminology={form.terminology}
              onChange={(terminology) => set('terminology', terminology)}
            />
          </div>
        </div>

        {/* ── Error + Actions ────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded border border-destructive/40 bg-destructive/5">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate('/profiles')}
            className="px-4 py-2 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Profile'}
          </button>
        </div>

      </form>
    </AppShell>
  );
}