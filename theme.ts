// theme.ts
import { SLColors, SLFontFamilies, SLRadius, SLShadows, SLSpacing, SLStatusTones, SLTheme, SLTypography } from './constants/theme';

export const colors = {
  bg: SLColors.shellCanvas,
  cardBg: SLColors.surfaceFlat,
  border: SLColors.borderDefault,
  textPrimary: SLColors.text,
  textStrong: SLColors.textStrong,
  textMuted: SLColors.textMuted,
  textMutedSecondary: SLColors.textSubtle,
  danger: SLColors.danger,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

export const typography = {
  // Matches Coach Dashboard title
  h1: {
    ...SLTypography.screenTitle,
    color: colors.textStrong,
  },
  // Matches sectionTitle (Needs Attention / Work Queue)
  h2: {
    ...SLTypography.sectionTitle,
    color: colors.textPrimary,
  },
  // Matches cardTitle (card headings)
  h3: {
    ...SLTypography.cardTitle,
    color: colors.textPrimary,
  },
  // Matches listText (athlete names in Needs Attention)
  body: {
    ...SLTypography.body,
    color: colors.textPrimary,
  },
  // Matches mutedText
  bodyMuted: {
    ...SLTypography.rowMeta,
    color: colors.textMutedSecondary,
  },
  // Matches kpiLabel
  label: {
    ...SLTypography.label,
    color: colors.textMuted,
  },
  // Matches kpiHint
  small: {
    ...SLTypography.caption,
    color: colors.textMutedSecondary,
  },
  // Matches KPI number style
  kpi: {
    ...SLTypography.kpiNumber,
    color: colors.textPrimary,
  },
  // For badge text (like “You”)
  badge: {
    ...SLTypography.chipLabel,
    color: colors.textMuted,
  },
  // Error text
  error: {
    ...SLTypography.label,
    color: colors.danger,
  },
};

export {
  SLColors,
  SLFontFamilies,
  SLRadius,
  SLShadows,
  SLSpacing,
  SLStatusTones,
  SLTheme,
  SLTypography,
  type SLStatusTone,
} from './constants/theme';
