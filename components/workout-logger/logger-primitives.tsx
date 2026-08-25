import React from 'react';
import { Image, type ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLShadows, SLTypography } from '@/constants/theme';
import { SLButton, SLMotionPressable } from '@/components/ui';
import type { LoggerPlateStack } from '@/lib/logger-visual-context';
import { SurfaceWeightUnitToggle } from '@/components/ui/surface-weight-unit-toggle';

export function MovementCompleteSummary({
  title,
  meta,
  top,
  onExpand,
}: {
  title: string;
  meta: string;
  top?: string | null;
  onExpand: () => void;
}) {
  return (
    <View style={styles.completedMovementSummary}>
      <View style={styles.completedMovementHeader}>
        <Text style={styles.completedMovementTitle}>{title}</Text>
        <View style={styles.completedMovementBadge}>
          <Text style={styles.completedMovementBadgeText}>Complete</Text>
        </View>
      </View>
      <Text style={styles.completedMovementMeta}>{meta}</Text>
      {top ? <Text style={styles.completedMovementTop}>{top}</Text> : null}
      <SLMotionPressable style={styles.completedMovementAction} onPress={onExpand}>
        <Text style={styles.completedMovementActionText}>View / Edit</Text>
      </SLMotionPressable>
    </View>
  );
}

export function LogSheetUnitToggle({
  unit,
  onChange,
}: {
  unit: 'kg' | 'lb';
  onChange: (unit: 'kg' | 'lb') => void;
}) {
  return <SurfaceWeightUnitToggle unit={unit} onChange={onChange} />;
}

export function SessionUnitFloatingControl({
  unit,
  bottom,
  disabled = false,
  onChange,
}: {
  unit: 'kg' | 'lb';
  bottom: number;
  disabled?: boolean;
  onChange: (unit: 'kg' | 'lb') => void;
}) {
  const nextUnit = unit === 'kg' ? 'lb' : 'kg';
  return (
    <SLMotionPressable
      accessibilityRole="button"
      accessibilityLabel={`Display unit: ${unit}. Switch to ${nextUnit}`}
      accessibilityHint="Switches every Session weight display to the other unit."
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChange(nextUnit)}
      style={[styles.sessionUnitFloatingControl, { bottom }, disabled && styles.sessionUnitFloatingControlDisabled]}
    >
      <Text style={styles.sessionUnitFloatingControlText}>{unit}</Text>
    </SLMotionPressable>
  );
}

export function LoggerPlateStackVisual({
  plateStack,
  style,
}: {
  plateStack: LoggerPlateStack;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      accessibilityLabel={plateStack.accessibilityLabel}
      resizeMode="contain"
      source={plateStack.imageSource}
      style={[styles.loggerPlateStackVisual, style, plateStack.presentationStyle]}
    />
  );
}

export function CoreWheelLogButton({ onPress }: { onPress: () => void }) {
  return <SLButton fullWidth label="Log Set" onPress={onPress} size="lg" style={styles.coreWheelButton} />;
}

export function CoreRepeatLastButton({ onPress }: { onPress: () => void }) {
  return <SLButton label="Repeat Last" onPress={onPress} size="sm" variant="secondary" style={styles.coreRepeatLastButton} />;
}

export function LoggedSetRow({
  actualText,
  canEdit,
  onEdit,
  style,
}: {
  actualText: React.ReactNode;
  canEdit?: boolean;
  onEdit?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.loggedRowInline, style]}>
      <Text style={styles.actualTextInline}>{actualText}</Text>
      {canEdit && onEdit ? (
        <SLMotionPressable style={styles.inlineEditButtonInline} onPress={onEdit}>
          <Text style={styles.inlineEditButtonText}>Edit</Text>
        </SLMotionPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  completedMovementSummary: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: SLRadius.radiusCard,
    borderWidth: 1,
    borderColor: 'rgba(143,178,154,0.36)',
    backgroundColor: SLColors.object,
  },
  completedMovementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  completedMovementTitle: {
    flex: 1,
    ...SLTypography.bodyStrong,
    color: SLColors.text,
    fontWeight: '800',
  },
  completedMovementBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: SLColors.success,
    backgroundColor: SLColors.successSoft,
  },
  completedMovementBadgeText: {
    ...SLTypography.micro,
    color: SLColors.success,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  completedMovementMeta: {
    ...SLTypography.label,
    color: SLColors.text,
    fontWeight: '700',
    marginTop: 7,
  },
  completedMovementTop: {
    ...SLTypography.caption,
    color: SLColors.textMuted,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 3,
  },
  completedMovementAction: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
    backgroundColor: SLColors.accentVioletSoft,
  },
  completedMovementActionText: {
    ...SLTypography.caption,
    color: SLColors.accentViolet,
    fontWeight: '900',
  },
  unitTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SLColors.object,
    borderRadius: SLRadius.radiusCard,
    padding: 3,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  unitToggleOption: {
    minWidth: 50,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: SLRadius.radiusRow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitToggleOptionActive: {
    backgroundColor: SLColors.surfaceSelected,
    borderColor: SLColors.borderFocus,
    borderWidth: 1,
    ...SLShadows.level2,
  },
  unitToggleText: {
    ...SLTypography.label,
    color: SLColors.textMuted,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  unitToggleTextActive: {
    color: SLColors.textStrong,
  },
  sessionUnitFloatingControl: {
    position: 'absolute',
    right: 0,
    width: 48,
    height: 48,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.focus,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    zIndex: 10,
    ...SLShadows.card,
  },
  sessionUnitFloatingControlDisabled: {
    opacity: 0.45,
  },
  sessionUnitFloatingControlText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  loggerPlateStackVisual: {
    width: '100%',
    height: '100%',
  },
  coreWheelButton: {
    marginTop: 10,
  },
  coreRepeatLastButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    marginBottom: 0,
  },
  loggedRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingVertical: 4,
  },
  actualTextInline: {
    ...SLTypography.rowTitle,
    color: SLColors.text,
    fontWeight: '600',
  },
  inlineEditButtonInline: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: SLRadius.radiusRow,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: SLColors.object,
  },
  inlineEditButtonText: {
    ...SLTypography.caption,
    color: SLColors.accentViolet,
    fontWeight: '700',
  },
});
