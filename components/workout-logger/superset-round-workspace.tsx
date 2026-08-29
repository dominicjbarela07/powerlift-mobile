import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
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
  onLogMovement: (itemId: number) => void;
  onOpenHistory: (itemId: number) => void;
  onSwapMovement: (itemId: number) => void;
  swapActionForItem: (itemId: number) => 'Swap' | 'Sub' | null;
  swappingItemId?: number | null;
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

function movementPositionLabel(position: number) {
  if (position >= 1 && position <= 26) {
    return String.fromCharCode(64 + position);
  }
  return String(position);
}

export function SupersetRoundWorkspace({
  groupLabel,
  executionHint,
  model,
  expanded,
  canLog,
  reduceMotion = false,
  onToggle,
  onLogMovement,
  onOpenHistory,
  onSwapMovement,
  swapActionForItem,
  swappingItemId = null,
  onEditSet,
  onDeleteSet,
}: SupersetRoundWorkspaceProps) {
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
        accessibilityLabel={`Superset ${groupLabel}, ${statusLabel(model.status)}, ${model.loggedRequiredSets} of ${model.totalRequiredSets} sets`}
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
            {model.loggedRequiredSets} / {model.totalRequiredSets} SETS
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
              <Text style={styles.sectionLabel}>MOVEMENT PROGRESS</Text>
              <Text style={styles.sectionMeta}>
                {model.loggedRequiredSets} / {model.totalRequiredSets} SETS
              </Text>
            </View>
            <Text style={styles.roundCount}>
              {model.loggedRequiredSets} / {model.totalRequiredSets} SETS
            </Text>
            <Text style={styles.flexibleOrderHint}>
              Log these movements in any order. Each movement keeps its own next set.
            </Text>
            <View style={styles.workList}>
              {model.movements.map((movement) => {
                const positionLabel = movementPositionLabel(movement.position);
                const isSuggested = movement.itemId === model.suggestedNextItemId;
                const logs = [...(movement.item.set_logs || [])]
                  .filter((log) => movement.loggedSetIndexes.includes(Number(log.set_index || 0)))
                  .sort((a, b) => Number(a.set_index || 0) - Number(b.set_index || 0));
                const swapAction = swapActionForItem(movement.itemId);
                const swapBusy = swappingItemId === movement.itemId;
                return (
                  <View key={movement.itemId} style={styles.workItem}>
                    <View style={styles.workItemHeader}>
                      <View style={[
                        styles.positionBadge,
                        movement.complete && styles.positionBadgeComplete,
                      ]}>
                        {movement.complete ? (
                          <Ionicons color={SLColors.textStrong} name="checkmark" size={16} />
                        ) : (
                          <Text style={styles.positionBadgeText}>{positionLabel}</Text>
                        )}
                      </View>
                      <View style={styles.workCopy}>
                        <View style={styles.workTitleRow}>
                          <Text numberOfLines={2} style={styles.workTitle}>
                            {positionLabel} · {movement.item.title}
                          </Text>
                          {isSuggested && !movement.complete ? (
                            <Text style={styles.suggestedPill}>NEXT</Text>
                          ) : null}
                        </View>
                        <Text style={styles.workPrescription}>
                          {movement.item.prescription}
                        </Text>
                      </View>
                      <Text style={[
                        styles.movementProgress,
                        movement.complete && styles.movementProgressComplete,
                      ]}>
                        {movement.loggedRequiredSets} / {movement.requiredSets}
                      </Text>
                    </View>

                    {swapAction ? (
                      <Pressable
                        accessibilityLabel={`${swapAction} ${movement.item.title}`}
                        accessibilityRole="button"
                        accessibilityState={{ busy: swapBusy, disabled: swapBusy }}
                        disabled={swapBusy}
                        onPress={() => onSwapMovement(movement.itemId)}
                        style={({ pressed }) => [
                          styles.movementAction,
                          pressed && styles.controlPressed,
                          swapBusy && styles.controlBusy,
                        ]}
                      >
                        {swapBusy ? (
                          <ActivityIndicator color={SLColors.accentViolet} size="small" />
                        ) : (
                          <Ionicons color={SLColors.accentViolet} name="swap-horizontal-outline" size={17} />
                        )}
                        <Text style={styles.movementActionText}>{swapBusy ? 'Updating…' : swapAction}</Text>
                      </Pressable>
                    ) : null}

                    {logs.length ? (
                      <View style={styles.movementEvidence}>
                        {logs.map((log) => {
                          const persistedLog = log as SupersetWorkspaceLog;
                          const canModifyLog = canLog && Number.isFinite(Number(persistedLog.id));
                          return (
                            <CompletedSetSwipeRow
                              key={`${movement.itemId}:${persistedLog.id || persistedLog.set_index}`}
                              onDelete={canModifyLog
                                ? () => onDeleteSet(movement.item, persistedLog)
                                : undefined}
                              onEdit={canModifyLog
                                ? () => onEditSet(movement.item, persistedLog)
                                : undefined}
                              reduceMotion={reduceMotion}
                            >
                              <View style={styles.timelineMovement}>
                                <View style={[styles.timelineDot, styles.timelineDotComplete]} />
                                <View style={styles.timelineCopy}>
                                  <Text numberOfLines={1} style={styles.timelineTitle}>
                                    Set {persistedLog.set_index}
                                  </Text>
                                  <Text numberOfLines={1} style={[
                                    styles.timelineState,
                                    styles.timelineStateComplete,
                                  ]}>
                                    {persistedLog.resultLine || 'Logged'}
                                  </Text>
                                </View>
                              </View>
                            </CompletedSetSwipeRow>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={styles.noSetsYet}>No sets logged yet</Text>
                    )}

                    {canLog && movement.nextSetIndex != null ? (
                      <SLButton
                        accessibilityLabel={`Log ${movement.item.title}, set ${movement.nextSetIndex} of ${movement.requiredSets}`}
                        disableNativePressAnimation
                        fullWidth
                        iconRight="chevron-forward"
                        iconRightPosition="edge"
                        label={`Log ${positionLabel} · Set ${movement.nextSetIndex}`}
                        onPress={() => onLogMovement(movement.itemId)}
                        size="sm"
                        style={styles.logMovementButton}
                        variant={isSuggested ? 'primary' : 'secondary'}
                      />
                    ) : movement.complete ? (
                      <View style={styles.movementCompleteRow}>
                        <Ionicons color={SLColors.success} name="checkmark-circle" size={17} />
                        <Text style={styles.movementCompleteText}>All prescribed sets complete</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.historySection}>
            <Text style={styles.sectionLabel}>HISTORY</Text>
            {model.items.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.id}
                onPress={() => onOpenHistory(item.id)}
                style={({ pressed }) => [
                  styles.historyRow,
                  pressed && styles.controlPressed,
                ]}
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
  flexibleOrderHint: {
    color: SLColors.textSecondary,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 19,
    marginTop: SLSpacing.sm,
  },
  workList: {
    gap: SLSpacing.md,
    marginTop: SLSpacing.lg,
  },
  workItem: {
    backgroundColor: SLColors.surfaceEmbedded,
    borderColor: SLColors.borderStandard,
    borderRadius: SLRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SLSpacing.md,
    padding: SLSpacing.md,
  },
  workItemHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SLSpacing.sm,
  },
  positionBadge: {
    alignItems: 'center',
    backgroundColor: SLColors.accentSoft,
    borderColor: SLColors.borderFocus,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  positionBadgeComplete: {
    backgroundColor: SLColors.successSoft,
    borderColor: SLColors.success,
  },
  positionBadgeText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  workCopy: {
    flex: 1,
    minWidth: 0,
  },
  workTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
  },
  workTitle: {
    color: SLColors.textStrong,
    flexShrink: 1,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '700',
  },
  suggestedPill: {
    backgroundColor: SLColors.accentSoft,
    borderRadius: SLRadius.pill,
    color: SLColors.accentViolet,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
    overflow: 'hidden',
    paddingHorizontal: SLSpacing.sm,
    paddingVertical: 3,
  },
  workPrescription: {
    color: SLColors.textSecondary,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '600',
    marginTop: 3,
  },
  movementProgress: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
    paddingTop: 5,
  },
  movementProgressComplete: {
    color: SLColors.success,
  },
  movementAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: SLColors.accentSoft,
    borderColor: SLColors.borderFocus,
    borderRadius: SLRadius.radiusControl,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: SLSpacing.xs,
    minHeight: 40,
    paddingHorizontal: SLSpacing.md,
  },
  movementActionText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  controlPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },
  controlBusy: {
    opacity: 0.72,
  },
  movementEvidence: {
    borderTopColor: SLColors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: SLSpacing.xs,
    paddingTop: SLSpacing.sm,
  },
  noSetsYet: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    paddingVertical: SLSpacing.xs,
  },
  logMovementButton: {
    marginTop: SLSpacing.xs,
  },
  movementCompleteRow: {
    alignItems: 'center',
    borderTopColor: SLColors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    paddingTop: SLSpacing.md,
  },
  movementCompleteText: {
    color: SLColors.success,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
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
