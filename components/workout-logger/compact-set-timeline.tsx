import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { SLMotionPressable } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import {
  SLColors,
  SLFontFamilies,
  SLRadius,
  SLTypography,
} from '@/constants/theme';
import {
  compactTimelineScrollOffset,
  toggleCompletedSetSelection,
  type CompactSetTimelineState,
} from '@/lib/compact-set-timeline';

export type CompactSetTimelineRow = Readonly<{
  key: string;
  label: string;
  state: CompactSetTimelineState;
  resultText?: string | null;
  onEdit?: (() => void) | null;
  onRemove?: (() => void) | null;
}>;

type CompactSetTimelineProps = Readonly<{
  rows: readonly CompactSetTimelineRow[];
  totalCount?: number;
  reduceMotion?: boolean;
  title?: string;
  readyLabel?: string;
}>;

function spokenLabel(label: string) {
  const normalized = String(label || '').trim();
  if (/^BD\s*\d+$/i.test(normalized)) {
    return normalized.replace(/^BD\s*/i, 'Backdown ');
  }
  if (/^TOP\s*\d*$/i.test(normalized)) {
    return normalized.replace(/^TOP/i, 'Top set').trim();
  }
  return /^\d+$/.test(normalized) ? `Set ${normalized}` : normalized;
}

function readyStatus(label: string) {
  const spoken = spokenLabel(label);
  return `${spoken.toUpperCase()} · READY TO LOG`;
}

export function CompactSetTimeline({
  rows,
  totalCount = rows.length,
  reduceMotion = false,
  title = 'SET TIMELINE',
  readyLabel,
}: CompactSetTimelineProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [selectedCompletedKey, setSelectedCompletedKey] = useState<string | null>(null);
  const completedCount = rows.filter((row) => row.state === 'completed').length;
  const activeIndex = rows.findIndex((row) => row.state === 'active');
  const selectedIndex = rows.findIndex((row) => row.key === selectedCompletedKey);
  const selectedRow = selectedIndex >= 0 && rows[selectedIndex]?.state === 'completed'
    ? rows[selectedIndex]
    : null;
  const activeRow = activeIndex >= 0 ? rows[activeIndex] : null;
  const largeRail = rows.length > 5;
  const railWidth = largeRail ? rows.length * 70 : undefined;

  useEffect(() => {
    if (selectedCompletedKey && !selectedRow) setSelectedCompletedKey(null);
  }, [selectedCompletedKey, selectedRow]);

  useEffect(() => {
    if (!largeRail) return undefined;
    const focusIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, activeIndex);
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        animated: !reduceMotion,
        x: compactTimelineScrollOffset(focusIndex),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, largeRail, reduceMotion, selectedIndex]);

  const status = useMemo(() => {
    if (selectedRow) return null;
    if (activeRow) return readyLabel || readyStatus(activeRow.label);
    return completedCount >= totalCount ? 'ALL SETS · COMPLETE' : null;
  }, [activeRow, completedCount, readyLabel, selectedRow, totalCount]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.progress}>{completedCount} / {totalCount} COMPLETE</Text>
      </View>

      <ScrollView
        accessibilityLabel={`${title}, ${completedCount} of ${totalCount} complete`}
        contentContainerStyle={[styles.rail, railWidth ? { width: railWidth } : null]}
        horizontal
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
      >
        {rows.map((row, index) => {
          const isCompleted = row.state === 'completed';
          const isActive = row.state === 'active';
          const isSelected = selectedCompletedKey === row.key;
          const stateLabel = isCompleted ? 'completed' : isActive ? 'ready to log' : 'pending';
          const connectorComplete = isCompleted && rows[index + 1]?.state === 'completed';
          const connectorActive = isCompleted || isActive;
          return (
            <View
              key={row.key}
              style={[styles.nodeSlot, largeRail && styles.nodeSlotLargeRail]}
            >
              {index < rows.length - 1 ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.connector,
                    connectorComplete && styles.connectorCompleted,
                    !connectorComplete && connectorActive && styles.connectorActive,
                  ]}
                />
              ) : null}
              <SLMotionPressable
                accessibilityLabel={`${spokenLabel(row.label)}, ${stateLabel}`}
                accessibilityRole={isCompleted ? 'button' : 'text'}
                accessibilityState={{ selected: isSelected }}
                disabled={!isCompleted}
                disabledOpacity={1}
                onPress={() => setSelectedCompletedKey((current) => toggleCompletedSetSelection(current, row))}
                pressScale={reduceMotion ? 1 : 0.94}
                style={[
                  styles.node,
                  isCompleted && styles.nodeCompleted,
                  isActive && styles.nodeActive,
                  isSelected && styles.nodeSelected,
                ]}
              >
                {isCompleted ? (
                  <Ionicons color={SLColors.success} name="checkmark" size={22} />
                ) : (
                  <Text style={[styles.nodeText, isActive && styles.nodeTextActive]}>
                    {row.label}
                  </Text>
                )}
              </SLMotionPressable>
            </View>
          );
        })}
      </ScrollView>

      {selectedRow ? (
        <View style={styles.selectedBlock}>
          <View style={styles.selectedRow}>
            <View style={styles.selectedCopy}>
              <Text style={styles.selectedLabel}>{spokenLabel(selectedRow.label).toUpperCase()}</Text>
              <Text numberOfLines={1} style={styles.selectedResult}>
                {selectedRow.resultText || 'Logged'}
              </Text>
            </View>
            {selectedRow.onEdit ? (
              <SLMotionPressable
                accessibilityLabel={`Edit ${spokenLabel(selectedRow.label)}`}
                accessibilityRole="button"
                onPress={selectedRow.onEdit}
                style={styles.detailAction}
              >
                <Text style={styles.detailActionText}>Edit</Text>
                <Ionicons color={SLColors.accentViolet} name="chevron-forward" size={18} />
              </SLMotionPressable>
            ) : null}
            {selectedRow.onRemove ? (
              <SLMotionPressable
                accessibilityLabel={`Remove ${spokenLabel(selectedRow.label)}`}
                accessibilityRole="button"
                onPress={selectedRow.onRemove}
                style={styles.removeAction}
              >
                <Ionicons color={SLColors.danger} name="trash-outline" size={18} />
              </SLMotionPressable>
            ) : null}
          </View>
          <SLMotionPressable
            accessibilityLabel="Collapse completed set detail"
            accessibilityRole="button"
            onPress={() => setSelectedCompletedKey(null)}
            style={styles.collapseHintAction}
          >
            <Text style={styles.hint}>Tap outside to collapse detail</Text>
          </SLMotionPressable>
        </View>
      ) : (
        <View style={styles.statusBlock}>
          {status ? <Text style={styles.status}>{status}</Text> : null}
          <Text style={styles.hint}>Tap a completed set to view, edit or remove</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 20,
  },
  title: {
    color: SLColors.accentMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  progress: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    letterSpacing: 0.25,
  },
  rail: {
    alignItems: 'center',
    minWidth: '100%',
    paddingHorizontal: 2,
    paddingVertical: 8,
  },
  nodeSlot: {
    alignItems: 'center',
    flex: 1,
    minWidth: 54,
    position: 'relative',
  },
  nodeSlotLargeRail: {
    flex: 0,
    width: 70,
  },
  connector: {
    backgroundColor: SLColors.borderStrong,
    height: 2,
    left: '50%',
    position: 'absolute',
    right: '-50%',
    top: 21,
  },
  connectorActive: {
    backgroundColor: SLColors.accentMuted,
  },
  connectorCompleted: {
    backgroundColor: SLColors.success,
  },
  node: {
    alignItems: 'center',
    backgroundColor: SLColors.surface,
    borderColor: SLColors.borderStrong,
    borderRadius: 22,
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  nodeActive: {
    borderColor: SLColors.accentViolet,
    shadowColor: SLColors.accentViolet,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 7,
  },
  nodeCompleted: {
    backgroundColor: SLColors.successSoft,
    borderColor: SLColors.success,
  },
  nodeSelected: {
    shadowColor: SLColors.accentViolet,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.46,
    shadowRadius: 8,
  },
  nodeText: {
    color: SLColors.textMuted,
    fontFamily: SLFontFamilies.numeric,
    fontSize: 15,
    fontWeight: '600',
  },
  nodeTextActive: {
    color: SLColors.accentViolet,
  },
  statusBlock: {
    minHeight: 38,
  },
  status: {
    color: SLColors.accentMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    letterSpacing: 0.25,
  },
  hint: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    marginTop: 3,
  },
  selectedBlock: {
    gap: 2,
  },
  selectedRow: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceEmbedded,
    borderColor: SLColors.borderStandard,
    borderRadius: SLRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 6,
  },
  selectedCopy: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  selectedLabel: {
    color: SLColors.success,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  selectedResult: {
    color: SLColors.textStrong,
    flex: 1,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
  },
  detailAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  detailActionText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  removeAction: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 40,
  },
  collapseHintAction: {
    alignItems: 'center',
    minHeight: 24,
    justifyContent: 'center',
  },
});
