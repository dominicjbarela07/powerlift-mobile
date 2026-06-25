// @ts-nocheck

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type SetRailStep = {
  key: string;
  label: string;
  state: 'completed' | 'active' | 'locked';
};

export type MovementLoggerFocusModel = {
  itemId?: number | null;
  groupItemId?: number | null;
  movementName: string;
  designation?: string | null;
  liftType?: string | null;
  currentSetLabel: string;
  progressionLabel: string;
  targetLine?: string | null;
  prescriptionLine?: string | null;
  recentContext?: string | null;
  rail: SetRailStep[];
  canLog: boolean;
  canRepeat: boolean;
  onLogSet?: () => void;
  onRepeatLast?: () => void;
  onViewHistory?: () => void;
};

export type ActiveMovementDetailRow = {
  key: string;
  label: string;
  state: 'completed' | 'active' | 'locked';
  target?: string | null;
  prescription?: string | null;
  resultText?: string | null;
  videoLabel?: string | null;
  videoStatus?: string | null;
  videoDisabled?: boolean;
  onEdit?: () => void;
  onVideo?: () => void;
  onLogSet?: () => void;
};

export function CoreMovementLedgerRow({
  state,
  title,
  variantLabel,
  scheme,
  meta,
  top,
  movementNote,
  loggerFocus,
  expanded,
  detailRows,
  auxAction,
  onOpen,
}: {
  state: 'complete' | 'logged' | 'not_started';
  title: string;
  variantLabel: string;
  scheme?: React.ReactNode;
  meta?: string | null;
  top?: string | null;
  movementNote?: string | null;
  loggerFocus?: MovementLoggerFocusModel | null;
  expanded?: boolean;
  detailRows?: ActiveMovementDetailRow[];
  auxAction?: React.ReactNode;
  onOpen: () => void;
}) {
  const stateLabel =
    state === 'complete' ? 'Complete' : state === 'logged' ? 'Logged' : 'Not started';
  // P0 invariant: render every prescribed detail row from the API.
  // Do not filter this list down to completed/logged rows only.
  // Coach prescription, API payload, and athlete UI must match in meaning.
  const allDetailRows = detailRows || [];
  const completedRows = allDetailRows.filter((row) => row.state === 'completed');
  const visibleDetailRows = expanded ? allDetailRows : completedRows;
  const isActiveMovement = !!loggerFocus;
  const isComplete = state === 'complete';
  const isAccessory = variantLabel?.toLowerCase() === 'accessory';
  const showCollapsedVariant =
    !expanded && !isComplete && variantLabel && variantLabel.toLowerCase() !== 'accessory';
  const showScheme = !!scheme && (expanded || !isComplete);
  const reviewRail =
    !loggerFocus && expanded && detailRows?.length
      ? detailRows.map((row) => ({
          key: row.key,
          label: row.label,
          state: row.state === 'completed' ? 'completed' : 'locked',
        }))
      : [];

  return (
    <View
      style={[
        styles.ledgerRow,
        expanded && styles.ledgerRowExpanded,
        isActiveMovement && styles.ledgerRowActive,
        state === 'logged' && styles.ledgerRowCurrent,
        state === 'complete' && styles.ledgerRowCompleted,
        isAccessory && styles.ledgerRowAccessory,
      ]}
    >
      <View
        style={[
          styles.ledgerRail,
          state === 'complete' && styles.ledgerRailCompleted,
          state === 'not_started' && styles.ledgerRailUpcoming,
          isAccessory && styles.ledgerRailAccessory,
          isActiveMovement && styles.ledgerRailActive,
        ]}
      />
      <View style={styles.ledgerMain}>
        <View style={styles.ledgerHeader}>
          <View style={styles.ledgerTitleColumn}>
            <Text style={[styles.ledgerTitle, loggerFocus && styles.ledgerTitleActive]}>
              {title}
            </Text>
          </View>
          <View style={styles.ledgerHeaderActions}>
            <Text
              style={[
                styles.ledgerState,
                state === 'complete' && styles.ledgerStateCompleted,
                isActiveMovement && styles.ledgerStateActive,
              ]}
            >
              {stateLabel}
            </Text>
            {auxAction}
            <TouchableOpacity style={styles.ledgerActionButton} onPress={onOpen}>
              <Text style={[styles.ledgerAction, expanded && styles.ledgerActionExpanded]}>
                {expanded ? 'Collapse  ^' : 'Expand  v'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {showCollapsedVariant ? <Text style={styles.ledgerVariant}>{variantLabel}</Text> : null}
        {showScheme ? <Text style={styles.ledgerScheme}>{scheme}</Text> : null}
        {!expanded && meta ? <Text style={styles.ledgerMeta}>{meta}</Text> : null}
        {!expanded && top ? <Text style={styles.ledgerTop}>{top}</Text> : null}
        {movementNote?.trim() ? (
          <View style={styles.movementNoteBlock}>
            <Text style={styles.movementNoteLabel}>Coach Note</Text>
            <Text style={styles.movementNoteText}>{movementNote.trim()}</Text>
          </View>
        ) : null}
        {loggerFocus || (expanded && visibleDetailRows.length > 0) ? (
          <View style={styles.currentFocusBlock}>
            {loggerFocus ? <SetRail steps={loggerFocus.rail} /> : <SetRail steps={reviewRail} />}
            {loggerFocus ? (
              <View style={styles.nextSetPanel}>
                <View style={styles.currentTargetCopy}>
                  <Text style={styles.currentSetBadgeLabel}>Next Set</Text>
                  {loggerFocus.targetLine ? (
                    <Text style={styles.currentTarget}>{loggerFocus.targetLine}</Text>
                  ) : null}
                  <View style={styles.currentSetSummaryRow}>
                    <Text style={styles.currentSetBadgeValue}>{loggerFocus.currentSetLabel}</Text>
                    {loggerFocus.prescriptionLine ? (
                      <Text style={styles.currentPrescription}>{loggerFocus.prescriptionLine}</Text>
                    ) : null}
                  </View>
                </View>
                {loggerFocus.canLog && loggerFocus.onLogSet ? (
                  <TouchableOpacity style={styles.currentPrimaryAction} onPress={loggerFocus.onLogSet}>
                    <Text style={styles.currentPrimaryActionText}>Log Set</Text>
                  </TouchableOpacity>
                ) : null}
                <View style={styles.currentActionRow}>
                  {loggerFocus.canRepeat && loggerFocus.onRepeatLast ? (
                    <TouchableOpacity style={styles.currentSecondaryAction} onPress={loggerFocus.onRepeatLast}>
                      <Text style={styles.currentSecondaryActionText}>Repeat Last</Text>
                    </TouchableOpacity>
                  ) : null}
                  {loggerFocus.onViewHistory ? (
                    <TouchableOpacity style={styles.currentSecondaryAction} onPress={loggerFocus.onViewHistory}>
                      <Text style={styles.currentSecondaryActionText}>History</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}
            {visibleDetailRows.length > 0 ? (
              <View style={styles.currentLoggedList}>
                <Text style={styles.currentLoggedKicker}>{expanded ? 'Prescription' : 'Logged'}</Text>
                {visibleDetailRows.map((row) => {
                  const isCompleted = row.state === 'completed';
                  const isActive = row.state === 'active';
                  const statusText = isCompleted
                    ? row.resultText
                    : [row.target, row.prescription].filter(Boolean).join(' · ');
                  return (
                    <View key={row.key} style={[
                      styles.currentLoggedLine,
                      !isCompleted && styles.currentPlannedLine,
                      isActive && styles.currentPlannedLineActive,
                    ]}>
                      <Text style={[
                        styles.currentLoggedText,
                        !isCompleted && styles.currentPlannedText,
                        isActive && styles.currentPlannedTextActive,
                      ]}>
                        {row.label}
                        {statusText ? ` · ${statusText}` : ''}
                      </Text>
                      {row.videoStatus ? (
                        <Text
                          style={[
                            styles.currentVideoStatus,
                            row.videoStatus.toLowerCase().includes('failed') && styles.currentVideoStatusError,
                            row.videoStatus.toLowerCase().includes('uploading') && styles.currentVideoStatusPending,
                          ]}
                        >
                          {row.videoStatus}
                        </Text>
                      ) : null}
                      <View style={styles.currentLoggedActions}>
                        {row.onLogSet ? (
                          <TouchableOpacity style={styles.currentLoggedAction} onPress={row.onLogSet}>
                            <Text style={styles.currentLoggedActionText}>Log</Text>
                          </TouchableOpacity>
                        ) : null}
                        {row.onEdit ? (
                          <TouchableOpacity style={styles.currentLoggedAction} onPress={row.onEdit}>
                            <Text style={styles.currentLoggedActionText}>Edit</Text>
                          </TouchableOpacity>
                        ) : null}
                        {row.onVideo && row.videoLabel ? (
                          <TouchableOpacity
                            style={[
                              styles.currentLoggedAction,
                              row.videoDisabled && styles.currentLoggedActionDisabled,
                            ]}
                            onPress={row.onVideo}
                            disabled={row.videoDisabled}
                          >
                            <Text style={styles.currentLoggedActionText}>{row.videoLabel}</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SetRail({ steps }: { steps: SetRailStep[] }) {
  if (!steps.length) return null;
  return (
    <View style={styles.railWrap}>
      {steps.map((step, index) => (
        <React.Fragment key={step.key}>
          <View style={styles.railStep}>
            <View
              style={[
                styles.railNode,
                step.state === 'completed' && styles.railNodeCompleted,
                step.state === 'active' && styles.railNodeActive,
              ]}
            >
              <Text
                style={[
                  styles.railNodeText,
                  step.state === 'completed' && styles.railNodeTextCompleted,
                  step.state === 'active' && styles.railNodeTextActive,
                ]}
              >
                {step.state === 'completed' ? '✓' : step.label.replace(/[^0-9]/g, '') || '•'}
              </Text>
            </View>
            <Text
              style={[
                styles.railLabel,
                step.state === 'active' && styles.railLabelActive,
              ]}
            >
              {step.label}
            </Text>
          </View>
          {index < steps.length - 1 ? <View style={styles.railConnector} /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

export function CoreSchemeDetail({ children }: { children: React.ReactNode }) {
  return <Text style={styles.coreSchemeDetail}>{children}</Text>;
}

const styles = StyleSheet.create({
  coreSchemeDetail: {
    color: '#B8ACA1',
    fontWeight: '600',
  },
  ledgerRow: {
    position: 'relative',
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingLeft: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(10,13,22,0.72)',
    overflow: 'hidden',
  },
  ledgerRowExpanded: {
    borderColor: 'rgba(167,139,250,0.30)',
    backgroundColor: 'rgba(12,17,30,0.86)',
  },
  ledgerRowActive: {
    borderColor: 'rgba(167,139,250,0.38)',
    backgroundColor: 'rgba(12,17,30,0.92)',
  },
  ledgerRowCurrent: {
    backgroundColor: 'rgba(13,18,32,0.82)',
  },
  ledgerRowCompleted: {
    borderColor: 'rgba(74,222,128,0.18)',
    backgroundColor: 'rgba(9,17,18,0.66)',
  },
  ledgerRowAccessory: {
    borderColor: 'rgba(45,212,191,0.18)',
  },
  ledgerRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#8B5CF6',
  },
  ledgerRailCompleted: {
    backgroundColor: '#4ADE80',
  },
  ledgerRailUpcoming: {
    backgroundColor: '#F6B657',
  },
  ledgerRailAccessory: {
    backgroundColor: '#2DD4BF',
  },
  ledgerRailActive: {
    backgroundColor: '#8B5CF6',
  },
  ledgerMain: {
    flex: 1,
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  ledgerHeaderActions: {
    alignItems: 'flex-end',
    gap: 5,
  },
  ledgerTitleColumn: {
    flex: 1,
  },
  ledgerTitle: {
    color: '#F8FAFC',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
  },
  ledgerTitleActive: {
    color: '#F8FAFC',
    fontSize: 30,
    lineHeight: 36,
  },
  ledgerState: {
    color: '#F6B657',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ledgerStateCompleted: {
    color: '#4ADE80',
  },
  ledgerStateActive: {
    color: '#A78BFA',
  },
  ledgerVariant: {
    color: '#A9A3CF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  ledgerMetaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  ledgerMetaChip: {
    color: '#B8ACA1',
    fontSize: 11,
    fontWeight: '800',
    paddingRight: 2,
  },
  ledgerScheme: {
    color: '#E5E7EB',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: 4,
  },
  ledgerMeta: {
    color: '#C7BEB4',
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  ledgerTop: {
    color: '#D7CCC1',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  movementNoteBlock: {
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(222,198,166,0.075)',
  },
  movementNoteLabel: {
    color: '#D6A75E',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  movementNoteText: {
    color: '#E7DDD1',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  ledgerAction: {
    color: '#F5F3FF',
    fontSize: 12,
    fontWeight: '900',
  },
  ledgerActionExpanded: {
    color: '#DEC6A6',
  },
  ledgerActionButton: {
    alignSelf: 'flex-end',
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.50)',
    backgroundColor: 'rgba(15,17,28,0.72)',
  },
  currentFocusBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(222,198,166,0.075)',
  },
  nextSetPanel: {
    padding: 14,
    borderRadius: 13,
    backgroundColor: 'rgba(9,14,25,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  currentSetRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  currentSetBadge: {
    minWidth: 76,
    paddingTop: 1,
  },
  currentSetBadgeLabel: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentSetBadgeValue: {
    color: '#D7CCC1',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 0,
  },
  currentTargetCopy: {
    flex: 1,
  },
  currentSetSummaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  currentProgression: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '800',
  },
  currentTarget: {
    color: '#F8FAFC',
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '900',
    marginTop: 5,
  },
  currentPrescription: {
    color: '#D7CCC1',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 0,
  },
  railWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
    flexWrap: 'nowrap',
  },
  railStep: {
    alignItems: 'center',
    gap: 5,
  },
  railNode: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,13,22,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  railNodeCompleted: {
    backgroundColor: 'rgba(139,92,246,0.78)',
    borderColor: 'rgba(196,181,253,0.50)',
  },
  railNodeActive: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#7C3AED',
    borderColor: 'rgba(196,181,253,0.70)',
  },
  railNodeText: {
    color: '#C7BEB4',
    fontSize: 13,
    fontWeight: '900',
  },
  railNodeTextCompleted: {
    color: '#A7CBB5',
  },
  railNodeTextActive: {
    color: '#F5F3FF',
  },
  railLabel: {
    color: '#B8ACA1',
    fontSize: 10,
    fontWeight: '800',
  },
  railLabelActive: {
    color: '#D6CCF5',
  },
  railConnector: {
    flex: 1,
    minWidth: 28,
    height: 1,
    marginHorizontal: 2,
    marginBottom: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(222,198,166,0.08)',
  },
  currentActionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  currentSecondaryAction: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,13,22,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  currentSecondaryActionText: {
    color: '#CFC4B9',
    fontSize: 12,
    fontWeight: '800',
  },
  currentPrimaryAction: {
    minHeight: 58,
    width: '100%',
    paddingHorizontal: 16,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    backgroundColor: '#6D28D9',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.28)',
  },
  currentPrimaryActionText: {
    color: '#F5F3FF',
    fontSize: 19,
    fontWeight: '900',
  },
  currentLoggedList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(222,198,166,0.065)',
    gap: 6,
  },
  currentLoggedKicker: {
    color: '#A78BFA',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  currentLoggedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
    opacity: 0.82,
  },
  currentPlannedLine: {
    opacity: 0.9,
  },
  currentPlannedLineActive: {
    opacity: 1,
  },
  currentLoggedText: {
    color: '#CFC4B9',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  currentPlannedText: {
    color: '#B8ACA1',
  },
  currentPlannedTextActive: {
    color: '#E9D5FF',
  },
  currentVideoStatus: {
    color: '#B8ACA1',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
  },
  currentVideoStatusPending: {
    color: '#D6A75E',
  },
  currentVideoStatusError: {
    color: '#FCA5A5',
  },
  currentLoggedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentLoggedAction: {
    minHeight: 22,
    paddingHorizontal: 6,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  currentLoggedActionDisabled: {
    opacity: 0.55,
  },
  currentLoggedActionText: {
    color: '#B9ADD8',
    fontSize: 11,
    fontWeight: '900',
  },
});
