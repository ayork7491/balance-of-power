/**
 * CreateCampaign — 5-step guided wizard for campaign creation.
 * Steps: Basics → Profile → Players → Settings → Review
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Check, Loader2, AlertTriangle } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import StepBasics from '@/components/campaigns/wizard/StepBasics';
import StepProfile from '@/components/campaigns/wizard/StepProfile';
import StepPlayers from '@/components/campaigns/wizard/StepPlayers';
import StepSettings from '@/components/campaigns/wizard/StepSettings';
import StepReview from '@/components/campaigns/wizard/StepReview';
import { DEFAULT_CAMPAIGN_FORM, validateCampaignForm, createCampaign } from '@/features/campaigns';

const STEPS = [
  { id: 'basics',   label: 'Basics'   },
  { id: 'profile',  label: 'Game'     },
  { id: 'players',  label: 'Players'  },
  { id: 'settings', label: 'Settings' },
  { id: 'review',   label: 'Review'   },
];

function StepIndicator({ steps, currentStep }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {steps.map((step, idx) => {
        const isComplete = idx < currentStep;
        const isCurrent = idx === currentStep;
        return (
          <div key={step.id} className="flex items-center gap-1 shrink-0">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-display font-bold transition-colors ${
              isComplete ? 'bg-primary text-primary-foreground' :
              isCurrent  ? 'bg-primary/20 border border-primary text-primary' :
                           'bg-muted border border-border text-muted-foreground'
            }`}>
              {isComplete ? <Check className="w-3 h-3" /> : <span>{idx + 1}</span>}
            </div>
            <span className={`hidden sm:block text-xs font-display tracking-wider uppercase ${
              isCurrent ? 'text-foreground' : 'text-muted-foreground'
            }`}>{step.label}</span>
            {idx < steps.length - 1 && <div className="w-4 h-px bg-border mx-1" />}
          </div>
        );
      })}
    </div>
  );
}

export default function CreateCampaign() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...DEFAULT_CAMPAIGN_FORM });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const setField = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (fieldErrors[key]) setFieldErrors(e => ({ ...e, [key]: undefined }));
  };

  const validateStep = () => {
    // Only validate on steps that have required fields
    if (step === 0) {
      const errs = {};
      if (!form.name.trim()) errs.name = 'Campaign name is required.';
      if (Object.keys(errs).length > 0) { setFieldErrors(errs); return false; }
    }
    if (step === 1) {
      const errs = {};
      if (!form.game_profile_id) errs.game_profile_id = 'Please select a game profile.';
      if (Object.keys(errs).length > 0) { setFieldErrors(errs); return false; }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStep(s => s + 1);
  };

  const handleCreate = async () => {
    const errors = validateCampaignForm(form);
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const campaign = await createCampaign(form);
      navigate(`/campaigns/${campaign.id}/lobby`);
    } catch {
      setSubmitError('Failed to create campaign. Please try again.');
      setSubmitting(false);
    }
  };

  const stepComponents = {
    basics:   <StepBasics form={form} setField={setField} errors={fieldErrors} />,
    profile:  <StepProfile form={form} setField={setField} errors={fieldErrors} />,
    players:  <StepPlayers form={form} setField={setField} />,
    settings: <StepSettings form={form} setField={setField} />,
    review:   <StepReview form={form} />,
  };

  const isLastStep = step === STEPS.length - 1;

  return (
    <AppShell showBack title="New Campaign">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Step indicator */}
        <div className="panel p-4 overflow-x-auto">
          <StepIndicator steps={STEPS} currentStep={step} />
        </div>

        {/* Step header */}
        <h2 className="font-display text-sm font-bold tracking-widest uppercase text-foreground">
          Step {step + 1} — {STEPS[step].label}
        </h2>

        {/* Step content */}
        <div className="panel p-5">
          {stepComponents[STEPS[step].id]}
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="flex items-center gap-2 p-3 rounded border border-destructive/40 bg-destructive/5">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive">{submitError}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>

          {isLastStep ? (
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {submitting ? 'Creating…' : 'Create Campaign'}
            </button>
          ) : (
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>
    </AppShell>
  );
}