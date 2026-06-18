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
  const completedRows = detailRows?.filter((row) => row.state === 'completed') || [];
  const isActiveMovement = !!loggerFocus;
  const isComplete = state === 'complete';
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
      ]}
    >
      <View
        style={[
          styles.ledgerRail,
          state === 'complete' && styles.ledgerRailCompleted,
          state === 'not_started' && styles.ledgerRailUpcoming,
        ]}
      />
      <View style={styles.ledgerMain}>
        <View style={styles.ledgerHeader}>
          <View style={styles.ledgerTitleColumn}>
            <Text style={[styles.ledgerTitle, loggerFocus && styles.ledgerTitleActive]}>
              {title}
            </Text>
            {loggerFocus ? (
              <View style={styles.ledgerMetaChips}>
                {loggerFocus.designation ? (
                  <Text style={styles.ledgerMetaChip}>{loggerFocus.designation}</Text>
                ) : null}
              </View>
            ) : null}
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
                {expanded ? 'Collapse' : 'Expand'}
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
        {loggerFocus || (expanded && completedRows.length > 0) ? (
          <View style={styles.currentFocusBlock}>
            {loggerFocus ? <SetRail steps={loggerFocus.rail} /> : <SetRail steps={reviewRail} />}
            {loggerFocus ? (
              <View style={styles.nextSetPanel}>
                <View style={styles.currentSetRow}>
                  <View style={styles.currentSetBadge}>
                    <Text style={styles.currentSetBadgeLabel}>Next Set</Text>
                    <Text style={styles.currentSetBadgeValue}>{loggerFocus.currentSetLabel}</Text>
                  </View>
                  <View style={styles.currentTargetCopy}>
                    {loggerFocus.targetLine ? (
                      <Text style={styles.currentTarget}>{loggerFocus.targetLine}</Text>
                    ) : null}
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
            {completedRows.length > 0 ? (
              <View style={styles.currentLoggedList}>
                {loggerFocus ? <Text style={styles.currentLoggedKicker}>Logged</Text> : null}
                {completedRows.map((row) => (
                    <View key={row.key} style={styles.currentLoggedLine}>
                      <Text style={styles.currentLoggedText}>
                        {row.label}
                        {row.resultText ? ` · ${row.resultText}` : ''}
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
                  ))}
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
                {step.state === 'completed' ? '✓' : step.state === 'active' ? '•' : ''}
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
    marginBottom: 9,
    paddingVertical: 12,
    paddingHorizontal: 13,
    paddingLeft: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(222,198,166,0.045)',
    backgroundColor: 'rgba(21,15,14,0.30)',
    overflow: 'hidden',
  },
  ledgerRowExpanded: {
    borderColor: 'rgba(167,139,250,0.18)',
    backgroundColor: 'rgba(34,23,24,0.56)',
  },
  ledgerRowActive: {
    borderColor: 'rgba(214,167,94,0.24)',
    backgroundColor: 'rgba(43,27,25,0.68)',
  },
  ledgerRowCurrent: {
    backgroundColor: 'rgba(45,32,36,0.46)',
  },
  ledgerRowCompleted: {
    borderColor: 'rgba(167,190,159,0.060)',
    backgroundColor: 'rgba(22,19,17,0.20)',
  },
  ledgerRail: {
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    width: 3,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: 'rgba(167,139,250,0.62)',
  },
  ledgerRailCompleted: {
    backgroundColor: 'rgba(167,190,159,0.24)',
  },
  ledgerRailUpcoming: {
    backgroundColor: 'rgba(132,119,106,0.28)',
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
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  ledgerTitleActive: {
    color: '#FFF7ED',
    fontSize: 23,
    lineHeight: 28,
  },
  ledgerState: {
    color: '#AFA4C8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ledgerStateCompleted: {
    color: 'rgba(167,203,181,0.78)',
  },
  ledgerStateActive: {
    color: '#D6A75E',
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
    color: '#ECE5DA',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  ledgerMeta: {
    color: '#B8ACA1',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  ledgerTop: {
    color: '#D7CCC1',
    fontSize: 12,
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
    minHeight: 30,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.26)',
    backgroundColor: 'rgba(139,92,246,0.18)',
  },
  currentFocusBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(222,198,166,0.075)',
  },
  nextSetPanel: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(13,10,10,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(214,167,94,0.12)',
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
    color: '#D6A75E',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentSetBadgeValue: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  currentTargetCopy: {
    flex: 1,
  },
  currentProgression: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '800',
  },
  currentTarget: {
    color: '#F8FAFC',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
  },
  currentPrescription: {
    color: '#A9A3CF',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 3,
  },
  railWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 10,
    flexWrap: 'wrap',
    rowGap: 8,
  },
  railStep: {
    alignItems: 'center',
    gap: 5,
  },
  railNode: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(33,24,20,0.42)',
  },
  railNodeCompleted: {
    backgroundColor: 'rgba(167,190,159,0.20)',
  },
  railNodeActive: {
    width: 28,
    backgroundColor: 'rgba(139,92,246,0.20)',
  },
  railNodeText: {
    color: '#82766D',
    fontSize: 10,
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
    width: 18,
    height: 2,
    marginHorizontal: 3,
    marginBottom: 14,
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
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  currentSecondaryActionText: {
    color: '#CFC4B9',
    fontSize: 12,
    fontWeight: '800',
  },
  currentPrimaryAction: {
    minHeight: 48,
    width: '100%',
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(139,92,246,0.36)',
    borderWidth: 1,
    borderColor: 'rgba(214,167,94,0.22)',
  },
  currentPrimaryActionText: {
    color: '#F5F3FF',
    fontSize: 16,
    fontWeight: '900',
  },
  currentLoggedList: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(222,198,166,0.065)',
    gap: 6,
  },
  currentLoggedKicker: {
    color: '#8F857B',
    fontSize: 10,
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
  currentLoggedText: {
    color: '#CFC4B9',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
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
