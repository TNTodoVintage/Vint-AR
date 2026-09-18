// Design tokens from the Vint AR spec (docs/spec-migracion.md, section 3).
export const colors = {
  paper: '#EDE6D6',
  paperElevated: '#F7F3E9',
  olive: '#3D4A34',
  oliveDeep: '#2C3627',
  mustard: '#C98A2B',
  ink: '#211F1A',
  inkSoft: '#6B6255',
  brick: '#A6472C',
  line: '#DCD3BE',
} as const;

export const fonts = {
  display: 'Fraunces_600SemiBold', // logo, section titles
  displayBold: 'Fraunces_700Bold',
  body: 'WorkSans_400Regular', // UI, body text, prices
  bodyMedium: 'WorkSans_500Medium',
  bodySemiBold: 'WorkSans_600SemiBold',
} as const;

export const radii = {
  sm: 14,
  md: 18,
  lg: 24,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
