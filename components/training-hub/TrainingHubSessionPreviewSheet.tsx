import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { StrengthLedgerBottomSheet, StrengthLedgerBottomSheetScrollView } from '@/components/sheets/StrengthLedgerBottomSheet';
import { SLMotionPressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
import { formatTotalVolumeFromKg, kilogramsToDisplayValue } from '@/lib/display-units';
import {
  formatTrainingHubPreviewDate,
  resolveTrainingHubSessionPreviewAction,
  trainingHubMovementPrescription,
} from '@/lib/training-hub-session-preview';
import { sessionUnavailableExplanation } from '@/lib/session-availability';
import type { AthleteTrainingProgram, AthleteTrainingSession } from './AthleteTrainingHubExperience';

type SessionContext = { blockName?: string | null; weekNumber?: number | null } | null;
type Props = {
  athlete?: unknown;
  context?: SessionContext;
  onClose: () => void;
  onOpen: () => void;
  program: AthleteTrainingProgram;
  session: AthleteTrainingSession | null;
  unit: 'kg' | 'lb';
};

export function TrainingHubSessionPreviewBottomSheet({ context, onClose, onOpen, program, session, unit }: Props) {
  const [opening, setOpening] = useState(false);
  const action = resolveTrainingHubSessionPreviewAction({
    fallbackStatus: session?.status,
    stateLabel: session?.stateLabel,
    status: session?.lifecycleStatus,
  });
  useEffect(() => {
    setOpening(false);
    if (session) AccessibilityInfo.announceForAccessibility(`${action.statusLabel}. ${session.title}. Session preview.`);
  }, [session?.id, session?.title, action.statusLabel]);

  if (!session) return null;
  const completed = action.lifecycle === 'completed';
  const accent = lifecycleColor(action.lifecycle);
  const movements = session.movements || [];
  const movementCount = Math.max(Number(session.movementCount || 0), movements.length);
  const contextLine = [context?.blockName, context?.weekNumber ? `Week ${context.weekNumber}` : null].filter(Boolean).join(' · ');
  const openCanonicalDestination = () => {
    if (!action.openable || opening) return;
    setOpening(true);
    onOpen();
  };

  return <StrengthLedgerBottomSheet accessibilityLabel="Session preview" heightFraction={0.88} onDismiss={onClose} testID="training-hub-session-preview" visible>
    <View style={styles.root}>
      <View style={styles.header}><Text style={styles.eyebrow}>SESSION PREVIEW</Text></View>
      <StrengthLedgerBottomSheetScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <View style={styles.identityTop}>
            <View style={[styles.status, { borderColor: `${accent}88`, backgroundColor: `${accent}18` }]}>
              <View style={[styles.statusDot, { backgroundColor: accent }]} />
              <Text style={[styles.statusText, { color: accent }]}>{action.statusLabel.toUpperCase()}</Text>
            </View>
            <Text style={styles.date}>{formatTrainingHubPreviewDate(session.date)}</Text>
          </View>
          <Text style={styles.title}>{session.title}</Text>
          <Text style={styles.programName}>{program.name}</Text>
          {contextLine ? <Text style={styles.context}>{contextLine}</Text> : null}
          <Text style={styles.count}>{movementCount} movement{movementCount === 1 ? '' : 's'}</Text>
        </View>
        {completed ? <CompletedPreview session={session} unit={unit} /> : <View style={styles.movementSection}>
          <Text style={styles.sectionLabel}>PRESCRIBED MOVEMENTS</Text>
          {movements.length ? movements.map((movement, index) => <View key={`${movement.label}-${index}`} style={styles.movementRow}>
            <Text style={styles.movementIndex}>{String(index + 1).padStart(2, '0')}</Text>
            <View style={styles.movementCopy}>
              <Text style={[styles.kind, movement.kind === 'accessory' && styles.accessoryKind]}>{movement.kind === 'accessory' ? 'ACCESSORY' : 'CORE'}</Text>
              <Text style={styles.movementName}>{movement.label}</Text>
              <Text style={styles.prescription}>{trainingHubMovementPrescription(movement)}</Text>
              {movement.equipmentType ? <Text style={styles.equipment}>{humanize(movement.equipmentType)}</Text> : null}
            </View>
          </View>) : <Text style={styles.empty}>Movement details are not available yet.</Text>}
          {movementCount > movements.length ? <Text style={styles.more}>{movementCount - movements.length} more movement{movementCount - movements.length === 1 ? '' : 's'} in this Session. Open the Session for the complete plan.</Text> : null}
        </View>}
        {session.focusMuscles?.length ? <View style={styles.focus}>
          <Text style={styles.sectionLabel}>FOCUS</Text>
          <Text style={styles.focusText}>{session.focusMuscles.slice(0, 5).map(humanize).join(' · ')}</Text>
        </View> : null}
      </StrengthLedgerBottomSheetScrollView>
      <View style={styles.footer}>{action.ctaLabel ? <SLMotionPressable accessibilityLabel={action.ctaLabel} accessibilityRole="button" accessibilityState={{ busy: opening, disabled: opening }} disabled={opening} onPress={openCanonicalDestination} pressScale={0.985} style={[styles.action, completed && styles.completedAction, opening && styles.disabledAction]}>
        <Text style={styles.actionText}>{action.ctaLabel}</Text><Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
      </SLMotionPressable> : <View style={styles.unavailable}><Ionicons name="lock-closed-outline" size={18} color={SLColors.textMuted} /><Text style={styles.unavailableText}>{sessionUnavailableExplanation({ status: session.lifecycleStatus, canBegin: false }) || 'This Session is not available to open.'}</Text></View>}</View>
    </View>
  </StrengthLedgerBottomSheet>;
}

function CompletedPreview({ session, unit }: { session: AthleteTrainingSession; unit: 'kg' | 'lb' }) {
  const recap = session.recap;
  if (!recap) return <View style={styles.movementSection}><Text style={styles.empty}>Completed Session evidence is available in the recap.</Text></View>;
  return <View style={styles.movementSection}>
    <Text style={styles.sectionLabel}>SAVED EVIDENCE</Text>
    <View style={styles.metrics}>
      <Metric label="SETS" value={String(recap.loggedSetCount || 0)} />
      <Metric label="PRs" value={String(recap.prCount || 0)} />
      <Metric label="RPE" value={recap.sessionRpe != null ? String(recap.sessionRpe) : '—'} />
    </View>
    {recap.totalVolumeKg ? <Text style={styles.volume}>{formatTotalVolumeFromKg(recap.totalVolumeKg, unit)}</Text> : null}
    {recap.topLifts?.slice(0, 3).map((lift) => <View key={`${lift.workoutItemId}-${lift.movement}`} style={styles.topLift}>
      <View style={styles.movementCopy}><Text style={styles.movementName}>{lift.movement}</Text><Text style={styles.prescription}>{formatTopLift(lift, unit)}</Text></View>
      {lift.hasPr ? <Text style={styles.pr}>PR</Text> : null}
    </View>)}
  </View>;
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function lifecycleColor(lifecycle: ReturnType<typeof resolveTrainingHubSessionPreviewAction>['lifecycle']) {
  if (lifecycle === 'completed') return SLColors.success;
  if (lifecycle === 'in_progress') return SLColors.accentViolet;
  if (lifecycle === 'missed' || lifecycle === 'canceled') return SLColors.danger;
  return SLColors.warning;
}
function humanize(value: string) { return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatTopLift(lift: NonNullable<NonNullable<AthleteTrainingSession['recap']>['topLifts']>[number], unit: 'kg' | 'lb') {
  const load = lift.weightKg != null ? `${Math.round(kilogramsToDisplayValue(lift.weightKg, unit))} ${unit}` : 'Load not recorded';
  return `${load}${lift.reps != null ? ` × ${lift.reps}` : ''}${lift.rpe != null ? ` @ ${lift.rpe}` : ''}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', minHeight: 0, backgroundColor: SLColors.canvasRaised },
  header: { minHeight: 39, justifyContent: 'center', paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  eyebrow: { ...SLTypography.micro, color: SLColors.accentViolet, letterSpacing: 0.7 },
  content: { paddingBottom: 28 },
  identity: { paddingHorizontal: 18, paddingVertical: 17, gap: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  identityTop: { minHeight: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: SLRadius.sm },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...SLTypography.micro, fontWeight: '800' },
  date: { ...SLTypography.micro, color: SLColors.textMuted, textAlign: 'right' },
  title: { ...SLTypography.title, color: SLColors.textStrong, marginTop: 5 },
  programName: { ...SLTypography.bodyStrong, color: SLColors.text },
  context: { ...SLTypography.caption, color: SLColors.textMuted },
  count: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: 4 },
  movementSection: { paddingHorizontal: 18, paddingTop: 18 },
  sectionLabel: { ...SLTypography.micro, color: SLColors.accentViolet, letterSpacing: 0.7 },
  movementRow: { minHeight: 77, flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  movementIndex: { width: 23, ...SLTypography.micro, color: SLColors.accentViolet, paddingTop: 3 },
  movementCopy: { flex: 1, minWidth: 0, gap: 2 },
  kind: { ...SLTypography.micro, color: SLColors.warning, fontWeight: '800' },
  accessoryKind: { color: SLColors.accentMuted },
  movementName: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  prescription: { ...SLTypography.caption, color: SLColors.textMuted },
  equipment: { ...SLTypography.micro, color: SLColors.textMuted },
  empty: { ...SLTypography.body, color: SLColors.textMuted, paddingVertical: 16 },
  more: { ...SLTypography.caption, color: SLColors.textMuted, paddingTop: 13 },
  focus: { paddingHorizontal: 18, paddingTop: 23, gap: 7 },
  focusText: { ...SLTypography.caption, color: SLColors.text },
  metrics: { flexDirection: 'row', marginTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  metric: { flex: 1, minHeight: 73, justifyContent: 'center', paddingHorizontal: 9, gap: 3, borderRightWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  metricValue: { ...SLTypography.kpiNumber, color: SLColors.textStrong },
  metricLabel: { ...SLTypography.micro, color: SLColors.textMuted },
  volume: { ...SLTypography.bodyStrong, color: SLColors.success, paddingTop: 11 },
  topLift: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  pr: { ...SLTypography.micro, color: SLColors.accentMagenta, fontWeight: '800' },
  footer: { paddingHorizontal: 18, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  action: { minHeight: 54, borderRadius: SLRadius.md, backgroundColor: '#6528A8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  completedAction: { backgroundColor: '#1A5E37' },
  disabledAction: { opacity: 0.6 },
  actionText: { ...SLTypography.bodyStrong, color: '#FFFFFF' },
  unavailable: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  unavailableText: { ...SLTypography.caption, color: SLColors.textMuted },
});
