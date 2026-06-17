// ─── Kosalma Design System ────────────────────────────────────────────────────

export const lightC = {
  // Brand
  brand:       '#00A99D',
  brandDark:   '#007D74',
  brandLight:  '#E6F7F6',
  brandPale:   '#F0FAF9',

  // Backgrounds
  bg:          '#F4F6F9',   // screen/page background
  surface:     '#FFFFFF',   // card/panel surface
  surfaceAlt:  '#F9FAFB',   // input / code bg

  // Borders & dividers
  border:      '#E4E8EE',
  borderLight: '#F0F3F7',

  // Text hierarchy
  text:        '#0F1923',   // near-black primary
  textSub:     '#4B5668',   // secondary body
  textMuted:   '#8F9BB3',   // hints, metadata
  textHint:    '#C5CDD9',   // placeholders, very faint

  // Brand accent palette (original Kosalma colors)
  red:         '#EF3340',
  green:       '#00A99D',
  yellow:      '#FFC107',   // readable version of FFF200
  blue:        '#00B5E2',

  // Semantic
  error:       '#EF4444',
  success:     '#10B981',
  warning:     '#F59E0B',
  overtime:    '#DC2626',

  // White/black
  white:       '#FFFFFF',
  black:       '#000000',
};

export const darkC = {
  brand:       '#00A99D',
  brandDark:   '#007D74',
  brandLight:  '#0D2E2C',
  brandPale:   '#081E1D',
  bg:          '#1A1917',
  surface:     '#242220',
  surfaceAlt:  '#2E2C29',
  border:      '#3A3835',
  borderLight: '#2E2C29',
  text:        '#E8E5E1',
  textSub:     '#B8B5B1',
  textMuted:   '#9E9B97',
  textHint:    '#6E6B67',
  red:         '#EF3340',
  green:       '#00A99D',
  yellow:      '#FFC107',
  blue:        '#00B5E2',
  error:       '#EF4444',
  success:     '#10B981',
  warning:     '#F59E0B',
  overtime:    '#DC2626',
  white:       '#FFFFFF',
  black:       '#000000',
};

export type ColorsType = typeof lightC;

// Backwards-compat export — any file that hasn't been migrated yet still works
export const C = lightC;

export const S = {
  xs: {
    shadowColor: '#1A2B4B',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sm: {
    shadowColor: '#1A2B4B',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#1A2B4B',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  lg: {
    shadowColor: '#1A2B4B',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
};

export const R = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   20,
  xl:   28,
  pill: 999,
};

export const SP = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
};
