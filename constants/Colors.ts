import { colors } from './theme';

// Vint AR uses a single warm paper palette (no dark mode in the spec).
// Both keys point at the same tokens so existing light/dark lookups keep working.
const theme = {
  text: colors.ink,
  textSoft: colors.inkSoft,
  background: colors.paper,
  backgroundElevated: colors.paperElevated,
  tint: colors.olive,
  tintDeep: colors.oliveDeep,
  accent: colors.mustard,
  danger: colors.brick,
  border: colors.line,
  tabIconDefault: colors.inkSoft,
  tabIconSelected: colors.olive,
};

export default {
  light: theme,
  dark: theme,
};
