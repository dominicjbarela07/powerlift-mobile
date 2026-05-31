import React from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type CoreMovementCardProps = {
  lift: 'SQ' | 'BN' | 'DL' | 'OHP' | 'VR';
  title: string;
  scheme: string;
  summary: string;
  suggestedLoad?: string | null;
  manualLoad?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

function iconLabel(lift: CoreMovementCardProps['lift']) {
  if (lift === 'SQ') return 'SQ';
  if (lift === 'BN') return 'BN';
  if (lift === 'DL') return 'DL';
  if (lift === 'OHP') return 'OH';
  return 'VR';
}

function iconTone(lift: CoreMovementCardProps['lift']) {
  if (lift === 'SQ') return styles.iconSquat;
  if (lift === 'BN') return styles.iconBench;
  if (lift === 'DL') return styles.iconDeadlift;
  if (lift === 'OHP') return styles.iconOhp;
  return styles.iconVariant;
}

function stopAndRun(event: GestureResponderEvent, fn: () => void) {
  event.stopPropagation();
  fn();
}

export function CoreMovementCard({
  lift,
  title,
  scheme,
  summary,
  suggestedLoad,
  manualLoad,
  canMoveUp,
  canMoveDown,
  onOpen,
  onMoveUp,
  onMoveDown,
  onRemove,
}: CoreMovementCardProps) {
  return (
    <Pressable style={styles.movementCard} onPress={onOpen}>
      <View style={styles.movementCardTop}>
        <View style={[styles.movementIconBlock, iconTone(lift)]}>
          <ThemedText variant="badge" style={styles.movementIconText}>{iconLabel(lift)}</ThemedText>
        </View>
        <View style={styles.movementTitleWrap}>
          <ThemedText variant="body" style={styles.movementTitle}>
            {title}
          </ThemedText>
          <ThemedText variant="bodyMuted" style={styles.movementSubtitle}>
            {scheme}
          </ThemedText>
          <ThemedText variant="bodyMuted" style={styles.movementSummary}>
            {summary}
          </ThemedText>
        </View>

        <View style={styles.movementActions}>
          <Pressable
            onPress={(event) => stopAndRun(event, onMoveUp)}
            disabled={!canMoveUp}
            style={[styles.reorderBtn, !canMoveUp && styles.reorderBtnDisabled]}
          >
            <ThemedText variant="badge" style={styles.reorderBtnText}>↑</ThemedText>
          </Pressable>

          <Pressable
            onPress={(event) => stopAndRun(event, onMoveDown)}
            disabled={!canMoveDown}
            style={[styles.reorderBtn, !canMoveDown && styles.reorderBtnDisabled]}
          >
            <ThemedText variant="badge" style={styles.reorderBtnText}>↓</ThemedText>
          </Pressable>

          <Pressable
            onPress={(event) => stopAndRun(event, onRemove)}
            style={styles.removeBtn}
          >
            <ThemedText variant="badge" style={styles.removeBtnText}>Remove</ThemedText>
          </Pressable>
          <ThemedText variant="bodyMuted" style={styles.overflowText}>...</ThemedText>
        </View>
      </View>

      {suggestedLoad ? (
        <View style={styles.movementMetaRow}>
          <ThemedText variant="bodyMuted" style={styles.suggestLabel}>
            {manualLoad ? 'Manual load' : 'Suggested load'}
          </ThemedText>
          <ThemedText variant="body" style={styles.suggestValue}>{suggestedLoad}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  movementCard: {
    marginTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(185,176,163,0.1)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(139,92,246,0.34)',
    backgroundColor: 'rgba(6,6,8,0.3)',
    paddingVertical: 11,
    paddingLeft: 10,
    paddingRight: 4,
    gap: 8,
  },
  movementCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  movementIconBlock: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  movementIconText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 11,
  },
  iconSquat: { backgroundColor: 'rgba(109,40,217,0.62)' },
  iconBench: { backgroundColor: 'rgba(51,65,85,0.78)' },
  iconDeadlift: { backgroundColor: 'rgba(22,101,52,0.66)' },
  iconOhp: { backgroundColor: 'rgba(146,64,14,0.62)' },
  iconVariant: { backgroundColor: 'rgba(87,83,78,0.72)' },
  movementTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  movementTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  movementSubtitle: {
    marginTop: 3,
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  movementSummary: {
    marginTop: 3,
    color: '#94A3B8',
    fontSize: 12,
  },
  movementActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  reorderBtn: {
    width: 25,
    height: 25,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,6,8,0.38)',
  },
  reorderBtnDisabled: {
    opacity: 0.35,
  },
  reorderBtnText: {
    color: '#CBD5E1',
    fontWeight: '800',
  },
  removeBtn: {
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.42)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(127,29,29,0.22)',
  },
  removeBtnText: {
    color: '#FECACA',
    fontWeight: '700',
  },
  overflowText: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 2,
  },
  movementMetaRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(185,176,163,0.1)',
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  suggestLabel: {
    color: '#A8A29E',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  suggestValue: {
    color: '#DDD6FE',
    fontSize: 13,
    fontWeight: '700',
  },
});
