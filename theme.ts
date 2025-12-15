// theme.ts
export const colors = {
  bg: '#020617',
  cardBg: '#020617',
  border: '#1F2937',
  textPrimary: '#E5E7EB',
  textStrong: '#F9FAFB',
  textMuted: '#9CA3AF',
  textMutedSecondary: '#6B7280',
  danger: '#f97373',
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
    fontSize: 22,
    fontWeight: '600' as const,
    color: colors.textStrong,
  },
  // Matches sectionTitle (Needs Attention / Work Queue)
  h2: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  // Matches cardTitle (card headings)
  h3: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  // Matches listText (athlete names in Needs Attention)
  body: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  // Matches mutedText
  bodyMuted: {
    fontSize: 14,
    color: colors.textMutedSecondary,
  },
  // Matches kpiLabel
  label: {
    fontSize: 14,
    color: colors.textMuted,
  },
  // Matches kpiHint
  small: {
    fontSize: 12,
    color: colors.textMutedSecondary,
  },
  // Matches KPI number style
  kpi: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  // For badge text (like “You”)
  badge: {
    fontSize: 12,
    color: colors.textMuted,
  },
  // Error text
  error: {
    fontSize: 13,
    color: colors.danger,
  },
};