export const MOBILE_TEXT_STRESS_FIXTURES = Object.freeze({
  movementTitles: Object.freeze([
    'Single-Arm Plate-Loaded Iso-Lateral High Row',
    'Competition Bench Press — 3ct Pause',
    'Chest-Supported Dumbbell Row',
    'Neutral-Grip Lat Pulldown',
  ]),
  sessionTitle: 'W12 Competition Bench Press Technique and Upper Back Development Session',
  programTitle: '2026 National Championship Preparatory Strength and Peaking Program',
  blockTitle: 'Competition Specificity, Technical Reinforcement, and Fatigue Management',
  athleteName: 'Alexandria Montgomery-Washington',
  equipmentIdentity: 'Prime Fitness Hybrid Selectorized Plate-Loaded Row — Long-Arm Configuration',
  loggerTitle: 'Competition Bench Press with Two-Count Pause (Primary) · Set 12',
  prescribedLoad: 'Prescribed: 467.5 lb × 12 @9.5 RPE · 3-second eccentric · 2-second pause',
  decimalLbValue: '467.5 lb',
  fourDigitLbValue: '1,084.5 lb',
  decimalKgValue: '212.5 kg',
  comparisonValue: '289,934.75 lb · −27.4% vs matched period',
  dateRange: 'September 28, 2025 – September 7, 2026',
  status: 'Awaiting athlete review and coach programming confirmation',
  actionLabel: 'Review Athlete Session Evidence',
});

/**
 * React Native can vertically crop a custom-font glyph when a legacy local
 * lineHeight is smaller than a newer responsive fontSize. Preserve deliberate
 * line heights, but repair the invalid case instead of shrinking the text.
 */
export function guardedMobileLineHeight(fontSize: unknown, lineHeight: unknown): number | undefined {
  if (typeof fontSize !== 'number' || !Number.isFinite(fontSize)) return undefined;
  if (typeof lineHeight !== 'number' || !Number.isFinite(lineHeight)) return undefined;
  if (lineHeight >= fontSize) return undefined;
  return Math.ceil(fontSize * 1.18);
}
