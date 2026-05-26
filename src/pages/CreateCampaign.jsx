/**
 * CreateCampaign — 7-step guided wizard shell for campaign creation.
 * Future: each step populated with real data (profiles, maps, players, settings).
 */
import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';

const STEPS = [
  { id: 'basics',    label: 'Basics'    },
  { id: 'profile',   label: 'Game'      },
  { id: 'map',       label: 'Map'       },
  { id: 'players',   label: 'Players'   },
  { id: 'schedule',  label: 'Schedule'  },
  { id: 'settings',  label: 'Settings'  },
  { id: 'review',    label: 'Review'    },
];

function StepIndicator({ steps, currentStep }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, idx) => {
        const isComplete = idx < currentStep;
        const isCurrent  = idx === currentStep;
        return (
          <div key={step.id} className="flex items-center gap-1">
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
            {idx < steps.length - 1 && (
              <div className="w-4 h-px bg-border mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepContent({ stepId }) {
  const placeholders = {
    basics:   'Campaign name, description, and test mode toggle will be here.',
    profile:  'Tabletop game profile selection will be here.',
    map:      'Map selection with player count and theme preview will be here.',
    players:  'Player invitation system will be here.',
    schedule: 'Phase schedule — weekly/monthly/custom, battle day, manual advance option.',
    settings: 'Starting troops, max attacks, fortifications, draft %, victory conditions.',
    review:   'Summary of all settings before creation.',
  };

  return (
    <div className="panel p-6 min-h-48 flex items-center justify-center">
      <p className="text-xs text-muted-foreground text-center max-w-sm">{placeholders[stepId]}</p>
    </div>
  );
}

export default function CreateCampaign() {
  const [currentStep, setCurrentStep] = useState(0);

  const canGoBack = currentStep > 0;
  const canGoNext = currentStep < STEPS.length - 1;
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <AppShell showBack title="New Campaign">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Step indicator */}
        <div className="panel p-4 overflow-x-auto">
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>

        {/* Step content */}
        <div>
          <h2 className="font-display text-sm font-bold tracking-widest uppercase text-foreground mb-4">
            Step {currentStep + 1} — {STEPS[currentStep].label}
          </h2>
          <StepContent stepId={STEPS[currentStep].id} />
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => setCurrentStep(s => s - 1)}
            disabled={!canGoBack}
            className="flex items-center gap-1.5 px-4 py-2 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>

          {isLastStep ? (
            <button className="flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all">
              <Check className="w-3.5 h-3.5" />
              Create Campaign
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep(s => s + 1)}
              disabled={!canGoNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>
    </AppShell>
  );
}