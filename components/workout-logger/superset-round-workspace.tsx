import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { SLButton } from '@/components/ui/sl-button';
import { CompletedSetSwipeRow } from '@/components/workout-logger/core-loggers';
import { AccessoryMuscleRegionMedallion } from '@/components/workout-logger/accessory-muscle-region-medallion';
import { MovementCardMaterial } from '@/components/workout-logger/movement-card-material';
import {
  SLColors,
  SLMovementCardMaterial,
  SLRadius,
  SLSpacing,
  SLTypography,
} from '@/constants/theme';
import {
  type SupersetRoundLog,
  type SupersetRoundModel,
  type SupersetRoundSourceItem,
} from '@/lib/superset-rounds';
import { movementCardStateAccent } from '@/lib/movement-card-material';
import {
  combineAccessoryMuscleRegions,
  type AccessoryMuscleRegionKey,
} from '@/lib/accessory-muscle-group';

export type SupersetWorkspaceLog = SupersetRoundLog & Readonly<{
  id: number;
  actual_weight_kg?: number | null;
  actual_reps?: number | null;
  actual_rpe?: number | null;
  actual_rir?: number | null;
  resultLine?: string | null;
}>;

export type SupersetWorkspaceItem = SupersetRoundSourceItem & Readonly<{
  title: string;
  prescription: string;
  historyLine?: string | null;
  timelineLabel?: string | null;
  primaryMuscleRegion?: AccessoryMuscleRegionKey | null;
  set_logs?: readonly SupersetWorkspaceLog[] | null;
}>;

type SupersetRoundWorkspaceProps = {
  groupLabel: string;
  executionHint?: string | null;
  model: SupersetRoundModel<SupersetWorkspaceItem>;
  expanded: boolean;
  canLog: boolean;
  reduceMotion?: boolean;
  onToggle: () => void;
  onLogRound: (roundIndex: number) => void;
  onOpenHistory: (itemId: number) => void;
  onEditSet: (
    item: SupersetWorkspaceItem,
    log: SupersetWorkspaceLog,
  ) => void;
  onDeleteSet: (
    item: SupersetWorkspaceItem,
    log: SupersetWorkspaceLog,
  ) => void;
};

function statusLabel(status: SupersetRoundModel<SupersetWorkspaceItem>['status']) {
  if (status === 'complete') return 'COMPLETE';
  if (status === 'in_progress') return 'IN PROGRESS';
  return 'NOT STARTED';
}

function entryStateLabel(state: 'complete' | 'ready' | 'upcoming') {
  if (state === 'complete') return 'Logged';
  if (state === 'ready') return 'Ready';
  return 'Upcoming';
}

export function SupersetRoundWorkspace({
  groupLabel,
  executionHint,
  model,
  expanded,
  canLog,
  reduceMotion = false,
  onToggle,
  onLogRound,
  onOpenHistory,
  onEditSet,
  onDeleteSet,
}: SupersetRoundWorkspaceProps) {
  const currentRoundIndex = model.currentRoundIndex;
  const materialState = model.status === 'complete'
    ? 'complete' as const
    : model.status === 'in_progress'
      ? 'in_progress' as const
      : 'not_started' as const;
  const stateAccent = movementCardStateAccent(materialState);
  const combinedMuscleRegion = combineAccessoryMuscleRegions(
    model.items.map((item) => item.primaryMuscleRegion),
  );

  return (
    <View style={styles.card}>
      <MovementCardMaterial
        expanded={expanded}
        state={materialState}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Superset ${groupLabel}, ${statusLabel(model.status)}, ${model.roundCount} rounds`}
        onPress={onToggle}
        style={styles.header}
      >
        <AccessoryMuscleRegionMedallion
          accessibilityLabel={`${combinedMuscleRegion.label} primary muscle group for superset ${groupLabel}`}
          containerStyle={styles.muscleGroupMedallion}
          regionKey={combinedMuscleRegion.key}
        />
        <View style={styles.headerCopy}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>SUPERSET {groupLabel}</Text>
            <Text style={[
              styles.status,
              { color: stateAccent },
            ]}>
              {statusLabel(model.status)}
            </Text>
          </View>
          <View style={styles.movementNames}>
            {model.items.map((item, index) => (
              <React.Fragment key={item.id}>
                <Text numberOfLines={2} style={styles.movementName}>{item.title}</Text>
                {index < model.items.length - 1 ? (
                  <Ionicons
                    color={SLColors.accentViolet}
                    name="arrow-down"
                    size={15}
                    style={styles.movementConnector}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </View>
          <Text numberOfLines={1} style={styles.summary}>
            {model.roundCount} {model.roundCount === 1 ? 'Round' : 'Rounds'}
            {executionHint ? ` · ${executionHint}` : ''}
          </Text>
        </View>
        <Ionicons
          color={stateAccent}
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          style={styles.chevron}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.expanded}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>TODAY&apos;S WORK</Text>
              <Text style={styles.sectionMeta}>
                {model.completedRounds} / {model.roundCount} ROUNDS
              </Text>
            </View>
            <Text style={styles.roundCount}>{model.roundCount} ROUNDS</Text>
            <View style={styles.workList}>
              {model.items.map((item) => (
                <View key={item.id} style={styles.workItem}>
                  <Text style={styles.workTitle}>{item.title}</Text>
                  <Text style={styles.workPrescription}>{item.prescription}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.section, styles.timelineSection]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>ROUND TIMELINE</Text>
              <Text style={styles.sectionMeta}>
                {model.loggedRequiredSets} / {model.totalRequiredSets} SETS
              </Text>
            </View>
            <View style={styles.timeline}>
              {model.rounds.map((round) => (
                <View key={round.index} style={styles.roundRow}>
                  <View style={[
                    styles.roundNode,
                    round.state === 'current' && styles.roundNodeCurrent,
                    round.state === 'complete' && styles.roundNodeComplete,
                  ]}>
                    {round.state === 'complete' ? (
                      <Ionicons color={SLColors.textStrong} name="checkmark" size={17} />
                    ) : (
                      <Text style={[
                        styles.roundNodeText,
                        round.state === 'current' && styles.roundNodeTextCurrent,
                      ]}>
                        {round.index}
                      </Text>
                    )}
                  </View>
                  <View style={styles.roundBody}>
                    <Text style={styles.roundLabel}>ROUND {round.index}</Text>
                    {round.entries.map((entry) => {
                      const log = entry.log as SupersetWorkspaceLog | null;
                      const canModifyLog = canLog
                        && entry.state === 'complete'
                        && log != null
                        && Number.isFinite(Number(log.id));
                      return (
                        <CompletedSetSwipeRow
                          key={entry.itemId}
                          onDelete={canModifyLog
                            ? () => onDeleteSet(entry.item, log)
                            : undefined}
                          onEdit={canModifyLog
                            ? () => onEditSet(entry.item, log)
                            : undefined}
                          reduceMotion={reduceMotion}
                        >
                          <View style={styles.timelineMovement}>
                            <View style={[
                              styles.timelineDot,
                              entry.state === 'ready' && styles.timelineDotReady,
                              entry.state === 'complete' && styles.timelineDotComplete,
                            ]} />
                            <View style={styles.timelineCopy}>
                              <Text numberOfLines={1} style={styles.timelineTitle}>
                                {entry.item.timelineLabel || entry.item.title}
                              </Text>
                              <Text numberOfLines={1} style={[
                                styles.timelineState,
                                entry.state === 'ready' && styles.timelineStateReady,
                                entry.state === 'complete' && styles.timelineStateComplete,
                              ]}>
                                {log?.resultLine || entryStateLabel(entry.state)}
                              </Text>
                            </View>
                          </View>
                        </CompletedSetSwipeRow>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {currentRoundIndex != null && canLog ? (
            <SLButton
              accessibilityLabel={`Log superset ${groupLabel} round ${currentRoundIndex}`}
              fullWidth
              iconRight="chevron-forward"
              iconRightPosition="edge"
              label={`Log Round ${currentRoundIndex}`}
              onPress={() => onLogRound(currentRoundIndex)}
              size="lg"
              style={styles.logRoundButton}
            />
          ) : null}

          <View style={styles.historySection}>
            <Text style={styles.sectionLabel}>HISTORY</Text>
            {model.items.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.id}
                onPress={() => onOpenHistory(item.id)}
                style={styles.historyRow}
              >
                <View style={styles.historyCopy}>
                  <Text numberOfLines={1} style={styles.historyTitle}>{item.title}</Text>
                  <Text numberOfLines={1} style={styles.historyMeta}>
                    {item.historyLine || 'No previous performance'}
                  </Text>
                </View>
                <Ionicons color={SLColors.textMuted} name="chevron-forward" size={18} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SLMovementCardMaterial.base,
    borderColor: SLMovementCardMaterial.neutralBorder,
    borderRadius: SLRadius.xl,
    borderWidth: 1,
    marginBottom: SLSpacing.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SLSpacing.md,
    paddingHorizontal: SLSpacing.lg,
    paddingVertical: SLSpacing.lg,
  },
  muscleGroupMedallion: {
    alignSelf: 'center',
    width: 78,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
    justifyContent: 'space-between',
    marginBottom: SLSpacing.sm,
  },
  eyebrow: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  status: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.65,
  },
  movementNames: {
    gap: 1,
  },
  movementName: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '700',
    lineHeight: 24,
  },
  movementConnector: {
    marginLeft: 2,
    marginVertical: 1,
  },
  summary: {
    color: SLColors.accentMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    marginTop: SLSpacing.sm,
    textTransform: 'uppercase',
  },
  chevron: {
    alignSelf: 'center',
    marginLeft: SLSpacing.xs,
  },
  expanded: {
    borderTopColor: SLColors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: SLSpacing.lg,
    paddingHorizontal: SLSpacing.lg,
  },
  section: {
    paddingVertical: SLSpacing.xl,
  },
  timelineSection: {
    borderTopColor: SLColors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: SLColors.accentMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  sectionMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  roundCount: {
    color: SLColors.textStrong,
    fontSize: SLTypography.screenTitle.fontSize,
    fontWeight: '800',
    marginTop: SLSpacing.md,
  },
  workList: {
    gap: SLSpacing.md,
    marginTop: SLSpacing.lg,
  },
  workItem: {
    borderLeftColor: SLColors.borderFocus,
    borderLeftWidth: 2,
    paddingLeft: SLSpacing.md,
  },
  workTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '700',
  },
  workPrescription: {
    color: SLColors.textSecondary,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '600',
    marginTop: 3,
  },
  timeline: {
    marginTop: SLSpacing.lg,
  },
  roundRow: {
    flexDirection: 'row',
    gap: SLSpacing.md,
    paddingBottom: SLSpacing.lg,
  },
  roundNode: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceEmbedded,
    borderColor: SLColors.borderStrong,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  roundNodeCurrent: {
    backgroundColor: SLColors.accentSoft,
    borderColor: SLColors.accentViolet,
  },
  roundNodeComplete: {
    backgroundColor: SLColors.successSoft,
    borderColor: SLColors.success,
  },
  roundNodeText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '700',
  },
  roundNodeTextCurrent: {
    color: SLColors.textStrong,
  },
  roundBody: {
    borderBottomColor: SLColors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: SLSpacing.sm,
    paddingBottom: SLSpacing.lg,
  },
  roundLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  timelineMovement: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
  },
  timelineDot: {
    backgroundColor: 'transparent',
    borderColor: SLColors.borderStrong,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    height: 11,
    width: 11,
  },
  timelineDotReady: {
    borderColor: SLColors.accentViolet,
  },
  timelineDotComplete: {
    backgroundColor: SLColors.success,
    borderColor: SLColors.success,
  },
  timelineCopy: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: SLSpacing.sm,
    justifyContent: 'space-between',
  },
  timelineTitle: {
    color: SLColors.textStrong,
    flex: 1,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
  },
  timelineState: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  timelineStateReady: {
    color: SLColors.accentViolet,
  },
  timelineStateComplete: {
    color: SLColors.success,
  },
  logRoundButton: {
    marginBottom: SLSpacing.lg,
  },
  historySection: {
    borderTopColor: SLColors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: SLSpacing.lg,
  },
  historyRow: {
    alignItems: 'center',
    borderBottomColor: SLColors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: SLSpacing.md,
    minHeight: 58,
  },
  historyCopy: {
    flex: 1,
    minWidth: 0,
  },
  historyTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
  },
  historyMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    marginTop: 2,
  },
});
