import React from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/sl-text';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import type { CompletedRecapMovement, CompletedSessionRecapPayload } from '@/components/coach-mobile/CompletedSessionRecap';
import { SLFontFamilies } from '@/constants/theme';
import { SESSION_RECAP_ARCHIVE_ART } from '@/lib/session-recap-assets';
import { strengthLiftDestinationAsset } from '@/lib/strength-ledger-visual-assets';

/** A compact entry into the shared canonical recap, with no independent evidence calculation. */
export function SessionV3Closeout({ recap, movements, date, duration, hasReflection, record, unit, onUnit, onDone, onRecap, onRecord, onHistory, onReflection, refreshing, onRefresh, preview, topSafeArea = true }: {
  recap: CompletedSessionRecapPayload;
  movements: { movement: CompletedRecapMovement; result: string }[];
  date: string; duration: string; hasReflection: boolean; unit: string;
  record: { label: string; classification: string; result: string; detail: string } | null;
  onUnit: () => void; onDone: () => void; onRecap: () => void; onRecord: () => void;
  onHistory?: (movement: CompletedRecapMovement) => void; onReflection?: () => void;
  refreshing?: boolean; onRefresh?: () => void; preview: boolean; topSafeArea?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const core = movements.find(row => row.movement.kind === 'core')?.movement;
  const family = core?.lift === 'SQ' ? 'squat' : core?.lift === 'BN' || core?.lift === 'BP' ? 'bench' : core?.lift === 'DL' ? 'deadlift' : null;
  const art = family ? strengthLiftDestinationAsset(family, 'detail-hero').source : SESSION_RECAP_ARCHIVE_ART;
  const prescribed = recap.highlights?.prescribed_set_count;
  const completed = recap.highlights?.completed_prescribed_set_count;
  const allSaved = !!recap.highlights?.all_prescribed_work_logged;
  return <SafeAreaView edges={topSafeArea ? ['top'] : []} style={s.screen} testID="session-v3-closeout">
    <View style={s.header}><Pressable onPress={onDone} accessibilityRole="button" accessibilityLabel={preview ? 'Return to Coach Editor' : 'Return to Training'} style={s.icon}><Ionicons name="chevron-back" size={23} color="#ded3ee" /></Pressable><View style={s.copy}><Text style={s.headerTitle}>{preview ? `Preview · ${recap.athlete.name}` : 'Session complete'}</Text><Text style={s.meta}>{preview ? 'Read only · Return to Coach Editor' : date}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Open full Session recap and tools" onPress={onRecap} style={s.icon}><Ionicons name="ellipsis-horizontal" size={23} color="#d9cce9" /></Pressable></View>
    <ScrollView contentContainerStyle={s.content} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#b891eb" /> : undefined}>
      <View style={s.hero}><View style={s.heroCopy}><Text style={s.saved}>✓ {allSaved ? 'ALL WORKING SETS SAVED' : 'SESSION SAVED'}</Text><Text style={s.title}>{recap.session.label}</Text><Text style={s.body}>{recap.session.set_count} saved sets.{record ? '\nA new entry in your record.' : '\nYour work is in the Ledger.'}</Text></View><Image accessibilityIgnoresInvertColors accessible={false} source={art} resizeMode="contain" style={s.art} /></View>
      <View style={s.stats}>{[
        { value: prescribed && completed != null ? `${completed} / ${prescribed}` : String(recap.session.set_count), label: prescribed ? 'planned sets completed' : 'sets saved' },
        { value: duration, label: recap.session.duration_seconds == null ? 'duration unavailable' : 'recorded duration' },
        { value: String(recap.session.movement_count), label: 'movements' },
      ].map(row => <View key={row.label} style={s.stat}><Text style={s.statValue}>{row.value}</Text><Text style={s.meta}>{row.label}</Text></View>)}</View>
      {record ? <Pressable accessibilityRole="button" onPress={onRecord} style={s.record}><LinearGradient colors={['#2b221d88', '#14101b22']} style={StyleSheet.absoluteFill} /><Text style={s.gold}>{record.classification} · {record.label}</Text><Text style={s.recordValue}>{record.result}</Text><Text style={s.recordDetail}>{record.detail}</Text><Ionicons name="chevron-forward" color="#d6bf89" size={17} style={s.recordArrow} /></Pressable> : null}
      <View style={s.section}><Text style={s.sectionTitle}>EVIDENCE CREATED</Text><Pressable accessibilityRole="button" onPress={onRecap} style={s.link}><Text style={s.linkText}>Open recap</Text><Ionicons name="arrow-up-right-box" size={14} color="#be99ef" /></Pressable></View>
      {movements.slice(0, 2).map(({ movement, result }, index) => <Pressable key={movement.item_id || index} accessibilityRole="button" onPress={() => onHistory ? onHistory(movement) : onRecap()} style={s.movement}>
        <CanonicalMovementArtwork movement={movement} size={45} /><View style={s.copy}><Text style={s.movementName}>{movement.label}</Text><Text style={s.meta}>{result}</Text></View><Ionicons name="chevron-forward" color="#b2a1c6" size={17} />
      </Pressable>)}
      {movements.length > 2 ? <Pressable accessibilityRole="button" onPress={onRecap} style={s.more}><Text style={s.linkText}>＋</Text><Text style={[s.movementName, s.copy]}>{movements.length - 2} more movements</Text><Ionicons name="chevron-forward" size={17} color="#b2a1c6" /></Pressable> : null}
      {!movements.length ? <Text style={s.empty}>No performed sets were recorded.</Text> : null}
      {hasReflection ? <View style={s.reflection}><Text style={s.sectionTitle}>SESSION REFLECTION</Text><Text style={s.body}>{[recap.reflection.session_rpe != null ? `RPE ${recap.reflection.session_rpe}` : null, recap.reflection.strength, recap.reflection.fatigue ? `${recap.reflection.fatigue} fatigue` : null].filter(Boolean).join(' · ')}</Text>{recap.reflection.note ? <Text numberOfLines={2} style={s.meta}>{recap.reflection.note}</Text> : null}</View> : null}
    </ScrollView>
    <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}><View style={s.footerTools}>{onReflection ? <Pressable accessibilityRole="button" onPress={onReflection} style={s.reflectionAction}><Text style={s.body}>{hasReflection ? 'Edit reflection' : 'Add reflection'} →</Text></Pressable> : <Text style={[s.meta, s.copy]}>{preview ? 'Athlete preview · Read only' : 'Session saved'}</Text>}<Pressable accessibilityRole="button" accessibilityLabel={`Display units ${unit}`} onPress={onUnit} style={s.unit}><Text style={s.meta}>{unit}</Text></Pressable></View><Pressable accessibilityRole="button" onPress={onDone} style={s.primary}><LinearGradient colors={['#9862e8', '#6232c2']} style={s.primaryFill}><Text style={s.primaryText}>{preview ? 'Return to Coach Editor' : 'Return to Training'}</Text></LinearGradient></Pressable></View>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08060d' }, copy: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, minHeight: 61, borderBottomWidth: 1, borderBottomColor: '#302637' }, icon: { width: 35, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { color: '#f4effa', fontFamily: SLFontFamilies.sansSemiBold, fontSize: 15 }, meta: { color: '#b6adbf', fontSize: 12, lineHeight: 18 }, content: { paddingHorizontal: 22, paddingBottom: 20 }, hero: { minHeight: 188, justifyContent: 'center', marginTop: 10 }, heroCopy: { width: '59%', zIndex: 1 }, saved: { color: '#9dd9bd', fontFamily: SLFontFamilies.sansSemiBold, fontSize: 10, letterSpacing: 1.2 }, title: { color: '#f6f1fc', fontFamily: SLFontFamilies.sansBold, fontSize: 31, lineHeight: 37, marginTop: 12, marginBottom: 8 }, body: { color: '#d1c7dd', fontSize: 14, lineHeight: 20 }, art: { position: 'absolute', right: -10, width: '52%', height: 182, bottom: 0 }, stats: { flexDirection: 'row', gap: 14, paddingVertical: 17, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#332837' }, stat: { flex: 1 }, statValue: { color: '#f2ebf9', fontFamily: SLFontFamilies.sansSemiBold, fontSize: 23, marginBottom: 3 }, record: { paddingVertical: 18, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: '#413527' }, gold: { color: '#dbc98f', fontSize: 10, letterSpacing: 0.8, fontFamily: SLFontFamilies.sansSemiBold, textTransform: 'uppercase', paddingRight: 18 }, recordValue: { color: '#f6efd9', fontSize: 25, fontFamily: SLFontFamilies.sansBold, marginVertical: 7, paddingRight: 18 }, recordDetail: { color: '#c9bdac', fontSize: 12, lineHeight: 18, paddingRight: 18 }, recordArrow: { position: 'absolute', right: 0, top: 48 }, section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 9 }, sectionTitle: { color: '#e1d5ee', fontFamily: SLFontFamilies.sansSemiBold, fontSize: 11, letterSpacing: 0.6 }, link: { minHeight: 44, justifyContent: 'center', flexDirection: 'row', gap: 4, alignItems: 'center' }, linkText: { color: '#be99ef', fontSize: 13 }, movement: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 76, borderBottomWidth: 1, borderBottomColor: '#2c2233' }, movementName: { color: '#efe6f7', fontSize: 15, fontFamily: SLFontFamilies.sansSemiBold, flexShrink: 1 }, more: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 16 }, empty: { color: '#baafc7', paddingVertical: 28 }, reflection: { gap: 8, paddingVertical: 18, borderTopWidth: 1, borderTopColor: '#302438' }, footer: { borderTopWidth: 1, borderTopColor: '#302438', paddingHorizontal: 22, paddingTop: 4 }, footerTools: { flexDirection: 'row', alignItems: 'center', minHeight: 40 }, reflectionAction: { flex: 1, justifyContent: 'center', minHeight: 40 }, unit: { borderWidth: 1, borderColor: '#483655', width: 36, height: 30, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, primary: { borderWidth: 1, borderColor: '#af83e9', borderRadius: 14, overflow: 'hidden' }, primaryFill: { alignItems: 'center', justifyContent: 'center', minHeight: 52, padding: 12 }, primaryText: { color: '#fff', fontFamily: SLFontFamilies.sansBold, fontSize: 17 },
});
