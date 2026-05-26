/**
 * UI Constants
 * Centralized visual and interaction constants.
 */

export const MAP_CONSTANTS = {
  MIN_ZOOM: 0.4,
  MAX_ZOOM: 4.0,
  INITIAL_ZOOM: 1.0,
  ZOOM_STEP: 1.25,
  LABEL_ZOOM_THRESHOLD: 0.7,
};

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
  STROKE_OPACITY: {
    SELECTED: 1.0,
    HIGHLIGHTED: 1.0,
    ATTACKABLE: 0.9,
    DEFAULT: 0.5,
  },
};

export const DRAFT_CONSTANTS = {
  HIGHLIGHT_UNCLAIMED: true,
  HIGHLIGHT_ON_TURN_ONLY: true,
};

export const UI_TIMING = {
  ANIMATION_FAST: 0.15,
  ANIMATION_NORMAL: 0.2,
  ANIMATION_SLOW: 0.3,
  STAGGER_DELAY: 0.05,
};

export const LOADING_STATES = {
  SPINNER_SIZE: {
    SM: 'w-4 h-4',
    DEFAULT: 'w-6 h-6',
    LG: 'w-8 h-8',
  },
  OVERLAY_ZINDEX: {
    NORMAL: 30,
    FULL_SCREEN: 50,
  },
};