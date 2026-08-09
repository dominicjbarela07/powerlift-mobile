/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Dimensions, Platform, StyleSheet, type TextStyle } from 'react-native';

import { SLMovementCardMaterial } from '@/constants/movement-card-material';

export { SLMovementCardMaterial } from '@/constants/movement-card-material';

const templateCanvas = '#020205';
const templateText = '#FAF8FC';
const templateIcon = '#8994A3';
const templateAccent = '#AA62FF';

export const Colors = {
  light: {
    text: templateText,
    background: templateCanvas,
    tint: templateAccent,
    icon: templateIcon,
    tabIconDefault: templateIcon,
    tabIconSelected: templateAccent,
  },
  dark: {
    text: templateText,
    background: templateCanvas,
    tint: templateAccent,
    icon: templateIcon,
    tabIconDefault: templateIcon,
    tabIconSelected: templateAccent,
  },
};

/** Legacy Expo template aliases retained for compatibility, now on the app face. */
export const Fonts = {
  sans: 'Exo2-Regular',
  serif: 'Exo2-Regular',
  rounded: 'Exo2-Regular',
  mono: 'Michroma',
} as const;

export const SLColors = {
  /** OLED environment: the room stays cold and black; objects carry the light. */
  canvas: '#020205',
  canvasRaised: '#05050A',
  plane: '#100B16',
  object: '#181020',
  objectRaised: '#211329',
  focus: '#2A162A',
  focusRaised: '#39172F',
  scrim: 'rgba(1, 1, 4, 0.88)',
  borderSubtle: 'rgba(220, 218, 235, 0.09)',
  borderStandard: 'rgba(225, 221, 240, 0.16)',
  borderStrong: 'rgba(232, 226, 248, 0.27)',
  borderFocus: 'rgba(185, 104, 255, 0.68)',
  highlightQuiet: 'rgba(255, 255, 255, 0.025)',
  highlightObject: 'rgba(255, 255, 255, 0.055)',
  highlightFocus: 'rgba(255, 225, 247, 0.10)',
  illuminationAccent: 'rgba(170, 98, 255, 0.14)',
  pressedShade: 'rgba(3, 2, 7, 0.14)',
  lowerOcclusion: 'rgba(0, 0, 0, 0.10)',
  lowerOcclusionStrong: 'rgba(0, 0, 0, 0.16)',
  textPrimary: '#FAF8FC',
  textSecondary: '#C9C5D1',
  textMuted: '#8E899A',
  iconPrimary: '#E7EBF0',
  iconMuted: '#8994A3',

  /** Compatibility aliases point into the same workspace instead of creating atmospheres. */
  background: '#020205',
  backgroundRaised: '#0B0C13',
  surface: '#100B16',
  surfaceRaised: '#181020',
  surfaceMuted: '#130E1B',
  surfacePressed: '#2A1830',
  border: 'rgba(225, 221, 240, 0.16)',
  divider: 'rgba(220, 218, 235, 0.09)',
  text: '#EEEAF2',
  textStrong: '#FAF8FC',
  textSubtle: '#6F6B7B',
  textInverted: '#09050C',
  accent: '#AA62FF',
  accentSoft: '#20142A',
  accentMuted: '#D5B6FF',
  accentMagenta: '#E83D9A',
  accentRed: '#F25566',
  accentOrange: '#FF7A32',
  accentHot: '#FF3F79',
  total: '#C84FE2',
  squat: '#A85CFF',
  bench: '#ED4F91',
  deadlift: '#F05A63',
  success: '#8FB29A',
  successSoft: '#131821',
  warning: '#C8AB72',
  warningSoft: '#131821',
  danger: '#CE8787',
  dangerSoft: '#131821',
  info: '#91A9B5',
  infoSoft: '#131821',
  review: '#9B8BE8',
  reviewSoft: '#131821',
  white: '#FFFFFF',
  black: '#000000',
  surfaceCanvas: '#020205',
  surfaceFlat: '#100B16',
  surfaceInset: '#07070C',
  surfaceCommand: '#241826',
  surfaceSelected: '#2A1830',
  surfaceFloating: '#1B1122',
  surfaceMedia: '#090A10',
  surfaceDisabled: '#0C0C12',
  surfaceDestructive: '#241015',
  surfaceScrim: 'rgba(1, 1, 4, 0.88)',
  borderHairline: 'rgba(220, 218, 235, 0.07)',
  borderDefault: 'rgba(225, 221, 240, 0.16)',
  borderSelected: 'rgba(185, 104, 255, 0.68)',
  // Legacy token names remain for compatibility; interaction is now warm chalk,
  // while true violet is reserved for the logo and ceremonial recognition.
  accentViolet: '#A78BFA',
  accentVioletSoft: '#171C25',
  accentSteel: '#9AA6B5',
  accentSteelSoft: '#131821',
  accentCyanMuted: '#78AAB4',
  railViolet: '#A78BFA',
  railDanger: '#B96868',
  railWarning: '#AA8A52',
  railSuccess: '#789C82',
  shellCanvas: '#020205',
  shellCanvasDeep: '#010103',
  shellHairline: 'rgba(220, 218, 235, 0.07)',
  shellTabSurface: '#141521',
  surfaceEmbedded: '#0A0710',
} as const;

/** Energy is reserved for primary actions, active selection, and focus objects. */
export const SLGradients = {
  primary: ['#6928D0', '#7C226E', '#C42D78', '#E05261'] as const,
  primaryLocations: [0, 0.5, 0.82, 1] as const,
  primaryPressed: ['#5520AD', '#681C5D', '#A52665', '#C74653'] as const,
  focus: ['#281438', '#2D172D', '#30191F'] as const,
  selected: ['#211434', '#281527', '#2B171D'] as const,
  destructive: ['#5A1523', '#921D37', '#D43B4F'] as const,
} as const;

/**
 * Opaque manufactured-surface response. The workspace remains cold and flat;
 * object faces carry the existing warm-plum palette, directional light, edge
 * response, and lower contact without adding ambient screen decoration.
 */
export const SLMaterials = {
  1: {
    face: ['rgba(255, 232, 249, 0.045)', 'rgba(170, 98, 255, 0.018)', 'rgba(0, 0, 0, 0.10)'] as const,
    topEdge: 'rgba(255, 235, 249, 0.065)',
    sideEdge: 'rgba(211, 154, 228, 0.025)',
    lowerEdge: 'rgba(0, 0, 0, 0.15)',
    innerLight: 'rgba(255, 236, 249, 0.035)',
    innerDark: 'rgba(0, 0, 0, 0.20)',
  },
  2: {
    face: ['rgba(255, 232, 249, 0.075)', 'rgba(200, 79, 226, 0.03)', 'rgba(0, 0, 0, 0.13)'] as const,
    topEdge: 'rgba(255, 232, 248, 0.11)',
    sideEdge: 'rgba(224, 164, 238, 0.04)',
    lowerEdge: 'rgba(0, 0, 0, 0.19)',
    innerLight: 'rgba(255, 235, 249, 0.055)',
    innerDark: 'rgba(0, 0, 0, 0.26)',
  },
  3: {
    face: ['rgba(255, 226, 246, 0.11)', 'rgba(232, 61, 154, 0.045)', 'rgba(0, 0, 0, 0.16)'] as const,
    topEdge: 'rgba(255, 225, 247, 0.16)',
    sideEdge: 'rgba(238, 165, 222, 0.055)',
    lowerEdge: 'rgba(0, 0, 0, 0.24)',
    innerLight: 'rgba(255, 230, 247, 0.08)',
    innerDark: 'rgba(0, 0, 0, 0.33)',
  },
  faceLocations: [0, 0.42, 1] as const,
  accentLocations: [0, 0.46, 1] as const,
  accentMiddle: 'rgba(156, 55, 137, 0.075)',
  clear: 'rgba(0, 0, 0, 0)',
  pressedCompression: 'rgba(2, 2, 6, 0.16)',
} as const;

/**
 * Metric color is evidence identity, not state. Green remains reserved for
 * success/readiness/completion and destructive red remains separate from the
 * warmer deadlift family.
 */
export const SLMetricTones = {
  total: {
    solid: SLColors.total,
    label: '#E7A5F0',
    wash: 'rgba(200, 79, 226, 0.11)',
    illumination: 'rgba(200, 79, 226, 0.20)',
  },
  squat: {
    solid: SLColors.squat,
    label: '#D1AEFF',
    wash: 'rgba(168, 92, 255, 0.11)',
    illumination: 'rgba(168, 92, 255, 0.17)',
  },
  bench: {
    solid: SLColors.bench,
    label: '#F39ABA',
    wash: 'rgba(237, 79, 145, 0.10)',
    illumination: 'rgba(237, 79, 145, 0.16)',
  },
  deadlift: {
    solid: SLColors.deadlift,
    label: '#F69B9F',
    wash: 'rgba(240, 90, 99, 0.10)',
    illumination: 'rgba(240, 90, 99, 0.16)',
  },
} as const;

export const SLStatusTones = {
  neutral: {
    background: SLColors.surfaceMuted,
    border: SLColors.borderStrong,
    text: SLColors.text,
    icon: SLColors.textMuted,
  },
  info: {
    background: SLColors.infoSoft,
    border: SLColors.info,
    text: '#CCD8DD',
    icon: SLColors.info,
  },
  success: {
    background: SLColors.successSoft,
    border: SLColors.success,
    text: '#CADACF',
    icon: SLColors.success,
  },
  warning: {
    background: SLColors.warningSoft,
    border: SLColors.warning,
    text: '#DDCBA5',
    icon: SLColors.warning,
  },
  danger: {
    background: SLColors.dangerSoft,
    border: SLColors.danger,
    text: '#E1BABA',
    icon: SLColors.danger,
  },
  review: {
    background: SLColors.reviewSoft,
    border: SLColors.review,
    text: '#D6D0F5',
    icon: SLColors.review,
  },
  accent: {
    background: SLColors.accentSoft,
    border: SLColors.accent,
    text: SLColors.textStrong,
    icon: SLColors.accent,
  },
} as const;

export const SLSpacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 28,
} as const;

/**
 * Mobile layout law. These values describe product structure rather than
 * feature-local spacing, so screens do not each invent safe gutters and
 * clearance rules.
 */
export const SLLayout = {
  shellGutter: 10,
  compactGutter: 8,
  screenGutter: 10,
  screenTop: 12,
  screenBottom: 36,
  sectionGap: 28,
  compactSectionGap: 18,
  tabBarClearance: 96,
  bottomActionClearance: 112,
  feedbackOverlayTop: 112,
  contentMaxWidth: 720,
  collapsedTabWidth: 48,
  objectGap: 12,
  contentGap: 8,
  textGap: 4,
  mediaGap: 12,
  floatingUtilityClearance: 84,
  bottomTabClearance: 96,
  modalPadding: 20,
  sheetPadding: 20,
} as const;

export const SLControlSize = {
  compact: 34,
  standard: 42,
  comfortable: 50,
  minimumTouchTarget: 44,
  listRow: 56,
  queueRow: 64,
} as const;

export const SLIconSize = {
  micro: 12,
  compact: 15,
  standard: 18,
  prominent: 22,
  state: 24,
} as const;

export const SLOpacity = {
  disabled: 0.45,
  loading: 0.55,
  pressed: 1,
  muted: 0.72,
} as const;

/** Shared motion timings for established interaction and feedback patterns. */
export const SLMotion = {
  /** Direct manipulation: the interface should feel attached to the finger. */
  immediateMs: 100,
  /** Press/release acknowledgement for buttons, rows, and navigation. */
  pressMs: 140,
  /** Toggle, selection, and local state confirmation. */
  stateMs: 190,
  /** Card, section, and inline panel arrival. */
  componentMs: 260,
  /** Contextual sheet and spatial navigation transition. */
  spatialMs: 320,
  /** Short stagger used only to clarify hierarchy, never as decoration. */
  staggerMs: 42,
  pressScale: 0.982,
  prominentPressScale: 0.972,
  directSpring: { damping: 24, stiffness: 310, mass: 0.62 },
  settleSpring: { damping: 22, stiffness: 250, mass: 0.72 },
  modalContextual: 'fade',
  modalSheet: 'slide',
  feedbackEnterMs: 240,
  recognitionTrophyRevealMs: 800,
  saveConfirmationMs: 850,
  recognitionVisibleMs: 7000,
} as const;

export const SLRadius = {
  none: 0,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
  radiusSharp: 4,
  radiusControl: 10,
  radiusRow: 12,
  radiusCard: 18,
  radiusHero: 24,
  radiusSheet: 28,
  control: 10,
  object: 14,
  focus: 18,
  sheet: 24,
  circle: 999,
} as const;

export const SLFontFamilies = {
  /** Registered once by the root Expo font gate from bundled OFL assets. */
  primary: 'Exo2-Regular',
  display: 'Exo2-SemiBold',
  numeric: 'Michroma',
  technical: 'Exo2-Medium',
  body: 'Exo2-Regular',
  bodyMedium: 'Exo2-Medium',
  bodySemiBold: 'Exo2-SemiBold',
  bodyBold: 'Exo2-Bold',
  input: 'Exo2-Regular',
  fallback: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'system-ui',
    web: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  }),
  // Compatibility aliases keep existing surfaces on real bundled faces while
  // semantic roles are adopted. Michroma remains the machine/display voice;
  // Exo 2 is the readable human voice.
  sans: 'Exo2-Regular',
  sansMedium: 'Exo2-Medium',
  sansSemiBold: 'Exo2-SemiBold',
  sansBold: 'Exo2-Bold',
  mono: 'Michroma',
  monoSemiBold: 'Michroma',
} as const;

export const SLTypographyBreakpoints = {
  compactMax: 375,
  standardMax: 429,
} as const;

export type SLDeviceTypographySize = 'compact' | 'standard' | 'large';
export type SLTypographyRole =
  | 'screenTitle'
  | 'heroTitle'
  | 'pageTitle'
  | 'sectionTitle'
  | 'cardTitle'
  | 'movementTitle'
  | 'metricValue'
  | 'metadata'
  | 'metadataStrong'
  | 'buttonLabel'
  | 'micro'
  | 'shortTechnicalLabel'
  | 'navigationLabel'
  | 'tabLabel'
  | 'shortButtonLabel'
  | 'longButtonLabel'
  | 'heroNumeric'
  | 'numeric'
  | 'percentage'
  | 'unit'
  | 'milestoneThreshold'
  | 'badge'
  | 'body'
  | 'bodyStrong'
  | 'supportingBody'
  | 'caption'
  | 'dynamicName'
  | 'workoutName'
  | 'movementName'
  | 'messageText'
  | 'input'
  | 'inputPlaceholder'
  | 'modalTitle'
  | 'modalBody'
  | 'errorText'
  | 'emptyStateTitle'
  | 'emptyStateBody'
  // Compatibility roles retained while older feature surfaces migrate.
  | 'displayHero'
  | 'displayNumeric'
  | 'label'
  | 'button'
  | 'navigation';

export type SLTypographyTextBehavior = {
  wrapping: 'natural' | 'bounded' | 'single-line';
  maximumNumberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
};

const naturalText = { wrapping: 'natural' } as const;
const twoLineText = { wrapping: 'bounded', maximumNumberOfLines: 2, ellipsizeMode: 'tail' } as const;
const singleLineText = { wrapping: 'single-line', maximumNumberOfLines: 1, ellipsizeMode: 'tail' } as const;

/** Wrapping and truncation are semantic decisions, not screen-local guesses. */
export const SLTypographyTextBehaviors: Readonly<Record<SLTypographyRole, SLTypographyTextBehavior>> = {
  screenTitle: twoLineText,
  heroTitle: twoLineText,
  pageTitle: twoLineText,
  sectionTitle: twoLineText,
  cardTitle: twoLineText,
  movementTitle: twoLineText,
  metricValue: twoLineText,
  metadata: twoLineText,
  metadataStrong: twoLineText,
  buttonLabel: twoLineText,
  micro: twoLineText,
  shortTechnicalLabel: twoLineText,
  navigationLabel: singleLineText,
  tabLabel: singleLineText,
  shortButtonLabel: singleLineText,
  longButtonLabel: twoLineText,
  heroNumeric: singleLineText,
  numeric: singleLineText,
  percentage: singleLineText,
  unit: singleLineText,
  milestoneThreshold: singleLineText,
  badge: singleLineText,
  body: naturalText,
  bodyStrong: naturalText,
  supportingBody: naturalText,
  caption: twoLineText,
  dynamicName: twoLineText,
  workoutName: twoLineText,
  movementName: twoLineText,
  messageText: naturalText,
  input: naturalText,
  inputPlaceholder: naturalText,
  modalTitle: twoLineText,
  modalBody: naturalText,
  errorText: naturalText,
  emptyStateTitle: twoLineText,
  emptyStateBody: naturalText,
  displayHero: twoLineText,
  displayNumeric: singleLineText,
  label: twoLineText,
  button: singleLineText,
  navigation: singleLineText,
};

type ResponsiveMetric = Readonly<Record<SLDeviceTypographySize, number>>;

type SLTypographyRoleDefinition = {
  fontFamily: string;
  fontWeight: NonNullable<TextStyle['fontWeight']>;
  fontSize: ResponsiveMetric;
  lineHeight: ResponsiveMetric;
  letterSpacing: ResponsiveMetric;
  casing: 'preserve' | 'uppercase';
  maximumNumberOfLines?: number;
  maximumFontSizeMultiplier: number;
};

/**
 * Michroma is substantially wider than the previous app face. These bounded
 * roles intentionally change at phone-width breakpoints instead of applying a
 * global scale transform to every string.
 */
export const SLTypographyRoles: Readonly<Record<SLTypographyRole, SLTypographyRoleDefinition>> = {
  screenTitle: {
    fontFamily: SLFontFamilies.display,
    fontWeight: '400',
    fontSize: { compact: 32, standard: 33, large: 34 },
    lineHeight: { compact: 38, standard: 39, large: 40 },
    letterSpacing: { compact: -0.5, standard: -0.55, large: -0.6 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.35,
  },
  heroTitle: {
    fontFamily: SLFontFamilies.display,
    fontWeight: '400',
    fontSize: { compact: 26, standard: 28, large: 30 },
    lineHeight: { compact: 32, standard: 34, large: 36 },
    letterSpacing: { compact: -0.35, standard: -0.4, large: -0.45 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.4,
  },
  pageTitle: {
    fontFamily: SLFontFamilies.display,
    fontWeight: '400',
    fontSize: { compact: 32, standard: 33, large: 34 },
    lineHeight: { compact: 38, standard: 39, large: 40 },
    letterSpacing: { compact: -0.35, standard: -0.4, large: -0.45 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.2,
  },
  cardTitle: {
    fontFamily: SLFontFamilies.display,
    fontWeight: '400',
    fontSize: { compact: 18, standard: 19, large: 20 },
    lineHeight: { compact: 23, standard: 24, large: 25 },
    letterSpacing: { compact: -0.12, standard: -0.14, large: -0.16 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.35,
  },
  sectionTitle: {
    fontFamily: SLFontFamilies.technical,
    fontWeight: '400',
    fontSize: { compact: 20, standard: 21, large: 22 },
    lineHeight: { compact: 25, standard: 26, large: 27 },
    letterSpacing: { compact: 0.18, standard: 0.22, large: 0.25 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.2,
  },
  movementTitle: {
    fontFamily: SLFontFamilies.bodySemiBold,
    fontWeight: '400',
    fontSize: { compact: 18, standard: 19, large: 20 },
    lineHeight: { compact: 23, standard: 24, large: 25 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.5,
  },
  metricValue: {
    fontFamily: SLFontFamilies.numeric,
    fontWeight: '400',
    fontSize: { compact: 20, standard: 22, large: 24 },
    lineHeight: { compact: 26, standard: 28, large: 30 },
    letterSpacing: { compact: -0.2, standard: -0.25, large: -0.3 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.4,
  },
  metadata: {
    fontFamily: SLFontFamilies.body,
    fontWeight: '400',
    fontSize: { compact: 14, standard: 14, large: 15 },
    lineHeight: { compact: 20, standard: 20, large: 21 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.6,
  },
  metadataStrong: {
    fontFamily: SLFontFamilies.bodySemiBold,
    fontWeight: '400',
    fontSize: { compact: 14, standard: 14, large: 15 },
    lineHeight: { compact: 20, standard: 20, large: 21 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.6,
  },
  buttonLabel: {
    fontFamily: SLFontFamilies.bodySemiBold,
    fontWeight: '400',
    fontSize: { compact: 15, standard: 16, large: 17 },
    lineHeight: { compact: 20, standard: 21, large: 22 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.5,
  },
  micro: {
    fontFamily: SLFontFamilies.technical,
    fontWeight: '400',
    fontSize: { compact: 12, standard: 12, large: 13 },
    lineHeight: { compact: 16, standard: 16, large: 17 },
    letterSpacing: { compact: 0.2, standard: 0.24, large: 0.28 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.5,
  },
  shortTechnicalLabel: {
    fontFamily: SLFontFamilies.technical,
    fontWeight: '400',
    fontSize: { compact: 12, standard: 12.5, large: 13 },
    lineHeight: { compact: 16, standard: 16.5, large: 17 },
    letterSpacing: { compact: 0.22, standard: 0.28, large: 0.32 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.2,
  },
  navigationLabel: {
    fontFamily: SLFontFamilies.technical,
    fontWeight: '400',
    fontSize: { compact: 12, standard: 13, large: 14 },
    lineHeight: { compact: 16, standard: 17, large: 18 },
    letterSpacing: { compact: -0.05, standard: -0.06, large: -0.08 },
    casing: 'preserve',
    maximumNumberOfLines: 1,
    maximumFontSizeMultiplier: 1.2,
  },
  tabLabel: {
    fontFamily: SLFontFamilies.technical,
    fontWeight: '400',
    fontSize: { compact: 12, standard: 13, large: 14 },
    lineHeight: { compact: 16, standard: 17, large: 18 },
    letterSpacing: { compact: -0.05, standard: -0.06, large: -0.08 },
    casing: 'preserve',
    maximumNumberOfLines: 1,
    maximumFontSizeMultiplier: 1.2,
  },
  shortButtonLabel: {
    fontFamily: SLFontFamilies.technical,
    fontWeight: '400',
    fontSize: { compact: 15, standard: 16, large: 17 },
    lineHeight: { compact: 20, standard: 21, large: 22 },
    letterSpacing: { compact: -0.08, standard: -0.1, large: -0.12 },
    casing: 'preserve',
    maximumNumberOfLines: 1,
    maximumFontSizeMultiplier: 1.2,
  },
  longButtonLabel: {
    fontFamily: SLFontFamilies.bodyMedium,
    fontWeight: '400',
    fontSize: { compact: 15, standard: 16, large: 17 },
    lineHeight: { compact: 20, standard: 21, large: 22 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.4,
  },
  heroNumeric: {
    fontFamily: SLFontFamilies.numeric,
    fontWeight: '400',
    fontSize: { compact: 34, standard: 40, large: 46 },
    lineHeight: { compact: 38, standard: 44, large: 50 },
    letterSpacing: { compact: -0.55, standard: -0.65, large: -0.75 },
    casing: 'preserve',
    maximumNumberOfLines: 1,
    maximumFontSizeMultiplier: 1.2,
  },
  numeric: {
    fontFamily: SLFontFamilies.numeric,
    fontWeight: '400',
    fontSize: { compact: 24, standard: 28, large: 32 },
    lineHeight: { compact: 28, standard: 32, large: 36 },
    letterSpacing: { compact: -0.35, standard: -0.4, large: -0.45 },
    casing: 'preserve',
    maximumNumberOfLines: 1,
    maximumFontSizeMultiplier: 1.25,
  },
  percentage: {
    fontFamily: SLFontFamilies.numeric,
    fontWeight: '400',
    fontSize: { compact: 28, standard: 32, large: 36 },
    lineHeight: { compact: 32, standard: 36, large: 40 },
    letterSpacing: { compact: -0.45, standard: -0.5, large: -0.55 },
    casing: 'preserve',
    maximumNumberOfLines: 1,
    maximumFontSizeMultiplier: 1.2,
  },
  unit: {
    fontFamily: SLFontFamilies.technical,
    fontWeight: '400',
    fontSize: { compact: 12, standard: 13, large: 14 },
    lineHeight: { compact: 16, standard: 17, large: 18 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumNumberOfLines: 1,
    maximumFontSizeMultiplier: 1.4,
  },
  milestoneThreshold: {
    fontFamily: SLFontFamilies.numeric,
    fontWeight: '400',
    fontSize: { compact: 13, standard: 14, large: 16 },
    lineHeight: { compact: 17, standard: 18, large: 20 },
    letterSpacing: { compact: -0.08, standard: -0.1, large: -0.12 },
    casing: 'preserve',
    maximumNumberOfLines: 1,
    maximumFontSizeMultiplier: 1.3,
  },
  badge: {
    fontFamily: SLFontFamilies.technical,
    fontWeight: '400',
    fontSize: { compact: 12, standard: 12, large: 13 },
    lineHeight: { compact: 16, standard: 16, large: 17 },
    letterSpacing: { compact: 0.18, standard: 0.22, large: 0.25 },
    casing: 'preserve',
    maximumNumberOfLines: 1,
    maximumFontSizeMultiplier: 1.35,
  },
  body: {
    fontFamily: SLFontFamilies.body,
    fontWeight: '400',
    fontSize: { compact: 16, standard: 16, large: 17 },
    lineHeight: { compact: 23, standard: 23, large: 24 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumFontSizeMultiplier: 1.6,
  },
  bodyStrong: {
    fontFamily: SLFontFamilies.bodySemiBold,
    fontWeight: '400',
    fontSize: { compact: 16, standard: 16, large: 17 },
    lineHeight: { compact: 23, standard: 23, large: 24 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumFontSizeMultiplier: 1.6,
  },
  supportingBody: {
    fontFamily: SLFontFamilies.body,
    fontWeight: '400',
    fontSize: { compact: 14, standard: 15, large: 15 },
    lineHeight: { compact: 20, standard: 21, large: 22 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumFontSizeMultiplier: 1.6,
  },
  caption: {
    fontFamily: SLFontFamilies.body,
    fontWeight: '400',
    fontSize: { compact: 13, standard: 14, large: 15 },
    lineHeight: { compact: 18, standard: 19, large: 20 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.6,
  },
  dynamicName: {
    fontFamily: SLFontFamilies.bodySemiBold,
    fontWeight: '400',
    fontSize: { compact: 18, standard: 20, large: 22 },
    lineHeight: { compact: 23, standard: 25, large: 27 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.45,
  },
  workoutName: {
    fontFamily: SLFontFamilies.bodyMedium,
    fontWeight: '400',
    fontSize: { compact: 16, standard: 18, large: 20 },
    lineHeight: { compact: 21, standard: 23, large: 25 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.45,
  },
  movementName: {
    fontFamily: SLFontFamilies.bodyMedium,
    fontWeight: '400',
    fontSize: { compact: 18, standard: 19, large: 20 },
    lineHeight: { compact: 23, standard: 24, large: 25 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.45,
  },
  messageText: {
    fontFamily: SLFontFamilies.body,
    fontWeight: '400',
    fontSize: { compact: 15, standard: 16, large: 17 },
    lineHeight: { compact: 21, standard: 22, large: 24 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumFontSizeMultiplier: 1.7,
  },
  input: {
    fontFamily: SLFontFamilies.input,
    fontWeight: '400',
    fontSize: { compact: 16, standard: 17, large: 18 },
    lineHeight: { compact: 22, standard: 23, large: 24 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumFontSizeMultiplier: 1.6,
  },
  inputPlaceholder: {
    fontFamily: SLFontFamilies.input,
    fontWeight: '400',
    fontSize: { compact: 16, standard: 17, large: 18 },
    lineHeight: { compact: 22, standard: 23, large: 24 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumFontSizeMultiplier: 1.6,
  },
  modalTitle: {
    fontFamily: SLFontFamilies.display,
    fontWeight: '400',
    fontSize: { compact: 18, standard: 20, large: 22 },
    lineHeight: { compact: 22, standard: 24, large: 26 },
    letterSpacing: { compact: -0.18, standard: -0.2, large: -0.22 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.3,
  },
  modalBody: {
    fontFamily: SLFontFamilies.body,
    fontWeight: '400',
    fontSize: { compact: 14, standard: 15, large: 16 },
    lineHeight: { compact: 20, standard: 21, large: 23 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumFontSizeMultiplier: 1.6,
  },
  errorText: {
    fontFamily: SLFontFamilies.bodyMedium,
    fontWeight: '400',
    fontSize: { compact: 13, standard: 14, large: 15 },
    lineHeight: { compact: 18, standard: 19, large: 21 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumFontSizeMultiplier: 1.6,
  },
  emptyStateTitle: {
    fontFamily: SLFontFamilies.bodySemiBold,
    fontWeight: '400',
    fontSize: { compact: 17, standard: 19, large: 21 },
    lineHeight: { compact: 22, standard: 24, large: 26 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.5,
  },
  emptyStateBody: {
    fontFamily: SLFontFamilies.body,
    fontWeight: '400',
    fontSize: { compact: 14, standard: 15, large: 16 },
    lineHeight: { compact: 20, standard: 21, large: 23 },
    letterSpacing: { compact: 0, standard: 0, large: 0 },
    casing: 'preserve',
    maximumFontSizeMultiplier: 1.6,
  },
  displayHero: {
    fontFamily: SLFontFamilies.display,
    fontWeight: '400',
    fontSize: { compact: 34, standard: 38, large: 42 },
    lineHeight: { compact: 38, standard: 42, large: 46 },
    letterSpacing: { compact: -0.6, standard: -0.7, large: -0.8 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.2,
  },
  displayNumeric: {
    fontFamily: SLFontFamilies.numeric,
    fontWeight: '400',
    fontSize: { compact: 28, standard: 32, large: 36 },
    lineHeight: { compact: 32, standard: 36, large: 40 },
    letterSpacing: { compact: -0.45, standard: -0.5, large: -0.55 },
    casing: 'preserve',
    maximumNumberOfLines: 1,
    maximumFontSizeMultiplier: 1.25,
  },
  label: {
    fontFamily: SLFontFamilies.technical,
    fontWeight: '400',
    fontSize: { compact: 12, standard: 12.5, large: 13 },
    lineHeight: { compact: 16, standard: 16.5, large: 17 },
    letterSpacing: { compact: 0.22, standard: 0.28, large: 0.32 },
    casing: 'preserve',
    maximumNumberOfLines: 2,
    maximumFontSizeMultiplier: 1.45,
  },
  button: {
    fontFamily: SLFontFamilies.technical,
    fontWeight: '400',
    fontSize: { compact: 15, standard: 16, large: 17 },
    lineHeight: { compact: 20, standard: 21, large: 22 },
    letterSpacing: { compact: -0.08, standard: -0.1, large: -0.12 },
    casing: 'preserve',
    maximumNumberOfLines: 1,
    maximumFontSizeMultiplier: 1.35,
  },
  navigation: {
    fontFamily: SLFontFamilies.technical,
    fontWeight: '400',
    fontSize: { compact: 12, standard: 13, large: 14 },
    lineHeight: { compact: 16, standard: 17, large: 18 },
    letterSpacing: { compact: -0.05, standard: -0.06, large: -0.08 },
    casing: 'preserve',
    maximumNumberOfLines: 1,
    maximumFontSizeMultiplier: 1.35,
  },
};

export function getSLDeviceTypographySize(width: number): SLDeviceTypographySize {
  if (width <= SLTypographyBreakpoints.compactMax) return 'compact';
  if (width <= SLTypographyBreakpoints.standardMax) return 'standard';
  return 'large';
}

export function getSLTypographyRoleStyle(role: SLTypographyRole, width: number): TextStyle {
  const category = getSLDeviceTypographySize(width);
  const definition = SLTypographyRoles[role];
  return {
    fontFamily: definition.fontFamily,
    fontWeight: definition.fontWeight,
    fontSize: definition.fontSize[category],
    lineHeight: definition.lineHeight[category],
    letterSpacing: definition.letterSpacing[category],
  };
}

const compatibilityTypographySize = getSLDeviceTypographySize(Dimensions.get('window').width);

function getCompatibilityTypographyMetrics(role: SLTypographyRole) {
  const definition = SLTypographyRoles[role];
  return {
    fontSize: definition.fontSize[compatibilityTypographySize],
    lineHeight: definition.lineHeight[compatibilityTypographySize],
    letterSpacing: definition.letterSpacing[compatibilityTypographySize],
    fontWeight: definition.fontWeight,
    fontFamily: definition.fontFamily,
  };
}

/** Responsive compatibility aliases for legacy shared styles. */
export const SLTypography = {
  heroTitle: {
    ...getCompatibilityTypographyMetrics('heroTitle'),
  },
  movementTitle: {
    ...getCompatibilityTypographyMetrics('movementTitle'),
  },
  metricValue: {
    ...getCompatibilityTypographyMetrics('metricValue'),
  },
  metadata: {
    ...getCompatibilityTypographyMetrics('metadata'),
  },
  metadataStrong: {
    ...getCompatibilityTypographyMetrics('metadataStrong'),
  },
  hero: {
    ...getCompatibilityTypographyMetrics('displayHero'),
  },
  title: {
    ...getCompatibilityTypographyMetrics('pageTitle'),
  },
  sectionTitle: {
    ...getCompatibilityTypographyMetrics('sectionTitle'),
  },
  cardTitle: {
    ...getCompatibilityTypographyMetrics('cardTitle'),
  },
  body: {
    ...getCompatibilityTypographyMetrics('body'),
  },
  bodyStrong: {
    ...getCompatibilityTypographyMetrics('bodyStrong'),
  },
  label: {
    ...getCompatibilityTypographyMetrics('shortTechnicalLabel'),
  },
  caption: {
    ...getCompatibilityTypographyMetrics('caption'),
  },
  micro: {
    ...getCompatibilityTypographyMetrics('micro'),
  },
  screenTitle: {
    ...getCompatibilityTypographyMetrics('screenTitle'),
  },
  commandTitle: {
    ...getCompatibilityTypographyMetrics('pageTitle'),
  },
  sectionLabel: {
    ...getCompatibilityTypographyMetrics('shortTechnicalLabel'),
  },
  rowTitle: {
    ...getCompatibilityTypographyMetrics('body'),
    fontFamily: SLFontFamilies.sansSemiBold,
  },
  rowMeta: {
    ...getCompatibilityTypographyMetrics('supportingBody'),
  },
  utilityLabel: {
    ...getCompatibilityTypographyMetrics('shortTechnicalLabel'),
  },
  kpiNumber: {
    ...getCompatibilityTypographyMetrics('numeric'),
  },
  buttonLabel: {
    ...getCompatibilityTypographyMetrics('buttonLabel'),
  },
  chipLabel: {
    ...getCompatibilityTypographyMetrics('badge'),
  },
  note: {
    ...getCompatibilityTypographyMetrics('supportingBody'),
  },
} as const;

export const SLShadows = {
  none: {},
  level0: {},
  level1: {
    shadowColor: SLColors.black,
    shadowOpacity: 0.26,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  level2: {
    shadowColor: '#120817',
    shadowOpacity: 0.38,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  level3: {
    shadowColor: '#1F0B1A',
    shadowOpacity: 0.52,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  pressedLevel1: {
    shadowColor: SLColors.black,
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0,
  },
  pressedLevel2: {
    shadowColor: '#120817',
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pressedLevel3: {
    shadowColor: '#1F0B1A',
    shadowOpacity: 0.3,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  /** Compatibility names are aliases to the four approved levels. */
  shadowSoft: {} as const,
  card: {} as const,
  raised: {} as const,
  shadowCommand: {} as const,
  shadowSheet: {} as const,
} as const;

export const SLElevation = {
  0: {
    backgroundColor: SLColors.canvas,
    borderColor: 'transparent',
    borderWidth: 0,
    pressedBackgroundColor: SLColors.canvas,
    shadow: SLShadows.level0,
  },
  1: {
    backgroundColor: SLColors.plane,
    borderColor: SLColors.borderSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    pressedBackgroundColor: SLColors.surfacePressed,
    shadow: SLShadows.level1,
    pressedShadow: SLShadows.pressedLevel1,
  },
  2: {
    backgroundColor: SLColors.object,
    borderColor: SLColors.borderStandard,
    borderWidth: StyleSheet.hairlineWidth,
    pressedBackgroundColor: SLColors.surfacePressed,
    shadow: SLShadows.level2,
    pressedShadow: SLShadows.pressedLevel2,
  },
  3: {
    backgroundColor: SLColors.focus,
    borderColor: 'rgba(225, 221, 240, 0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    pressedBackgroundColor: SLColors.surfacePressed,
    shadow: SLShadows.level3,
    pressedShadow: SLShadows.pressedLevel3,
  },
} as const;

export const SLTheme = {
  colors: SLColors,
  gradients: SLGradients,
  materials: SLMaterials,
  movementCardMaterial: SLMovementCardMaterial,
  metricTones: SLMetricTones,
  statusTones: SLStatusTones,
  spacing: SLSpacing,
  layout: SLLayout,
  controlSize: SLControlSize,
  iconSize: SLIconSize,
  opacity: SLOpacity,
  motion: SLMotion,
  radius: SLRadius,
  fontFamilies: SLFontFamilies,
  typography: SLTypography,
  shadows: SLShadows,
  elevation: SLElevation,
} as const;

export type SLStatusTone = keyof typeof SLStatusTones;
