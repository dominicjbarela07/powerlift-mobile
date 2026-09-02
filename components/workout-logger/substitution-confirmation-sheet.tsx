import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { Text } from '@/components/ui/sl-text';
import { LoggerWheelPicker } from '@/components/workout-logger/logger-wheel-picker';
import {
  SLColors,
  SLFontFamilies,
  SLRadius,
  SLShadows,
  SLSpacing,
  SLTypography,
} from '@/constants/theme';
import type { CanonicalMovementArtworkInput } from '@/lib/canonical-movement-artwork';
import {
  accessoryRepRangeAfterLowerChange,
  accessoryRepRangeAfterUpperChange,
  decimalWheelOptions,
  integerWheelOptions,
  transitionAccessoryRepTarget,
  type AccessoryRepTarget,
} from '@/lib/prescription-wheel-options';

type GovernedAccessoryIdentity = NonNullable<CanonicalMovementArtworkInput['movement_identity']> & {
  display_name?: string | null;
};

type Props = Readonly<{
  visible: boolean;
  programmedName: string;
  programmedIdentity?: GovernedAccessoryIdentity | null;
  performingName: string;
  performingIdentity?: GovernedAccessoryIdentity | null;
  editablePrescription: boolean;
  sets: string;
  rir: string;
  repTarget: AccessoryRepTarget;
  saving?: boolean;
  onSetsChange: (value: string) => void;
  onRirChange: (value: string) => void;
  onRepTargetChange: (value: AccessoryRepTarget) => void;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}>;

const REP_MODES = ['FIXED', 'RANGE', 'AMRAP'] as const;

export function SubstitutionConfirmationSheet({
  visible,
  programmedName,
  programmedIdentity,
  performingName,
  performingIdentity,
  editablePrescription,
  sets,
  rir,
  repTarget,
  saving = false,
  onSetsChange,
  onRirChange,
  onRepTargetChange,
  onBack,
  onCancel,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View accessibilityViewIsModal style={styles.backdrop}>
        <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onPress={onCancel} style={styles.backdropHit} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SLSpacing.sm) }]}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <TouchableOpacity accessibilityLabel="Choose a different substitute" accessibilityRole="button" disabled={saving} onPress={onBack} style={styles.headerButton}>
              <Ionicons color={SLColors.textStrong} name="arrow-back" size={22} />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text adjustsFontSizeToFit maxFontSizeMultiplier={1.15} minimumFontScale={0.88} numberOfLines={1} style={styles.title}>Confirm Substitution</Text>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.subtitle}>Set the plan before logging</Text>
            </View>
            <TouchableOpacity accessibilityLabel="Close substitution confirmation" accessibilityRole="button" disabled={saving} onPress={onCancel} style={styles.headerButton}>
              <Ionicons color={SLColors.textStrong} name="close" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView
            bounces={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <View accessibilityLabel={`Programmed ${programmedName}. Performing ${performingName}.`} style={styles.identityTransition}>
              <View style={styles.programmedRow}>
                <CanonicalMovementArtwork
                  movement={programmedIdentity ? { movement_identity: programmedIdentity } : null}
                  size={58}
                  style={styles.programmedArtwork}
                  testID="substitution-programmed-artwork"
                />
                <View style={styles.identityCopy}>
                  <Text maxFontSizeMultiplier={1.2} style={styles.programmedKicker}>PROGRAMMED</Text>
                  <Text maxFontSizeMultiplier={1.35} numberOfLines={2} style={styles.programmedName}>{programmedName}</Text>
                </View>
              </View>

              <View pointerEvents="none" style={styles.transitionRail}>
                <View style={styles.transitionLine} />
                <View style={styles.transitionBadge}>
                  <Ionicons color={SLColors.accentViolet} name="arrow-down" size={20} />
                </View>
                <View style={styles.transitionLine} />
              </View>

              <LinearGradient colors={['rgba(118,55,191,0.30)', 'rgba(31,12,42,0.92)', 'rgba(10,9,16,0.98)']} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.performingCard}>
                <CanonicalMovementArtwork
                  movement={performingIdentity ? { effective_movement_identity: performingIdentity } : null}
                  size={82}
                  style={styles.performingArtwork}
                  testID="substitution-performing-artwork"
                />
                <View style={styles.identityCopy}>
                  <View style={styles.performingKickerRow}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.performingKicker}>PERFORMING</Text>
                    <View style={styles.canonicalPill}>
                      <Ionicons color={SLColors.success} name="checkmark-circle" size={14} />
                      <Text maxFontSizeMultiplier={1.15} style={styles.canonicalPillText}>CANONICAL</Text>
                    </View>
                  </View>
                  <Text maxFontSizeMultiplier={1.35} numberOfLines={3} style={styles.performingName}>{performingName}</Text>
                </View>
              </LinearGradient>
            </View>

            {editablePrescription ? (
              <View style={styles.prescriptionSection}>
                <View style={styles.sectionHeading}>
                  <Text maxFontSizeMultiplier={1.2} style={styles.sectionKicker}>MOVEMENT PRESCRIPTION</Text>
                  <Text maxFontSizeMultiplier={1.25} style={styles.sectionHint}>Applies to this movement</Text>
                </View>

                <View style={styles.wheelPanel}>
                  <LoggerWheelPicker
                    density="sheet"
                    grouped
                    columns={[
                      {
                        key: 'substitution-sets',
                        label: 'SETS',
                        value: sets || '3',
                        options: integerWheelOptions(1, 12, sets),
                        onChange: onSetsChange,
                      },
                      {
                        key: 'substitution-rir',
                        label: 'RIR',
                        value: rir || '2',
                        options: decimalWheelOptions(0, 5, 0.5, rir),
                        onChange: onRirChange,
                      },
                    ]}
                    style={styles.primaryWheels}
                  />
                </View>

                <View style={styles.repSection}>
                  <Text maxFontSizeMultiplier={1.2} style={styles.repTargetLabel}>REP TARGET</Text>
                  <View accessibilityRole="tablist" style={styles.segmentedControl}>
                    {REP_MODES.map((mode) => {
                      const selected = repTarget.mode === mode;
                      const label = mode === 'FIXED' ? 'Single' : mode === 'RANGE' ? 'Range' : 'AMRAP';
                      return (
                        <TouchableOpacity
                          accessibilityRole="tab"
                          accessibilityState={{ selected }}
                          key={mode}
                          onPress={() => onRepTargetChange(transitionAccessoryRepTarget(
                            repTarget,
                            mode,
                            {
                              fixed: repTarget.mode === 'FIXED' ? repTarget.fixed : null,
                              range: repTarget.mode === 'RANGE' ? { low: repTarget.low, high: repTarget.high } : null,
                            },
                          ).target)}
                          style={[styles.segment, selected && styles.segmentActive]}
                        >
                          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.segmentText, selected && styles.segmentTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {repTarget.mode === 'FIXED' ? (
                    <View style={styles.repWheelPanel}>
                      <LoggerWheelPicker
                        density="sheet"
                        grouped
                        columns={[{
                          key: 'substitution-reps',
                          label: 'REPS',
                          value: repTarget.fixed,
                          options: integerWheelOptions(1, 50, repTarget.fixed),
                          onChange: (fixed) => onRepTargetChange({ mode: 'FIXED', fixed }),
                        }]}
                      />
                    </View>
                  ) : repTarget.mode === 'RANGE' ? (
                    <View style={styles.repWheelPanel}>
                      <LoggerWheelPicker
                        density="sheet"
                        grouped
                        separator="—"
                        columns={[
                          {
                            key: 'substitution-min-reps',
                            label: 'MIN REPS',
                            value: repTarget.low,
                            options: integerWheelOptions(1, 50, repTarget.low),
                            onChange: (low) => onRepTargetChange(accessoryRepRangeAfterLowerChange(low, repTarget.high)),
                          },
                          {
                            key: 'substitution-max-reps',
                            label: 'MAX REPS',
                            value: repTarget.high,
                            options: integerWheelOptions(1, 50, repTarget.high),
                            onChange: (high) => onRepTargetChange(accessoryRepRangeAfterUpperChange(repTarget.low, high)),
                          },
                        ]}
                      />
                    </View>
                  ) : (
                    <View style={styles.amrapCard}>
                      <View style={styles.amrapIcon}>
                        <Ionicons color={SLColors.review} name="infinite" size={28} />
                      </View>
                      <View style={styles.amrapCopy}>
                        <Text maxFontSizeMultiplier={1.3} style={styles.amrapTitle}>As many reps as possible</Text>
                        <Text maxFontSizeMultiplier={1.25} style={styles.amrapBody}>Each set uses an AMRAP target. Sets and RIR remain editable above.</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.preservedPrescription}>
                <Ionicons color={SLColors.accentViolet} name="lock-closed" size={20} />
                <Text maxFontSizeMultiplier={1.3} style={styles.preservedPrescriptionText}>The programmed sets, reps, and RIR will remain unchanged.</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={onCancel} style={styles.cancelButton}>
              <Text maxFontSizeMultiplier={1.25} style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={onConfirm} style={[styles.confirmButton, saving && styles.disabled]}>
              <LinearGradient colors={['#7838DF', '#B62574', '#D44762']} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={styles.confirmGradient}>
                {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                  <>
                    <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.confirmText}>Confirm Swap</Text>
                    <Ionicons color="#FFFFFF" name="arrow-forward" size={20} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.78)' },
  backdropHit: { ...StyleSheet.absoluteFillObject },
  sheet: {
    width: '100%',
    maxHeight: '93%',
    minHeight: '72%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(153,110,205,0.34)',
    backgroundColor: '#030408',
    overflow: 'hidden',
    ...SLShadows.shadowSheet,
  },
  grabber: { alignSelf: 'center', width: 52, height: 5, marginTop: 10, marginBottom: 7, borderRadius: SLRadius.pill, backgroundColor: 'rgba(181,179,198,0.52)' },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SLSpacing.md, paddingBottom: SLSpacing.sm, gap: SLSpacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFloating },
  headerCopy: { flex: 1, minWidth: 0, alignItems: 'center' },
  title: { color: SLColors.textStrong, fontFamily: SLFontFamilies.sansBold, fontSize: 20, lineHeight: 25, textAlign: 'center' },
  subtitle: { color: SLColors.textMuted, fontFamily: SLFontFamilies.sansMedium, fontSize: SLTypography.caption.fontSize, lineHeight: 17, textAlign: 'center' },
  scrollContent: { paddingHorizontal: SLSpacing.lg, paddingTop: SLSpacing.lg, paddingBottom: SLSpacing.xl, gap: SLSpacing.xl },
  identityTransition: { gap: SLSpacing.xs },
  programmedRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.md, paddingHorizontal: SLSpacing.md, paddingVertical: SLSpacing.sm, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderHairline, backgroundColor: SLColors.surfaceFlat },
  programmedArtwork: { backgroundColor: '#100D17', borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderHairline },
  identityCopy: { flex: 1, minWidth: 0 },
  programmedKicker: { color: SLColors.textSubtle, fontSize: SLTypography.micro.fontSize, lineHeight: 16, fontFamily: SLFontFamilies.sansBold, letterSpacing: 1.1 },
  programmedName: { marginTop: 3, color: SLColors.textPrimary, fontSize: 18, lineHeight: 23, fontFamily: SLFontFamilies.sansSemiBold },
  transitionRail: { height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  transitionLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(164,105,233,0.32)' },
  transitionBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(164,105,233,0.54)', backgroundColor: '#110B1A' },
  performingCard: { minHeight: 118, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.md, padding: SLSpacing.md, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: 'rgba(174,93,255,0.62)' },
  performingArtwork: { flexShrink: 0, backgroundColor: 'rgba(10,7,16,0.82)', borderWidth: 1, borderColor: 'rgba(176,112,241,0.36)' },
  performingKickerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SLSpacing.xs },
  performingKicker: { color: SLColors.accentViolet, fontSize: SLTypography.caption.fontSize, lineHeight: 18, fontFamily: SLFontFamilies.sansBold, letterSpacing: 1.2 },
  canonicalPill: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: SLRadius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(80,221,124,0.48)', backgroundColor: 'rgba(19,92,55,0.18)' },
  canonicalPillText: { color: SLColors.success, fontSize: 10, lineHeight: 14, fontFamily: SLFontFamilies.sansBold, letterSpacing: 0.6 },
  performingName: { marginTop: 7, color: '#FFFFFF', fontSize: 23, lineHeight: 29, fontFamily: SLFontFamilies.sansBold, letterSpacing: -0.3 },
  prescriptionSection: { gap: SLSpacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: SLSpacing.xs },
  sectionKicker: { color: SLColors.accentViolet, fontSize: SLTypography.label.fontSize, lineHeight: 20, fontFamily: SLFontFamilies.sansBold, letterSpacing: 1.1 },
  sectionHint: { color: SLColors.textSubtle, fontSize: SLTypography.caption.fontSize, lineHeight: 18, fontFamily: SLFontFamilies.sansMedium },
  wheelPanel: { paddingHorizontal: SLSpacing.sm, paddingBottom: SLSpacing.sm, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#080910' },
  primaryWheels: { marginTop: SLSpacing.sm },
  repSection: { gap: SLSpacing.sm },
  repTargetLabel: { color: SLColors.textSecondary, fontSize: SLTypography.caption.fontSize, lineHeight: 18, fontFamily: SLFontFamilies.sansBold, letterSpacing: 1 },
  segmentedControl: { flexDirection: 'row', minHeight: 50, padding: 4, gap: 4, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#080910' },
  segment: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SLSpacing.xs, borderRadius: SLRadius.md },
  segmentActive: { borderWidth: 1, borderColor: 'rgba(172,91,255,0.72)', backgroundColor: 'rgba(112,43,176,0.34)' },
  segmentText: { color: SLColors.textMuted, fontSize: SLTypography.label.fontSize, lineHeight: 20, fontFamily: SLFontFamilies.sansSemiBold },
  segmentTextActive: { color: SLColors.textStrong, fontFamily: SLFontFamilies.sansBold },
  repWheelPanel: { paddingHorizontal: SLSpacing.sm, paddingBottom: SLSpacing.sm, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#080910' },
  amrapCard: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.md, padding: SLSpacing.lg, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: 'rgba(174,93,255,0.40)', backgroundColor: 'rgba(76,27,116,0.18)' },
  amrapIcon: { width: 52, height: 52, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: 'rgba(128,53,188,0.25)' },
  amrapCopy: { flex: 1, minWidth: 0 },
  amrapTitle: { color: SLColors.textStrong, fontSize: SLTypography.cardTitle.fontSize, lineHeight: 23, fontFamily: SLFontFamilies.sansBold },
  amrapBody: { marginTop: 4, color: SLColors.textMuted, fontSize: SLTypography.caption.fontSize, lineHeight: 19, fontFamily: SLFontFamilies.sansMedium },
  preservedPrescription: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.md, padding: SLSpacing.lg, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  preservedPrescriptionText: { flex: 1, color: SLColors.textPrimary, fontSize: SLTypography.label.fontSize, lineHeight: 21, fontFamily: SLFontFamilies.sansMedium },
  footer: { flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.lg, paddingTop: SLSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderHairline, backgroundColor: '#030408' },
  cancelButton: { minWidth: 82, minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SLSpacing.md, borderRadius: SLRadius.lg },
  cancelText: { color: SLColors.textSecondary, fontSize: SLTypography.label.fontSize, fontFamily: SLFontFamilies.sansSemiBold },
  confirmButton: { flex: 1, minWidth: 0, minHeight: 58, overflow: 'hidden', borderRadius: SLRadius.lg, ...SLShadows.raised },
  confirmGradient: { flex: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.md },
  confirmText: { color: '#FFFFFF', fontSize: 17, lineHeight: 22, fontFamily: SLFontFamilies.sansBold, letterSpacing: 0.1 },
  disabled: { opacity: 0.55 },
});
