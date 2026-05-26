/**
 * PlayerColor — a selectable player color token.
 * Values must match the PLAYER_COLORS array in config/theme.ts.
 */
export type PlayerColorId =
  | 'crimson'
  | 'cobalt'
  | 'emerald'
  | 'gold'
  | 'violet'
  | 'amber'
  | 'teal'
  | 'rose';

export interface PlayerColor {
  id: PlayerColorId;
  label: string;
  hex: string;
  tailwind: string;
}