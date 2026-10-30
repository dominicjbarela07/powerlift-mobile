import { SLColors, SLFontFamilies, SLRadius } from './theme';

/** Ledger product presentation; colors and faces remain governed by the app theme. */
export const LEDGER = {
  colors: {
    canvas: SLColors.backgroundRaised,
    panel: SLColors.infoSoft,
    inset: SLColors.surfaceInset,
    raised: SLColors.shellTabSurface,
    text: SLColors.textStrong,
    secondary: SLColors.textSecondary,
    muted: SLColors.textMuted,
    line: SLColors.borderStandard,
    strongLine: SLColors.borderStrong,
    accent: SLColors.accentMuted,
    action: SLColors.textStrong,
    onAction: SLColors.textInverted,
    success: SLColors.success,
    gold: SLColors.warning,
    squat: SLColors.squat,
    bench: SLColors.bench,
    deadlift: SLColors.deadlift,
    teal: SLColors.accentCyanMuted,
    scrim: SLColors.scrim,
  },
  fonts: SLFontFamilies,
  radius: { control: SLRadius.control, panel: SLRadius.md, sheet: SLRadius.sheet, phone: SLRadius.xl, orbit: 95 },
  type: { micro: 11, caption: 12, small: 13, body: 15, lead: 17, section: 20, title: 30, hero: 44, number: 50, studio: 40 },
  space: { xs: 4, sm: 8, md: 12, lg: 20, xl: 28, xxl: 40 },
} as const;
