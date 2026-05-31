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
  loggerFocus?: MovementLoggerFocusModel | null;
  expanded?: boolean;
  detailRows?: ActiveMovementDetailRow[];
  auxAction?: React.ReactNode;
  onOpen: () => void;
}) {
  const stateLabel =
    state === 'complete' ? 'Complete' : state === 'logged' ? 'Logged' : 'Not started';
  const completedRows = detailRows?.filter((row) => row.state === 'completed') || [];
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
              ]}
            >
              {stateLabel}
            </Text>
            {auxAction}
            <TouchableOpacity style={styles.ledgerActionButton} onPress={onOpen}>
              <Text style={styles.ledgerAction}>
                {expanded ? 'Close' : 'Open'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {!expanded ? <Text style={styles.ledgerVariant}>{variantLabel}</Text> : null}
        {scheme ? <Text style={styles.ledgerScheme}>{scheme}</Text> : null}
        {!expanded && meta ? <Text style={styles.ledgerMeta}>{meta}</Text> : null}
        {!expanded && top ? <Text style={styles.ledgerTop}>{top}</Text> : null}
        {loggerFocus || (expanded && completedRows.length > 0) ? (
          <View style={styles.currentFocusBlock}>
            {loggerFocus ? <SetRail steps={loggerFocus.rail} /> : <SetRail steps={reviewRail} />}
            {completedRows.length > 0 ? (
              <View style={styles.currentLoggedList}>
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
            {loggerFocus ? (
              <>
                <View style={styles.currentSetRow}>
                  <View style={styles.currentSetBadge}>
                    <Text style={styles.currentSetBadgeLabel}>Next</Text>
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
                <View style={styles.currentActionRow}>
                  {loggerFocus.canRepeat && loggerFocus.onRepeatLast ? (
                    <TouchableOpacity style={styles.currentSecondaryAction} onPress={loggerFocus.onRepeatLast}>
                      <Text style={styles.currentSecondaryActionText}>Repeat</Text>
                    </TouchableOpacity>
                  ) : null}
                  {loggerFocus.onViewHistory ? (
                    <TouchableOpacity style={styles.currentSecondaryAction} onPress={loggerFocus.onViewHistory}>
                      <Text style={styles.currentSecondaryActionText}>History</Text>
                    </TouchableOpacity>
                  ) : null}
                  {loggerFocus.canLog && loggerFocus.onLogSet ? (
                    <TouchableOpacity style={styles.currentPrimaryAction} onPress={loggerFocus.onLogSet}>
                      <Text style={styles.currentPrimaryActionText}>Log Set</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
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
    marginBottom: 5,
    paddingVertical: 11,
    paddingHorizontal: 12,
    paddingLeft: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(26,17,15,0.20)',
    overflow: 'hidden',
  },
  ledgerRowExpanded: {
    backgroundColor: 'rgba(32,20,18,0.30)',
  },
  ledgerRowCurrent: {
    backgroundColor: 'rgba(91,79,207,0.020)',
  },
  ledgerRowCompleted: {
    backgroundColor: 'rgba(166,129,88,0.028)',
  },
  ledgerRail: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 2,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: 'rgba(167,139,250,0.46)',
  },
  ledgerRailCompleted: {
    backgroundColor: 'rgba(167,190,159,0.34)',
  },
  ledgerRailUpcoming: {
    backgroundColor: 'rgba(132,119,106,0.42)',
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
    fontSize: 15,
    fontWeight: '800',
  },
  ledgerTitleActive: {
    fontSize: 18,
    lineHeight: 23,
  },
  ledgerState: {
    color: '#AFA4C8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ledgerStateCompleted: {
    color: '#A7CBB5',
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
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  ledgerMeta: {
    color: '#B8ACA1',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  ledgerTop: {
    color: '#EFE7DD',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    marginTop: 3,
  },
  ledgerAction: {
    color: '#B9ADD8',
    fontSize: 12,
    fontWeight: '900',
  },
  ledgerActionButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  currentFocusBlock: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(222,198,166,0.030)',
  },
  currentSetRow: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(222,198,166,0.030)',
  },
  currentSetBadge: {
    minWidth: 68,
    paddingTop: 1,
  },
  currentSetBadgeLabel: {
    color: '#A9A3CF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentSetBadgeValue: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 3,
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
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
    marginTop: 4,
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
    marginBottom: 8,
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
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  currentSecondaryAction: {
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24,16,15,0.08)',
  },
  currentSecondaryActionText: {
    color: '#ECE5DA',
    fontSize: 12,
    fontWeight: '800',
  },
  currentPrimaryAction: {
    height: 31,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.17)',
  },
  currentPrimaryActionText: {
    color: '#F5F3FF',
    fontSize: 13,
    fontWeight: '900',
  },
  currentLoggedList: {
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: 'rgba(222,198,166,0.030)',
    gap: 6,
  },
  currentLoggedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  currentLoggedText: {
    color: '#ECE5DA',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
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
    color: '#ECE5DA',
    fontSize: 11,
    fontWeight: '900',
  },
});
