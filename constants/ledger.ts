import { SLColors, SLFontFamilies, SLRadius, SLLedgerMaterial } from './theme';

/** Ledger product presentation; colors and faces remain governed by the app theme. */
export const LEDGER = {
  colors: {
    canvas: SLLedgerMaterial.canvas,
    panel: SLLedgerMaterial.face,
    inset: SLLedgerMaterial.chartFace,
    raised: SLLedgerMaterial.raised,
    text: SLLedgerMaterial.text,
    secondary: SLLedgerMaterial.secondary,
    muted: SLLedgerMaterial.muted,
    line: SLLedgerMaterial.subtleLine,
    strongLine: SLLedgerMaterial.line,
    accent: SLLedgerMaterial.accent,
    action: SLLedgerMaterial.accentFace,
    onAction: SLColors.textStrong,
    success: SLColors.success,
    danger: SLColors.danger,
    gold: SLColors.warning,
    squat: SLColors.squat,
    bench: SLColors.bench,
    deadlift: SLColors.deadlift,
    teal: SLColors.accentCyanMuted,
    scrim: SLColors.scrim,
  },
  material: SLLedgerMaterial,
  fonts: SLFontFamilies,
  radius: { control: SLRadius.control, panel: SLRadius.lg, sheet: SLRadius.sheet, phone: SLRadius.xl, orbit: 95, hairline: 2, xs: 4, sm: 5, chip: 12, inner: 10, tight: 8, card: 16, material: 18 },
  type: { micro: 11, caption: 12, small: 13, body: 15, lead: 17, section: 20, title: 30, hero: 44, number: 50, studio: 40, heading: 26, screenTitle: 27, record: 48, cardNumber: 32, row: 19, bodyStrong: 16, bodySmall: 14, sectionCompact: 19, numberSmall: 23 },
  space: { hairline: 2, xs: 4, sm: 8, md: 12, lg: 20, xl: 28, xxl: 40 },
} as const;
