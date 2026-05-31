import React from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type AccessoryMovementCardProps = {
  title: string;
  summary: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

function stopAndRun(event: GestureResponderEvent, fn: () => void) {
  event.stopPropagation();
  fn();
}

export function AccessoryMovementCard({
  title,
  summary,
  canMoveUp,
  canMoveDown,
  onOpen,
  onMoveUp,
  onMoveDown,
  onRemove,
}: AccessoryMovementCardProps) {
  return (
    <Pressable style={styles.movementCard} onPress={onOpen}>
      <View style={styles.movementCardTop}>
        <View style={[styles.movementIconBlock, styles.iconAccessory]}>
          <ThemedText variant="badge" style={styles.movementIconText}>AC</ThemedText>
        </View>
        <View style={styles.movementTitleWrap}>
          <ThemedText variant="body" style={styles.movementTitle}>
            {title}
          </ThemedText>
          <ThemedText variant="bodyMuted" style={styles.movementSubtitle}>Accessory</ThemedText>
          <ThemedText variant="bodyMuted" style={styles.movementSummary}>{summary}</ThemedText>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  movementCard: {
    marginTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(185,176,163,0.1)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(185,176,163,0.22)',
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
  iconAccessory: { backgroundColor: 'rgba(127,29,29,0.58)' },
  movementIconText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 11,
  },
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
    width: 26,
    height: 26,
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
});
