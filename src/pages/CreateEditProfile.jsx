/**
 * CreateEditProfile — create or edit a TabletopGameProfile.
 * Data layer: useTabletopProfiles hook (features/profiles).
 * Validation: validateProfileForm (features/profiles/types).
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield, BookOpen, Users, Loader2, AlertTriangle } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import FactionListEditor from '@/components/profiles/FactionListEditor';
import TerminologyEditor from '@/components/profiles/TerminologyEditor';
import { useTabletopProfiles, DEFAULT_PROFILE_FORM, validateProfileForm } from '@/features/profiles';

// ── Small layout helpers ───────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="panel-header flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-primary" />
      <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground">{title}</h2>
    </div>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
      {children}
      {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CreateEditProfile() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { createProfile, updateProfile, getProfileById } = useTabletopProfiles();

  const [form, setForm] = useState({ ...DEFAULT_PROFILE_FORM });
  const [loadingProfile, setLoadingProfile] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Load existing profile when editing
  useEffect(() => {
    if (!isEdit) return;
    setLoadingProfile(true);
    setLoadError(null);
    getProfileById(id).then((profile) => {
      if (profile) {
        setForm({
          owner_user_id: profile.owner_user_id ?? '',
          game_name: profile.game_name ?? '',
          troop_currency_name: profile.troop_currency_name ?? '',
          average_battle_size: profile.average_battle_size ?? 1000,
          factions: profile.factions ?? [],
          terminology: profile.terminology ?? {},
          notes: profile.notes ?? '',
        });
      } else {
        setLoadError('Profile not found or you do not have permission to edit it.');
      }
      setLoadingProfile(false);
    }).catch(() => {
      setLoadError('Failed to load profile. Please go back and try again.');
      setLoadingProfile(false);
    });
  }, [id, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    // Clear field-level error on edit
    if (fieldErrors[field]) setFieldErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError(null);

    // Run validation
    const errors = validateProfileForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateProfile(id, form);
      } else {
        await createProfile(form);
      }
      navigate('/profiles');
    } catch {
      setSaveError(
        isEdit
          ? 'Failed to save changes. Please try again.'
          : 'Failed to create profile. Please try again.'
      );
      setSaving(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loadingProfile) {
    return (
      <AppShell showBack title="Loading…">
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading profile…
        </div>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell showBack title="Error">
        <div className="max-w-xl mx-auto px-4 py-12">
          <div className="flex items-start gap-3 p-4 rounded border border-destructive/40 bg-destructive/5">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-destructive font-display tracking-wider">{loadError}</p>
              <button
                onClick={() => navigate('/profiles')}
                className="mt-3 text-xs text-muted-foreground hover:text-foreground underline"
              >
                ← Back to profiles
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <AppShell showBack title={isEdit ? 'Edit Game Profile' : 'New Game Profile'}>
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── Profile Details ─────────────────────────────────────── */}
        <div className="panel">
          <SectionHeader icon={Shield} title="Profile Details" />
          <div className="p-4 space-y-4">

            <Field
              label="Game Name *"
              hint="The tabletop game system this profile represents."
              error={fieldErrors.game_name}
            >
              <input
                value={form.game_name}
                onChange={(e) => set('game_name', e.target.value)}
                placeholder="e.g. Warhammer 40K, Age of Sigmar, Bolt Action"
                className={`w-full bg-input border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${fieldErrors.game_name ? 'border-destructive' : 'border-border'}`}
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
                hint="Per-side troop count for a standard tabletop battle."
                error={fieldErrors.average_battle_size}
              >
                <input
                  type="number"
                  min={1}
                  value={form.average_battle_size}
                  onChange={(e) => set('average_battle_size', Number(e.target.value))}
                  placeholder="e.g. 1000"
                  className={`w-full bg-input border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${fieldErrors.average_battle_size ? 'border-destructive' : 'border-border'}`}
                />
              </Field>
            </div>

            <Field label="Notes" hint="Optional free-text notes about this profile.">
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

        {/* ── Factions ────────────────────────────────────────────── */}
        <div className="panel">
          <SectionHeader icon={Users} title="Factions / Army Types" />
          <div className="p-4 space-y-2">
            {fieldErrors.factions && (
              <div className="flex items-center gap-2 p-2 rounded border border-destructive/40 bg-destructive/5">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                <p className="text-xs text-destructive">{fieldErrors.factions}</p>
              </div>
            )}
            <FactionListEditor
              factions={form.factions}
              onChange={(factions) => set('factions', factions)}
            />
          </div>
        </div>

        {/* ── Terminology ─────────────────────────────────────────── */}
        <div className="panel">
          <SectionHeader icon={BookOpen} title="Terminology Overrides" />
          <div className="p-4">
            <TerminologyEditor
              terminology={form.terminology}
              onChange={(terminology) => set('terminology', terminology)}
            />
          </div>
        </div>

        {/* ── Save error + Actions ─────────────────────────────────── */}
        {saveError && (
          <div className="flex items-center gap-2 p-3 rounded border border-destructive/40 bg-destructive/5">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive">{saveError}</p>
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