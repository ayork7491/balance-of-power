# Architecture Audit & V1 Refactor Plan

**Date**: 2026-05-26  
**Scope**: Maintainability, scalability, modularity, type safety, React + Tailwind consistency, hidden-information integrity, long-term stability

---

## Executive Summary

### ✅ What's Working Well

1. **Modular Feature Architecture** — Features organized by domain (`features/campaigns`, `features/maps`, `features/battles`)
2. **Rules Engine Separation** — Pure functions in `services/rules-engine/` with no side effects
3. **Config-Driven Design** — Centralized `config/gameplay.ts` and `config/theme.ts`
4. **Real-time Subscriptions** — Proper use of Base44 entity subscriptions
5. **Hidden Information** — User-scoped data fetching in attack phase hooks
6. **Component Breakdown** — Small, focused phase panels and layout components

### ⚠️ Critical Issues

1. **Oversized Page Components** — `ActiveCampaign.jsx` (427 lines) should be split
2. **Duplicated Validation Logic** — Campaign guards duplicated across hooks and functions
3. **Weak Type Safety** — TypeScript types exist but not enforced in critical paths
4. **Hardcoded Values** — Some magic numbers still in components (60%, 3 troops, etc.)
5. **Inconsistent Error Handling** — Mix of try/catch patterns, some swallow errors silently
6. **Folder Organization** — Some features spread across multiple directories

---

## 1. Oversized Files

### 🔴 ActiveCampaign.jsx (427 lines)

**Problem**: Monolithic page component with too much logic

**Current Issues**:
- 15+ imports
- Complex conditional rendering for 8 different phases
- Multiple useMemo calculations that could be extracted
- Attack reveal logic mixed with phase routing
- Arrow layer logic too complex for a page component

**Refactor Plan**:

```
pages/ActiveCampaign.jsx (target: ~100 lines)
├── Extract phase panel routing → components/campaigns/PhasePanelRouter.jsx
├── Extract right dock routing → components/campaigns/RightDockRouter.jsx
├── Extract highlight logic → features/campaigns/selectors/useTerritoryHighlights.js
├── Extract attack arrow logic → features/campaigns/attack/useAttackArrows.js
└── Keep only: data loading, layout composition, loading states
```

**New Files to Create**:
1. `components/campaigns/PhasePanelRouter.jsx` — Phase-based panel routing
2. `components/campaigns/RightDockRouter.jsx` — Tab-based right dock routing
3. `features/campaigns/selectors/useTerritoryHighlights.js` — Territory highlight logic
4. `features/campaigns/attack/useAttackArrows.js` — Attack arrow layer logic

---

### 🟡 MapRenderer.jsx (251 lines)

**Problem**: Map renderer is doing too much

**Current Issues**:
- Zoom/pan logic could be extracted
- Territory label rendering could be separate component
- Arrow layer injection is complex

**Refactor Plan**:

```
components/map/MapRenderer.jsx (target: ~150 lines)
├── Extract zoom controls → components/map/MapZoomControls.jsx
├── Extract territory labels → components/map/TerritoryLabels.jsx
└── Keep: viewport management, territory rendering, adjacency lines
```

---

## 2. Duplicated Logic

### 🔴 Campaign Validation Guards

**Current Duplication**:
- `features/campaigns/useCampaigns.js` — `startCampaign()` has 5 guards
- `functions/startCampaign` (if exists) — Would duplicate guards
- `components/campaigns/lobby/PlayerSetupPanel.jsx` — May check ready status

**Guards Duplicated**:
```javascript
// Guard 1: Campaign exists
// Guard 2: Caller is admin
// Guard 3: Status is lobby
// Guard 4: Min player count
// Guard 5: All players ready
```

**Refactor Plan**:

**Create**: `services/validators/campaignValidators.js`

```javascript
export function validateCampaignStart(campaign, adminUserId, players) {
  const errors = [];
  
  if (!campaign) errors.push('Campaign not found');
  else if (campaign.admin_user_id !== adminUserId) 
    errors.push('Only campaign admin can start');
  else if (campaign.status !== 'lobby')
    errors.push('Campaign already started');
  
  if (!players || players.length < 2)
    errors.push('Minimum 2 players required');
  
  const notReady = players.filter(p => !p.is_ready);
  if (notReady.length > 0)
    errors.push(`Not ready: ${notReady.map(p => p.display_name).join(', ')}`);
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

**Usage**:
```javascript
// In useCampaigns.js
const validation = validateCampaignStart(campaign, adminUserId, players);
if (!validation.isValid) throw new Error(validation.errors[0]);

// In backend function (if created)
const validation = validateCampaignStart(campaign, adminUserId, players);
if (!validation.isValid) return Response.json({ error: validation.errors[0] }, { status: 400 });
```

---

### 🟡 Income Calculation Logic

**Current**: Income formulas may be duplicated between:
- `services/rules-engine/deploy/deployIncome.js`
- `features/campaigns/deploy/useDeployIncome.js`
- Backend function `deployPhase`

**Refactor Plan**:

**Create**: `services/calculators/incomeCalculator.js`

```javascript
import { GAMEPLAY_DEFAULTS } from '@/config/gameplay';

export function calculateDeployIncome({
  territoryCount,
  troopTotal,
  regionBonuses = [],
  continentBonuses = [],
  settings = {},
}) {
  const config = { ...GAMEPLAY_DEFAULTS, ...settings };
  
  const territoryBonus = Math.floor(territoryCount / config.territoriesPerBonusTroop);
  const troopBonus = Math.floor(troopTotal / 10); // Example formula
  const regionBonus = regionBonuses.reduce((sum, r) => sum + r.control_bonus, 0);
  const continentBonus = continentBonuses.reduce((sum, c) => sum + c.control_bonus, 0);
  
  const total = config.baseTroopsPerTurn + territoryBonus + troopBonus + regionBonus + continentBonus;
  
  return {
    territory_bonus: territoryBonus,
    troop_bonus: troopBonus,
    region_bonus: regionBonus,
    continent_bonus: continentBonus,
    total: Math.max(total, config.minTroopsPerTurn),
  };
}
```

---

## 3. Weak Type Safety

### 🔴 JavaScript Instead of TypeScript

**Current**: Most files are `.js`/`.jsx` despite having TypeScript types defined

**Affected Files**:
- `features/campaigns/useCampaigns.js` — Should be `.ts`
- `features/maps/useTerritoryState.js` — Should be `.ts`
- `features/campaigns/attack/useAttackPhase.js` — Should be `.ts`
- `components/map/MapRenderer.jsx` — Should be `.tsx`
- `components/map/TerritoryPolygon.jsx` — Should be `.tsx`

**Impact**:
- No type checking on hook parameters
- No type checking on entity record shapes
- Easy to pass wrong data structures

**Refactor Plan**:

**Phase 1** (Critical):
1. Convert all feature hooks to TypeScript
2. Add type annotations to hook parameters
3. Add return type annotations

**Phase 2** (Components):
1. Convert all components to TSX
2. Add Props interfaces
3. Use TypeScript for event handlers

**Example Conversion**:

```typescript
// features/campaigns/useCampaigns.ts
import type { Campaign, CampaignPlayer, CampaignInvite } from '@/types/Campaign';

export function useCampaign(campaignId: string): {
  campaign: Campaign | null;
  players: CampaignPlayer[];
  invites: CampaignInvite[];
  myPlayer: CampaignPlayer | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
} {
  // ... implementation
}
```

---

### 🟡 Entity Record Types Not Enforced

**Current**: Entity records are treated as `any` objects

**Problem**: No type safety when accessing entity fields

```javascript
// Current — no type checking
const ownerColor = tState?.owner_player_id
  ? getPlayerHex(players, tState.owner_player_id)
  : null;
```

**Better**:

```typescript
// With types
import type { TerritoryState } from '@/types/TerritoryState';

function getOwnerColor(
  tState: TerritoryState | null | undefined,
  players: CampaignPlayer[]
): string | null {
  if (!tState?.owner_player_id) return null;
  return getPlayerHex(players, tState.owner_player_id);
}
```

---

## 4. Hardcoded Values

### 🔴 Magic Numbers in Components

**Current Hardcoding**:

```javascript
// ActiveCampaign.jsx
const highlightIds = useMemo(() => {
  if (phase !== 'territory_draft') return new Set();
  const setupOrder = campaign?.setup_order ?? [];
  const idx = campaign?.setup_current_index ?? 0;
  // ... logic
}, [phase, campaign, myPlayer, mapDef, stateById]);

// MapRenderer.jsx
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4.0;

// TerritoryPolygon.jsx
const fillOpacity = ownerColor
  ? (isSelected ? 0.95 : 0.65)
  : (isSelected ? 0.50 : 0.25);
```

**Refactor Plan**:

**Create**: `config/uiConstants.ts`

```typescript
export const MAP_CONSTANTS = {
  MIN_ZOOM: 0.4,
  MAX_ZOOM: 4.0,
  INITIAL_ZOOM: 1.0,
  ZOOM_STEP: 1.25,
} as const;

export const TERRITORY_VISUALS = {
  FILL_OPACITY: {
    OWNED_SELECTED: 0.95,
    OWNED_UNSELECTED: 0.65,
    UNOWNED_SELECTED: 0.50,
    UNOWNED_UNSELECTED: 0.25,
  },
  STROKE_WIDTH: {
    SELECTED: 2.5,
    HIGHLIGHTED: 2.5,
    ATTACKABLE: 2.0,
    DEFAULT: 1.2,
  },
} as const;

export const DRAFT_CONSTANTS = {
  HIGHLIGHT_UNCLAIMED: true,
  HIGHLIGHT_ON_TURN_ONLY: true,
} as const;
```

**Usage**:
```javascript
import { MAP_CONSTANTS, TERRITORY_VISUALS } from '@/config/uiConstants';

const fillOpacity = ownerColor
  ? (isSelected ? TERRITORY_VISUALS.FILL_OPACITY.OWNED_SELECTED : TERRITORY_VISUALS.FILL_OPACITY.OWNED_UNSELECTED)
  : (isSelected ? TERRITORY_VISUALS.FILL_OPACITY.UNOWNED_SELECTED : TERRITORY_VISUALS.FILL_OPACITY.UNOWNED_UNSELECTED);
```

---

### 🟡 Phase-Specific Constants

**Current**: Phase durations, max actions hardcoded in multiple places

**Refactor Plan**:

**Already Good**: `config/gameplay.ts` has `GAMEPLAY_DEFAULTS`

**Needs Fix**: Ensure all components read from `campaign.settings` with fallback to `GAMEPLAY_DEFAULTS`

```javascript
// Good pattern
const maxAttacks = campaign?.settings?.max_attacks_per_phase ?? GAMEPLAY_DEFAULTS.maxAttacksPerPhase;

// Bad pattern (if exists)
const maxAttacks = 3; // Hardcoded!
```

---

## 5. Validation Systems

### 🔴 Form Validation Inconsistency

**Current**:
- `features/campaigns/types.ts` has `validateCampaignForm()`
- Individual steps may have inline validation
- Backend functions may duplicate validation

**Refactor Plan**:

**Create**: `services/validators/formValidators.ts`

```typescript
import type { CampaignForm } from '@/features/campaigns/types';

export interface FieldErrors {
  [field: string]: string | undefined;
}

export function validateCampaignBasics(form: Partial<CampaignForm>): FieldErrors {
  const errors: FieldErrors = {};
  
  if (!form.name?.trim()) {
    errors.name = 'Campaign name is required';
  } else if (form.name.length < 3) {
    errors.name = 'Name must be at least 3 characters';
  } else if (form.name.length > 50) {
    errors.name = 'Name must be less than 50 characters';
  }
  
  if (!form.description?.trim()) {
    errors.description = 'Description is required';
  }
  
  return errors;
}

export function validateCampaignPlayers(form: Partial<CampaignForm>): FieldErrors {
  const errors: FieldErrors = {};
  
  if (!form.invitee_emails || form.invitee_emails.length === 0) {
    // No error — inviting is optional
  } else {
    const invalidEmails = form.invitee_emails.filter(
      email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );
    if (invalidEmails.length > 0) {
      errors.invitee_emails = `Invalid emails: ${invalidEmails.join(', ')}`;
    }
  }
  
  return errors;
}

// Composite validator
export function validateCampaignForm(form: CampaignForm): FieldErrors {
  return {
    ...validateCampaignBasics(form),
    ...validateCampaignProfile(form),
    ...validateCampaignPlayers(form),
  };
}
```

---

### 🟡 Backend Function Validation

**Current**: Backend functions may not validate inputs consistently

**Refactor Plan**:

**Create**: `functions/validators.js` (shared validation utilities)

```javascript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

export async function validateCampaignAccess(req, campaignId, requiredRole = 'player') {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  const campaigns = await base44.entities.Campaign.filter({ id: campaignId });
  const campaign = campaigns[0];
  
  if (!campaign) {
    return { error: 'Campaign not found', status: 404 };
  }
  
  if (requiredRole === 'admin') {
    if (campaign.admin_user_id !== user.id && user.role !== 'admin') {
      return { error: 'Admin access required', status: 403 };
    }
  } else {
    // Check player membership
    const players = await base44.entities.CampaignPlayer.filter({
      campaign_id: campaignId,
      user_id: user.id,
    });
    if (players.length === 0) {
      return { error: 'Not a campaign player', status: 403 };
    }
  }
  
  return { user, campaign };
}
```

---

## 6. Folder Organization

### 🟡 Scattered Campaign Features

**Current**:
- `features/campaigns/` — Main hooks
- `features/campaigns/attack/` — Attack-specific hooks
- `features/campaigns/deploy/` — Deploy-specific hooks
- `features/campaigns/fortify/` — Fortify-specific hooks
- `features/campaigns/setup/` — Setup hooks
- `features/campaigns/history/` — History hooks
- `features/campaigns/leaderboard/` — Leaderboard hooks
- `components/campaigns/` — Campaign components
- `components/campaigns/lobby/` — Lobby components
- `components/campaigns/wizard/` — Wizard steps

**Issue**: Some features split between `features/` and `components/`

**Refactor Plan**:

**Keep Current Structure** — It's actually good! Features contain logic, components contain UI.

**Add Missing**:
1. `features/campaigns/battle/` — Battle card hooks (currently in `features/battles/`)
2. `features/campaigns/selectors/` — Memoized selector hooks (e.g., `useTerritoryHighlights`)
3. `features/campaigns/utils/` — Utility functions

---

### 🟡 Services Organization

**Current**:
- `services/rules-engine/battle/` — Battle logic
- `services/rules-engine/deploy/` — Deploy logic
- `services/rules-engine/snapshots/` — Snapshot logic
- `services/maps/` — Map utilities

**Good**: Rules engine is well organized

**Needs**: 
1. `services/validators/` — Validation utilities
2. `services/calculators/` — Calculation utilities (income, scaling, etc.)
3. `services/helpers/` — General helpers

---

## 7. React + Tailwind Consistency

### 🟡 Component Patterns

**Good Patterns Found**:
- Consistent use of `panel`, `panel-header` classes
- Proper use of `font-display`, `tracking-widest`, `uppercase`
- Good use of `text-muted-foreground` for secondary text
- Consistent badge styling

**Inconsistencies**:

**1. Button Variants**:

```javascript
// Some use btn-tactical class
<button className="btn-tactical">Create</button>

// Others use inline Tailwind
<button className="bg-primary text-primary-foreground ...">Create</button>
```

**Fix**: Standardize on shadcn `<Button>` component with custom variants

**Create**: `components/ui/Button.jsx` (extend shadcn)

```javascript
import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        tactical: "bg-primary text-primary-foreground font-semibold tracking-wider uppercase text-xs px-4 py-2 hover:brightness-110",
        outline: "border border-input hover:bg-accent",
        ghost: "hover:bg-accent",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

**2. Loading States**:

```javascript
// Some use LoadingScreen component
<LoadingScreen message="Loading..." />

// Others inline
<div className="flex items-center gap-3">
  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  <span>Loading...</span>
</div>
```

**Fix**: Create standardized loading components

**Create**: `components/ui/LoadingStates.jsx`

```javascript
export function LoadingSpinner({ size = 'default', message }) {
  const sizes = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-8 h-8',
  };
  
  return (
    <div className="flex items-center gap-3">
      <div className={`${sizes[size]} border-2 border-primary border-t-transparent rounded-full animate-spin`} />
      {message && <span className="font-display text-xs tracking-widest uppercase">{message}</span>}
    </div>
  );
}

export function LoadingOverlay({ message, fullScreen = false }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm ${fullScreen ? 'z-50' : 'z-30'}`}>
      <LoadingSpinner message={message} />
    </div>
  );
}
```

---

### 🟡 Tailwind Class Organization

**Issue**: Long class strings hard to maintain

**Current**:
```javascript
className="w-9 h-9 rounded-lg bg-panel-header border border-panel-border text-foreground text-lg font-light flex items-center justify-center hover:bg-secondary hover:border-primary/50 active:scale-95 transition-all shadow-lg touch-manipulation"
```

**Better**: Use `cn()` utility and extract to constants

```javascript
import { cn } from '@/lib/utils';

const ZOOM_BUTTON_CLASSES = cn(
  "w-9 h-9 rounded-lg bg-panel-header border border-panel-border",
  "text-foreground text-lg font-light flex items-center justify-center",
  "hover:bg-secondary hover:border-primary/50 active:scale-95",
  "transition-all shadow-lg touch-manipulation"
);

// Usage
<button className={ZOOM_BUTTON_CLASSES}>+</button>
```

---

## 8. Hidden Information Integrity

### ✅ What's Good

1. **User-Scoped Fetching** — `useAttackPhase` only fetches own PhaseDecision
2. **Subscription Guards** — Checks `player_id` before reacting to events
3. **No Data Leaks** — Other players' attacks never fetched during attack phase

### 🟡 Potential Issues

**1. Debug Overlay in Test Mode**:

```javascript
// components/admin/DebugOverlay.jsx
// Fetches ALL phase decisions for current phase
const res = await base44.functions.invoke('getAllPhaseDecisions', {
  campaign_id: campaign.id,
  round: campaign.current_round,
  phase: campaign.current_phase,
});
```

**Risk**: This is admin-only, but ensure backend function validates admin access

**Fix**: Add validation to `functions/getAllPhaseDecisions.js`

```javascript
const user = await base44.auth.me();
if (user.role !== 'admin') {
  return Response.json({ error: 'Admin access required' }, { status: 403 });
}

// Also check if campaign is test campaign (for campaign admins)
const campaign = await base44.entities.Campaign.filter({ id: campaign_id });
if (!campaign[0].is_test_campaign && user.role !== 'admin') {
  return Response.json({ error: 'Platform admin only' }, { status: 403 });
}
```

**2. Phase Snapshots**:

```javascript
// functions/getPhaseSnapshots.js
// Should validate user is campaign player before returning data
```

**Fix**: Add player validation

---

## 9. Error Handling

### 🔴 Inconsistent Patterns

**Current**:

```javascript
// Pattern 1: Silent failure
try {
  await base44.entities.Campaign.filter({ id });
} catch {
  setError('Failed to load');
}

// Pattern 2: Log and rethrow
try {
  await something();
} catch (err) {
  console.error(err);
  throw err;
}

// Pattern 3: Extract error message
try {
  await something();
} catch (err) {
  const msg = err?.response?.data?.error || 'Failed';
  setError(msg);
}
```

**Refactor Plan**:

**Create**: `lib/errorHandling.js`

```javascript
export function extractErrorMessage(error, defaultMessage = 'An error occurred') {
  if (!error) return defaultMessage;
  
  // Base44 API error
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  
  // Direct error message
  if (error?.message) {
    return error.message;
  }
  
  // String error
  if (typeof error === 'string') {
    return error;
  }
  
  return defaultMessage;
}

export function isUnauthorizedError(error) {
  return error?.response?.status === 401;
}

export function isForbiddenError(error) {
  return error?.response?.status === 403;
}
```

**Usage**:
```javascript
import { extractErrorMessage } from '@/lib/errorHandling';

try {
  await something();
} catch (err) {
  setError(extractErrorMessage(err, 'Failed to load campaign'));
}
```

---

## 10. Performance Issues

### 🟡 Missing Optimizations

**1. Over-fetching in Hooks**:

```javascript
// useCampaign loads CampaignPlayer + CampaignInvite every time
// Could be optimized with React Query caching
```

**Fix**: Use React Query for better caching

**Already Using**: `@tanstack/react-query` (from installed packages)

**Create**: `features/campaigns/queries/useCampaignQuery.js`

```javascript
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useCampaignQuery(campaignId) {
  return useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      const [campaign, players, invites] = await Promise.all([
        base44.entities.Campaign.filter({ id: campaignId }).then(r => r[0]),
        base44.entities.CampaignPlayer.filter({ campaign_id: campaignId }),
        base44.entities.CampaignInvite.filter({ campaign_id: campaignId }),
      ]);
      return { campaign, players, invites };
    },
    enabled: !!campaignId,
    staleTime: 30000, // 30 seconds
  });
}
```

**2. Real-time Subscription Cleanup**:

```javascript
// All subscriptions properly cleaned up — GOOD!
useEffect(() => {
  const unsub = base44.entities.TerritoryState.subscribe(...);
  return unsub;
}, []);
```

**No Action Needed** — This is already done correctly.

---

## Priority Refactoring Tasks

### 🔴 Critical (Do First)

1. **Split ActiveCampaign.jsx** — Extract routers and selectors
2. **Create validation utilities** — Centralize campaign guards
3. **Convert critical hooks to TypeScript** — useCampaigns, useCampaign, useAttackPhase
4. **Add error handling utilities** — Standardize error extraction
5. **Validate admin-only functions** — Ensure DebugOverlay is secure

### 🟡 High Priority

6. **Extract MapRenderer sub-components** — Zoom controls, labels
7. **Create UI constants config** — Remove magic numbers
8. **Standardize loading states** — Create LoadingStates component
9. **Add income calculator** — Centralize income formulas
10. **Convert MapRenderer to TSX** — Add type safety

### 🟢 Medium Priority

11. **Add React Query hooks** — Better caching
12. **Extend Button component** — Add tactical variant
13. **Organize services folder** — Add validators, calculators
14. **Create selector hooks** — useTerritoryHighlights, useAttackArrows
15. **Add JSDoc comments** — Document complex functions

---

## Implementation Strategy

### Phase 1: Foundation (Week 1)
- [ ] Create validation utilities
- [ ] Create error handling utilities
- [ ] Create UI constants
- [ ] Convert 3 critical hooks to TypeScript

### Phase 2: Component Refactoring (Week 2)
- [ ] Split ActiveCampaign.jsx
- [ ] Extract MapRenderer sub-components
- [ ] Create LoadingStates component
- [ ] Standardize button variants

### Phase 3: Performance & Caching (Week 3)
- [ ] Add React Query hooks
- [ ] Optimize data fetching
- [ ] Add selector hooks

### Phase 4: Documentation & Types (Week 4)
- [ ] Add JSDoc comments
- [ ] Convert remaining files to TypeScript
- [ ] Document architecture decisions

---

## Success Metrics

**Maintainability**:
- Average file size < 200 lines
- No file > 300 lines
- All hooks have return type annotations

**Type Safety**:
- 80%+ files converted to TypeScript
- Zero `any` types in critical paths
- All entity records typed

**Performance**:
- Page load < 2 seconds
- No unnecessary re-renders (React DevTools profiling)
- Proper subscription cleanup

**Code Quality**:
- No duplicated validation logic
- Consistent error handling patterns
- All constants extracted to config files

---

## Conclusion

The Balance of Power codebase has a **solid foundation** with good separation of concerns, proper real-time subscriptions, and strong hidden-information patterns. The main issues are:

1. **Oversized page components** — Fixable with extraction
2. **Duplicated validation** — Fixable with shared utilities
3. **Weak type safety** — Fixable with gradual TypeScript migration
4. **Some hardcoding** — Fixable with config extraction

**Estimated Refactor Time**: 2-4 weeks for full implementation  
**Risk Level**: Low — All changes are additive or refactoring, no functionality changes  
**Impact**: High — Significantly improved maintainability and scalability