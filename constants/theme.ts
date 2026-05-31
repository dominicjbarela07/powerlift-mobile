/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#070807',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const SLColors = {
  background: '#020617',
  backgroundRaised: '#07111F',
  surface: '#0B1220',
  surfaceRaised: '#111827',
  surfaceMuted: '#162033',
  surfacePressed: '#1F2937',
  border: '#1F2937',
  borderStrong: '#334155',
  divider: '#172033',
  text: '#E5E7EB',
  textStrong: '#F9FAFB',
  textMuted: '#9CA3AF',
  textSubtle: '#6B7280',
  textInverted: '#020617',
  accent: '#38BDF8',
  accentSoft: '#0C4A6E',
  accentMuted: '#7DD3FC',
  success: '#34D399',
  successSoft: '#064E3B',
  warning: '#FBBF24',
  warningSoft: '#713F12',
  danger: '#F87171',
  dangerSoft: '#7F1D1D',
  info: '#60A5FA',
  infoSoft: '#1E3A8A',
  review: '#A78BFA',
  reviewSoft: '#4C1D95',
  white: '#FFFFFF',
  black: '#000000',
  surfaceCanvas: '#020617',
  surfaceFlat: '#08101D',
  surfaceInset: '#050A13',
  surfaceCommand: '#0C1424',
  surfaceSelected: '#121A2A',
  surfaceScrim: 'rgba(2, 6, 23, 0.78)',
  borderHairline: 'rgba(148, 163, 184, 0.10)',
  borderSubtle: 'rgba(148, 163, 184, 0.16)',
  borderDefault: '#1F2937',
  borderSelected: 'rgba(167, 139, 250, 0.44)',
  accentViolet: '#A78BFA',
  accentVioletSoft: 'rgba(76, 29, 149, 0.32)',
  accentSteel: '#7EA6B8',
  accentSteelSoft: 'rgba(51, 65, 85, 0.58)',
  accentCyanMuted: '#67B7D1',
  railViolet: '#8B5CF6',
  railDanger: '#EF4444',
  railWarning: '#D97706',
  railSuccess: '#10B981',
  gradientHeroStart: '#101827',
  gradientHeroEnd: '#060B14',
  shellCanvas: '#050505',
  shellCanvasDeep: '#050505',
  shellGradientTop: '#24172F',
  shellGradientMid: '#111016',
  shellGradientDark: '#070707',
  shellGradientWarm: '#0A0807',
  shellGlowViolet: 'rgba(126, 101, 255, 0.035)',
  shellGlowSteel: 'rgba(96, 137, 134, 0.052)',
  shellGlowWarm: 'rgba(126, 91, 58, 0.035)',
  shellHairline: 'rgba(205, 194, 176, 0.038)',
  shellTabSurface: 'rgba(7, 8, 7, 0.46)',
  surfaceTranslucent: 'rgba(14, 16, 17, 0.44)',
  surfaceEmbedded: 'rgba(10, 11, 11, 0.28)',
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
    border: '#2563EB',
    text: '#BFDBFE',
    icon: SLColors.info,
  },
  success: {
    background: SLColors.successSoft,
    border: '#059669',
    text: '#A7F3D0',
    icon: SLColors.success,
  },
  warning: {
    background: SLColors.warningSoft,
    border: '#B45309',
    text: '#FDE68A',
    icon: SLColors.warning,
  },
  danger: {
    background: SLColors.dangerSoft,
    border: '#DC2626',
    text: '#FECACA',
    icon: SLColors.danger,
  },
  review: {
    background: SLColors.reviewSoft,
    border: '#7C3AED',
    text: '#DDD6FE',
    icon: SLColors.review,
  },
  accent: {
    background: SLColors.accentSoft,
    border: '#0284C7',
    text: '#BAE6FD',
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

export const SLRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
  radiusSharp: 4,
  radiusControl: 6,
  radiusRow: 8,
  radiusCard: 12,
  radiusHero: 16,
  radiusSheet: 20,
} as const;

export const SLFontFamilies = {
  fallback: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'system-ui',
    web: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  }),
  sans: 'Geist_400Regular',
  sansMedium: 'Geist_500Medium',
  sansSemiBold: 'Geist_600SemiBold',
  sansBold: 'Geist_700Bold',
  mono: 'GeistMono_400Regular',
  monoSemiBold: 'GeistMono_600SemiBold',
} as const;

export const SLTypography = {
  hero: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansBold,
    letterSpacing: 0,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansBold,
    letterSpacing: 0,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansBold,
    letterSpacing: 0,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansBold,
    letterSpacing: 0,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sans,
    letterSpacing: 0,
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansSemiBold,
    letterSpacing: 0,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansSemiBold,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansMedium,
    letterSpacing: 0,
  },
  micro: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansBold,
    letterSpacing: 0,
  },
  screenTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansBold,
    letterSpacing: 0,
  },
  commandTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansBold,
    letterSpacing: 0,
  },
  sectionLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansBold,
    letterSpacing: 0.4,
  },
  rowTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansSemiBold,
    letterSpacing: 0,
  },
  rowMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansMedium,
    letterSpacing: 0,
  },
  utilityLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansBold,
    letterSpacing: 0.4,
  },
  kpiNumber: {
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '400',
    fontFamily: SLFontFamilies.monoSemiBold,
    letterSpacing: 0,
  },
  buttonLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansBold,
    letterSpacing: 0,
  },
  chipLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sansBold,
    letterSpacing: 0,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: SLFontFamilies.sans,
    letterSpacing: 0,
  },
} as const;

export const SLShadows = {
  none: {},
  shadowSoft: {
    shadowColor: SLColors.black,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  card: {
    shadowColor: SLColors.black,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  raised: {
    shadowColor: SLColors.black,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  shadowCommand: {
    shadowColor: SLColors.black,
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  shadowSheet: {
    shadowColor: SLColors.black,
    shadowOpacity: 0.34,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
} as const;

export const SLTheme = {
  colors: SLColors,
  statusTones: SLStatusTones,
  spacing: SLSpacing,
  radius: SLRadius,
  fontFamilies: SLFontFamilies,
  typography: SLTypography,
  shadows: SLShadows,
} as const;

export type SLStatusTone = keyof typeof SLStatusTones;
