import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies } from '@/constants/theme';
import type { SessionMovementItem } from './SessionEditingWorkspace';

type Order = { coreIds: number[]; accessoryIds: number[] };
type Props = { order: Order; items: Record<number, SessionMovementItem>; reduceMotion: boolean; onApply: (order: Order) => void; onCancel: () => void; onDragging: (active: boolean) => void };
export function InlineSessionReorder({ order, items, reduceMotion, onApply, onCancel, onDragging }: Props) {
  const [draft, setDraft] = useState<Order>(() => ({ coreIds: [...order.coreIds], accessoryIds: [...order.accessoryIds] }));
  return <View style={styles.root}>
    <View style={styles.header}><Text style={styles.title}>Reorder movements</Text><Pressable onPress={onCancel} style={styles.button}><Text style={styles.link}>Cancel</Text></Pressable></View>
    <Text style={styles.hint}>Hold a grip or use the arrows. Linked work stays together.</Text>
    {(['coreIds', 'accessoryIds'] as const).map((key) => {
      const ids = draft[key];
      // Linked TOP/backdown rows travel as one unit; their stable IDs do not change.
      const roots = ids.filter((id) => !items[id]?.parent_item_id || !ids.includes(items[id].parent_item_id!));
      const children = (id: number) => ids.filter((child) => items[child]?.parent_item_id === id);
      const move = (id: number, target: number) => {
        const next = [...roots]; next.splice(next.indexOf(id), 1); next.splice(Math.max(0, Math.min(next.length, target)), 0, id);
        setDraft((current) => ({ ...current, [key]: next.flatMap((root) => [root, ...children(root)]) }));
      };
      return roots.length ? <View key={key}><Text style={styles.section}>{key === 'coreIds' ? 'CORE' : 'ACCESSORIES'}</Text>{roots.map((id, index) => <ReorderRow key={id} item={items[id]} name={items[id]?.core_movement?.display_name || items[id]?.movement_identity?.display_name || items[id]?.movement || items[id]?.lift || 'Movement'} linked={children(id).length > 0} index={index} count={roots.length} reduceMotion={reduceMotion} onMove={(target) => move(id, target)} onDragging={onDragging} />)}</View> : null;
    })}
    <Pressable accessibilityRole="button" onPress={() => onApply(draft)} style={styles.apply}><Text style={styles.applyText}>Apply Order</Text></Pressable>
  </View>;
}
function ReorderRow({ item, name, linked, index, count, reduceMotion, onMove, onDragging }: { item: SessionMovementItem; name: string; linked: boolean; index: number; count: number; reduceMotion: boolean; onMove: (index: number) => void; onDragging: (active: boolean) => void }) {
  const y = useSharedValue(0); const dragging = useSharedValue(false);
  const gesture = Gesture.Pan().activateAfterLongPress(180).onStart(() => { dragging.value = true; runOnJS(onDragging)(true); }).onUpdate((event) => { y.value = event.translationY; }).onEnd(() => { runOnJS(onMove)(Math.max(0, Math.min(count - 1, index + Math.round(y.value / 72)))); }).onFinalize(() => { y.value = reduceMotion ? 0 : withSpring(0); dragging.value = false; runOnJS(onDragging)(false); });
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], zIndex: dragging.value ? 10 : 1, backgroundColor: dragging.value ? '#211A33' : '#0D0E13' }));
  return <Animated.View style={[styles.row, animated]}>
    <GestureDetector gesture={gesture}><Animated.View style={styles.button} accessibilityLabel={`Drag ${name}`} accessibilityRole="adjustable" accessibilityActions={[{ name: 'increment', label: 'Move down' }, { name: 'decrement', label: 'Move up' }]} onAccessibilityAction={(event) => onMove(index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}><Ionicons name="reorder-three" color={SLColors.accentViolet} size={24} /></Animated.View></GestureDetector>
    <CanonicalMovementArtwork movement={{ ...item, kind: item.variant === 'ACC' ? 'accessory' : 'core' }} size={40} />
    <View style={styles.copy}><Text numberOfLines={2} style={styles.name}>{name}</Text>{linked ? <Text style={styles.hint}>TOP + backdown</Text> : null}</View>
    <Pressable accessibilityLabel={`Move ${name} up`} disabled={index === 0} onPress={() => onMove(index - 1)} style={[styles.button, index === 0 && styles.disabled]}><Ionicons name="chevron-up" size={18} color={SLColors.textSecondary} /></Pressable>
    <Pressable accessibilityLabel={`Move ${name} down`} disabled={index === count - 1} onPress={() => onMove(index + 1)} style={[styles.button, index === count - 1 && styles.disabled]}><Ionicons name="chevron-down" size={18} color={SLColors.textSecondary} /></Pressable>
  </Animated.View>;
}
const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, gap: 8 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: SLColors.textPrimary, fontSize: 19, fontFamily: SLFontFamilies.sansSemiBold }, hint: { color: SLColors.textSecondary, fontSize: 12, lineHeight: 18 }, link: { color: SLColors.accentViolet, fontSize: 15 }, section: { color: SLColors.textSecondary, fontSize: 11, paddingVertical: 12 }, row: { height: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline }, button: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, name: { color: SLColors.textPrimary, fontSize: 15, fontFamily: SLFontFamilies.sansSemiBold }, disabled: { opacity: 0.25 }, apply: { marginTop: 12, minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#56318F' }, applyText: { color: SLColors.textPrimary, fontSize: 15, fontFamily: SLFontFamilies.sansSemiBold },
});
