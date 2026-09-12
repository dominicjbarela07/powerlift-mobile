import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { MovementArtworkHero } from '@/components/movement/MovementArtworkHero';
import { resolveApprovedExactMovementArtwork } from '@/lib/movement-artwork-hero';
import type { CanonicalMovementArtworkInput } from '@/lib/canonical-movement-artwork';
import { CompactSetTimeline } from './compact-set-timeline';
import { SLColors, SLFontFamilies } from '@/constants/theme';
import type { SupersetRoundLog, SupersetRoundModel, SupersetRoundSourceItem } from '@/lib/superset-rounds';
import { supersetMemberLabel } from '@/lib/superset-workspace-focus';
import { canDeletePersistedSetLog } from '@/lib/set-log-delete-order';

export type SupersetWorkspaceLog = SupersetRoundLog & Readonly<{
  id: number; actual_weight_kg?: number | null; actual_reps?: number | null;
  actual_rpe?: number | null; actual_rir?: number | null; resultLine?: string | null;
}>;
export type SupersetWorkspaceItem = SupersetRoundSourceItem & Readonly<{
  title: string; canConfigureEquipment?: boolean; equipmentRequired?: boolean;
  equipmentContext?: string | null; prescription: string; historyLine?: string | null;
  movementArtwork?: CanonicalMovementArtworkInput | null;
  set_logs?: readonly SupersetWorkspaceLog[] | null;
}>;
type Props = {
  groupLabel: string; model: SupersetRoundModel<SupersetWorkspaceItem>;
  phase: 'pre' | 'active' | 'complete'; expanded: boolean; selectedItemId?: number;
  canLog: boolean; reduceMotion?: boolean; onToggle: () => void;
  onSelectMember: (itemId: number) => void; onConfigureEquipment: (itemId: number) => void;
  onOpenHistory: (itemId: number) => void; onSwapMovement: (itemId: number) => void;
  swapActionForItem: (itemId: number) => 'Swap' | 'Sub' | null; swappingItemId?: number | null;
  onEditSet: (item: SupersetWorkspaceItem, log: SupersetWorkspaceLog) => void;
  onDeleteSet: (item: SupersetWorkspaceItem, log: SupersetWorkspaceLog) => void;
};

/** Shared Pre/Active/Coach composition. The canonical floating footer owns the
 * sole logging action; rows own identity and contextual tools, never a second Logger. */
export function SupersetRoundWorkspace({ groupLabel, model, phase, expanded, selectedItemId, canLog,
  reduceMotion = false, onToggle, onSelectMember, onConfigureEquipment, onOpenHistory,
  onSwapMovement, swapActionForItem, swappingItemId, onEditSet, onDeleteSet }: Props) {
  const [evidenceItemId, setEvidenceItemId] = useState<number | null>(null);
  const isActive = phase === 'active';
  const complete = model.status === 'complete';
  const currentRound = model.rounds.find(round => round.index === model.currentRoundIndex);
  const roundHint = currentRound?.entries.length === 1
    ? `${supersetMemberLabel(groupLabel, currentRound.entries[0].position)} only this round · rest after the set`
    : 'Alternate members · rest after the round';
  const progress = complete ? `${model.roundCount} rounds complete`
    : isActive ? `Round ${model.currentRoundIndex || 1} of ${model.roundCount}`
      : `${model.roundCount} ${model.roundCount === 1 ? 'round' : 'rounds'}`;
  return <View style={[s.group, isActive && s.activeGroup]} testID={`superset-${groupLabel}`}>
    <Pressable disabled={isActive} accessibilityRole={isActive ? "header" : "button"} accessibilityState={{ expanded }} accessibilityLabel={`Superset ${groupLabel}, ${progress}`} onPress={onToggle} style={s.header}>
      <Text style={s.eyebrow}>SUPERSET {groupLabel}</Text>
      <Text style={[s.roundLabel, complete && s.complete]}>{progress}</Text>
      {!isActive ? <Ionicons color="#b4a6c6" name={expanded ? 'chevron-up' : 'chevron-down'} size={16} /> : null}
    </Pressable>
    {isActive ? <View style={s.roundRail} accessibilityLabel={`${model.completedRounds} of ${model.roundCount} rounds complete`}>
      {model.rounds.map(round => <View key={round.index} style={[s.roundSegment, round.complete && s.roundComplete, round.index === model.currentRoundIndex && s.roundCurrent]} />)}
    </View> : null}
    {model.movements.map(movement => {
      const item = movement.item;
      const label = supersetMemberLabel(groupLabel, movement.position);
      const selected = expanded && selectedItemId === item.id;
      const roundEntry = currentRound?.entries.find(entry => entry.itemId === item.id);
      const state = movement.complete ? 'COMPLETE' : selected && isActive ? `SET ${movement.nextSetIndex} · CURRENT` : roundEntry?.log ? 'SAVED' : isActive ? 'NEXT' : null;
      const logs = [...(item.set_logs || [])].sort((a,b) => Number(a.set_index) - Number(b.set_index));
      const swapAction = swapActionForItem(item.id);
      const swapBusy = swappingItemId === item.id;
      const showEvidence = selected && evidenceItemId === item.id;
      const hero = selected && isActive && !movement.complete ? resolveApprovedExactMovementArtwork(item.movementArtwork) : null;
      return <View key={item.id} style={[s.member, selected && isActive && s.selectedMember]}>
        {hero ? <MovementArtworkHero artworkKey={hero.key} receiptId={hero.candidate_id} surface="superset" reduceMotion={reduceMotion} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${item.title}, ${movement.loggedRequiredSets} of ${movement.requiredSets} sets${state ? `, ${state}` : ''}`} onPress={() => onSelectMember(item.id)} style={s.memberRow}>
          <Text style={[s.memberLabel, movement.complete && s.complete]}>{label}</Text>
          <CanonicalMovementArtwork requireHumanApproval movement={item.movementArtwork} accessoryPresentation="muscle-focus" size={selected && isActive ? 56 : 44} />
          <View style={s.memberCopy}>
            <Text numberOfLines={0} style={[s.title, selected && isActive && s.activeTitle]}>{item.title}</Text>
            <Text style={[s.prescription, selected && isActive && s.activePrescription, hero && s.heroPrescription]}>{item.prescription}</Text>
            {item.equipmentRequired ? <Text style={s.required}>Equipment required</Text> : item.equipmentContext ? <Text style={s.equipment}>{item.equipmentContext}</Text> : null}
            {state ? <Text style={[s.state, movement.complete || roundEntry?.log ? s.complete : selected ? s.current : null]}>{state}</Text> : null}
          </View>
          {movement.complete ? <Ionicons name="checkmark-circle" color={SLColors.success} size={18} /> : null}
        </Pressable>
        {selected ? <View style={s.details}>
          <View style={s.tools}>
            {item.canConfigureEquipment ? <Pressable accessibilityRole="button" accessibilityLabel={`Configure equipment for ${label}, ${item.title}`} onPress={() => onConfigureEquipment(item.id)} style={({ pressed }) => [s.tool, pressed && s.controlPressed]}>
              <Ionicons name="barbell-outline" color="#c9b1ec" size={16} /><Text style={s.toolText}>Equipment</Text>
            </Pressable> : null}
            {swapAction ? <Pressable accessibilityRole="button" accessibilityLabel={`${swapAction} ${item.title}`} disabled={swapBusy} onPress={() => onSwapMovement(item.id)} style={({ pressed }) => [s.tool, pressed && s.controlPressed]}>
              {swapBusy ? <ActivityIndicator size="small" color="#c9b1ec" /> : <Ionicons name="swap-horizontal-outline" color="#c9b1ec" size={16} />}<Text style={s.toolText}>{swapBusy ? 'Updating…' : swapAction}</Text>
            </Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={`History for ${item.title}`} onPress={() => onOpenHistory(item.id)} style={({ pressed }) => [s.tool, pressed && s.controlPressed]}><Ionicons name="time-outline" color="#aadce5" size={16} /><Text style={s.historyText}>History</Text></Pressable>
            {logs.length ? <Pressable accessibilityRole="button" accessibilityLabel={`View saved sets for ${item.title}`} accessibilityState={{ expanded: showEvidence }} onPress={() => setEvidenceItemId(showEvidence ? null : item.id)} style={({ pressed }) => [s.tool, pressed && s.controlPressed]}><Text style={s.toolText}>{logs.length} saved {logs.length === 1 ? 'set' : 'sets'}</Text><Ionicons name={showEvidence ? 'chevron-up' : 'chevron-down'} color="#c9b1ec" size={14} /></Pressable> : null}
          </View>
          {isActive && item.historyLine ? <Pressable accessibilityRole="button" accessibilityLabel={`Prior performance for ${item.title}`} onPress={() => onOpenHistory(item.id)} style={s.prior}><Text style={s.priorText}>{item.historyLine}</Text><Ionicons name="arrow-up-right-box-outline" color="#aadce5" size={14} /></Pressable> : null}
          {showEvidence ? <CompactSetTimeline reduceMotion={reduceMotion} title={`${label} · SAVED SETS`} totalCount={movement.requiredSets} rows={Array.from({ length: movement.requiredSets }, (_, offset) => {
            const setIndex = offset + 1;
            const persistedLog = logs.find(log => log.set_index === setIndex);
            const canModifyLog = Boolean(canLog && persistedLog && Number.isFinite(Number(persistedLog.id)));
            return { key: `${item.id}:${setIndex}`, label: String(setIndex), state: persistedLog ? 'completed' as const : movement.nextSetIndex === setIndex ? 'active' as const : 'locked' as const,
              resultText: persistedLog?.resultLine || 'Logged',
              onEdit: canModifyLog && persistedLog ? () => onEditSet(item, persistedLog) : undefined,
              onRemove: canModifyLog && persistedLog && canDeletePersistedSetLog(persistedLog, item.set_logs) ? () => onDeleteSet(item, persistedLog) : undefined };
          })} /> : null}
        </View> : null}
      </View>;
    })}
    {isActive && !complete ? <Text style={s.roundHint}>{roundHint}</Text> : null}
  </View>;
}
const s = StyleSheet.create({
  group: { marginBottom: 12, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#74518e', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2b2632' },
  activeGroup: { borderLeftColor: '#bd80c3', paddingBottom: 8 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4, paddingVertical: 12 },
  eyebrow: { color: '#ceaceb', fontSize: 12, fontFamily: SLFontFamilies.sansBold, letterSpacing: 1.1, flex: 1, minWidth: 0 },
  roundLabel: { color: '#d1bdde', fontSize: 13, lineHeight: 18 },
  roundRail: { flexDirection: 'row', gap: 5, marginBottom: 8 },
  roundSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#302a3b' },
  roundCurrent: { backgroundColor: '#cf8ebc' }, roundComplete: { backgroundColor: '#80d7a8' },
  member: { paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#29232f' },
  selectedMember: { backgroundColor: '#0d0b12' },
  memberRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 3, paddingRight: 4 },
  memberLabel: { color: '#bd9fdc', fontSize: 12, width: 23, fontFamily: SLFontFamilies.sansSemiBold },
  memberCopy: { flex: 1, minWidth: 0 },
  title: { color: '#f5f0fb', fontSize: 16, lineHeight: 21, fontFamily: SLFontFamilies.sansSemiBold },
  activeTitle: { fontSize: 23, lineHeight: 28 },
  activePrescription: { fontSize: 15, lineHeight: 22 },
  heroPrescription: { maxWidth: '55%' },
  prescription: { color: '#c3b9cf', fontSize: 12, lineHeight: 18, marginTop: 3 },
  equipment: { color: '#aea2be', fontSize: 11, lineHeight: 16, marginTop: 2 },
  required: { color: '#e8bd83', fontSize: 11, lineHeight: 17, marginTop: 2 },
  state: { color: '#9c91ad', fontSize: 10, lineHeight: 16, marginTop: 4, fontFamily: SLFontFamilies.sansSemiBold },
  current: { color: '#d7a9f1' }, complete: { color: '#86ddb0' },
  details: { paddingLeft: 4 }, tools: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 15 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44 },
  controlPressed: { opacity: 0.6 },
  toolText: { color: '#c9b1ec', fontSize: 12 }, historyText: { color: '#aadce5', fontSize: 12 },
  prior: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }, priorText: { flex: 1, color: '#afcbd5', fontSize: 12, lineHeight: 18 },
  roundHint: { color: '#a59bb2', fontSize: 11, lineHeight: 17, paddingTop: 10 },
});
