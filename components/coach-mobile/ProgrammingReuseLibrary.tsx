import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput } from '@/components/ui/sl-text';
import { StrengthLedgerBottomSheet } from '@/components/sheets/StrengthLedgerBottomSheet';
import { SLColors, SLFontFamilies } from '@/constants/theme';
import { fetchJson } from '@/lib/api';

type Week = { blockId: number; blockName: string; index: number; startDate: string; rangeLabel: string; sessions?: { id: number; label?: string | null; date?: string | null }[] };
type Source = { key: string; kind: 'session' | 'week' | 'block'; template: boolean; id: string | number; name: string; detail: string; count: number; preview?: any; week?: Week; unsupported?: string };
type Props = { reuseIntoSession?: { id: number; baseVersion: string }; athleteId: number; programId: number; programName: string; weeks: Week[]; initialWeek: Week; initialDate: string; onClose: () => void; onCopied: (result: { sessionId?: number; week: Week; date: string }) => void | Promise<void> };
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const daysFor = (start: string) => Array.from({ length: 7 }, (_, index) => { const day = new Date(`${start}T12:00:00`); day.setDate(day.getDate() + index); return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`; });
function previewNames(preview: any): string[] {
  if (!preview || typeof preview !== 'object') return [];
  if (Array.isArray(preview)) return preview.flatMap(previewNames);
  const name = preview.movement || preview.name;
  if (name && (preview.prescription || preview.sets != null)) {
    const reps = preview.reps_text || preview.reps;
    const effort = preview.rir_target != null ? `${preview.rir_target} RIR` : preview.pct != null ? `${Math.round(Number(preview.pct) * (Number(preview.pct) <= 1 ? 100 : 1))}%` : preview.rpe_target != null ? `${preview.rpe_target} RPE` : '';
    const prescription = preview.prescription || [preview.sets && reps ? `${preview.sets} × ${reps}` : '', effort].filter(Boolean).join(' · ');
    const equipment = preview.movement_identity?.equipment_family || preview.movement_identity?.implementation_family;
    return [`${name}\n${[prescription, equipment].filter(Boolean).join(' · ')}`];
  }
  return ['items', 'core_items', 'accessory_items', 'core_lifts', 'accessories', 'sessions', 'workout'].flatMap((key) => previewNames(preview[key]));
}

export function ProgrammingReuseLibrary({ reuseIntoSession, athleteId, programId, programName, weeks, initialWeek, initialDate, onClose, onCopied }: Props) {
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [kind, setKind] = useState<Source['kind']>('session');
  const [query, setQuery] = useState(''); const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState<Source | null>(null); const [destination, setDestination] = useState(initialWeek); const [date, setDate] = useState(initialDate);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [confirmation, setConfirmation] = useState(false); const pending = useRef(false);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setSources([]); setNextOffset(null);
    const endpoints = kind === 'session' ? [`session-sources?athlete_id=${athleteId}&program_id=${programId}&purpose=copy`, `session-templates?athlete_id=${athleteId}`] : [`${kind}-templates`];
    void Promise.all(endpoints.map(async (endpoint) => {
      const result = await fetchJson<any>(`/workouts/mobile/programming/${endpoint}`, { method: 'GET' });
      if (!result.ok || !result.json?.ok) throw new Error(result.json?.error || 'Library unavailable');
      const template = !endpoint.startsWith('session-sources');
      if (active && !template) setNextOffset(result.json.next_offset ?? null);
      return (result.json.templates || result.json.sources || []).map((row: any): Source => ({ key: `${template ? 'template' : 'session'}:${row.id}`, kind, template, id: row.id, name: row.name || 'Session', detail: template ? `Saved ${kind} template` : `${dateLabel(row.date)} · ${String(row.status || 'Session').replaceAll('_', ' ')}`, count: row.session_count || 1, preview: row.preview, unsupported: row.unsupported_reason }));
    })).then((rows) => { if (active) setSources(rows.flat()); }).catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [athleteId, programId, kind]);
  const candidates = useMemo(() => [
    ...(kind === 'week' ? weeks.filter((week) => week.sessions?.length).map((week): Source => ({ key: `week:${week.blockId}:${week.index}`, kind, template: false, id: `${week.blockId}:${week.index}`, name: `${week.blockName} · Week ${week.index}`, detail: week.rangeLabel, count: week.sessions!.length, week, preview: week.sessions })) : []), ...sources,
  ].filter((source) => `${source.name} ${source.detail}`.toLowerCase().includes(query.toLowerCase())), [kind, query, sources, weeks]);
  const loadMore = async () => {
    if (nextOffset === null || loading) return;
    setLoading(true);
    try {
      const response = await fetchJson<any>(`/workouts/mobile/programming/session-sources?athlete_id=${athleteId}&program_id=${programId}&purpose=copy&offset=${nextOffset}`, { method: 'GET' });
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'More Sessions could not be loaded.');
      setSources((current) => [...current, ...response.json.sources.filter((row: any) => !current.some((source) => source.key === `session:${row.id}`)).map((row: any): Source => ({ key: `session:${row.id}`, kind: 'session', template: false, id: row.id, name: row.name || 'Session', detail: `${dateLabel(row.date)} · ${row.status}`, count: 1 }))]);
      setNextOffset(response.json.next_offset ?? null);
    } catch (cause: any) { setError(cause.message); }
    finally { setLoading(false); }
  };
  const select = async (source: Source) => {
    setSelected(source); setConfirmation(false); setError('');
    if (source.kind === 'session' && !source.template) {
      setLoading(true);
      try { const result = await fetchJson<any>(`/workouts/mobile/${source.id}?history=summary`, { method: 'GET' }); if (!result.ok || !result.json?.ok || Number(result.json.athlete?.id) !== athleteId) throw new Error('Source Session unavailable'); setSelected({ ...source, preview: result.json.workout }); }
      catch (cause: any) { setError(cause.message); }
      finally { setLoading(false); }
    }
  };
  const copy = async () => {
    if (!selected || pending.current || selected.unsupported) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (reuseIntoSession) {
        const response = await fetchJson<any>(`/workouts/mobile/${reuseIntoSession.id}/apply-template`, { method: 'POST', body: { athlete_id: athleteId, base_version: reuseIntoSession.baseVersion, ...(selected.template ? { template_id: selected.id } : { source_workout_id: selected.id }) } as any });
        if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Training could not be reused.');
        await onCopied({ sessionId: reuseIntoSession.id, week: destination, date });
        return;
      }
      const common = { athlete_id: athleteId, program_id: programId, block_id: destination.blockId, confirm_conflicts: confirmation, confirm_template_truncation: confirmation };
      const payload = selected.kind === 'session'
        ? { ...common, action: selected.template ? 'apply_template' : 'copy_to', ...(selected.template ? { template_id: selected.id } : { source_workout_id: selected.id }), target_date: date }
        : selected.kind === 'week'
          ? { ...common, action: selected.template ? 'apply_template' : 'copy_from', block_week_index: destination.index, source_week_start: selected.week?.startDate || destination.startDate, source_block_id: selected.week?.blockId, source_block_week_index: selected.week?.index, week_start: destination.startDate, target_week_start: destination.startDate, target_block_id: destination.blockId, target_block_week_index: destination.index, ...(selected.template ? { template_id: selected.id } : {}) }
          : { ...common, action: 'apply_template', template_id: selected.id };
      const response = await fetchJson<any>(`/workouts/mobile/programming/${selected.kind}-actions`, { method: 'POST', body: payload as any });
      if (response.status === 409 && response.json?.requires_confirmation) { setConfirmation(true); setError(response.json.error || 'Review destination conflicts before copying.'); return; }
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Training could not be copied.');
      await onCopied({ sessionId: selected.kind === 'session' ? Number(response.json.workout?.id || response.json.workout_id) || undefined : undefined, week: destination, date: selected.kind === 'session' ? date : destination.startDate });
    } catch (cause: any) { setError(cause.message); }
    finally { pending.current = false; setBusy(false); }
  };
  const names = previewNames(selected?.preview);
  const placements = selected?.week?.sessions?.map((session) => ({ name: session.label || 'Session', offset: Math.round((new Date(`${session.date}T12:00:00`).getTime() - new Date(`${selected.week!.startDate}T12:00:00`).getTime()) / 86400000), from: session.date })) || selected?.preview?.sessions?.map((session: any) => ({ name: session.name, offset: session.relative_day })) || [];
  const placedDate = (offset: number) => { const day = new Date(`${destination.startDate}T12:00:00`); day.setDate(day.getDate() + offset); return day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
  const blockRange = (week: Week) => { const blockWeeks = weeks.filter((row) => row.blockId === week.blockId); return `${dateLabel(blockWeeks[0].startDate)} – ${dateLabel(daysFor(blockWeeks[blockWeeks.length - 1].startDate)[6])}`; };
  return <StrengthLedgerBottomSheet visible accessibilityLabel="Reuse training" heightFraction={0.94} onRequestClose={() => { if (!busy) onClose(); }} onDismiss={onClose}>
    <View style={styles.root}>
      <View style={styles.header}><Pressable disabled={busy} onPress={() => selected ? (setSelected(null), setError(''), setConfirmation(false)) : onClose()} style={styles.control}><Ionicons name="chevron-back" size={23} color={SLColors.accentViolet} /></Pressable><Text style={styles.title}>{selected ? 'Review & place' : 'Reuse training'}</Text><Pressable disabled={busy} accessibilityLabel="Close Library" onPress={onClose} style={styles.control}><Ionicons name="close" size={22} color={SLColors.textSecondary} /></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {!selected ? <>
          <View style={styles.search}><Ionicons name="search-outline" size={20} color={SLColors.textSecondary} /><TextInput value={query} onChangeText={setQuery} accessibilityLabel="Search Library" placeholder="Find training to reuse" placeholderTextColor={SLColors.textSecondary} style={styles.input} /></View>
          <View style={styles.tabs}>{(reuseIntoSession ? ['session'] as const : ['session', 'week', 'block'] as const).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: kind === value }} onPress={() => setKind(value)} style={[styles.tab, kind === value && styles.active]}><Text style={[styles.tabText, kind === value && styles.link]}>{value === 'session' ? 'Sessions' : value === 'week' ? 'Weeks' : 'Blocks'}</Text></Pressable>)}</View>
          <Text style={styles.context}>{programName}</Text>
          {candidates.map((source) => <Pressable key={source.key} accessibilityRole="button" onPress={() => void select(source)} style={styles.row}><View style={styles.sourceIcon}><Ionicons name={source.kind === 'session' ? 'barbell-outline' : 'calendar-outline'} size={25} color={SLColors.accentViolet} /></View><View style={styles.copy}><Text style={styles.name}>{source.name}</Text><Text style={styles.meta}>{source.detail}{source.kind !== 'session' ? ` · ${source.count} Sessions` : ''}</Text></View><Ionicons name="chevron-forward" color={SLColors.textSecondary} size={18} /></Pressable>)}
          {nextOffset !== null && kind === 'session' ? <Pressable accessibilityRole="button" disabled={loading} onPress={() => void loadMore()} style={styles.row}><Text style={styles.link}>Load earlier Sessions</Text></Pressable> : null}
          {!loading && !candidates.length ? <Text style={styles.empty}>No matching {kind === 'block' ? 'Block templates' : kind === 'week' ? 'weeks or templates' : 'Sessions or templates'}.</Text> : null}
        </> : <>
          <Text style={styles.eyebrow}>COPY FROM</Text><Text style={styles.sourceName}>{selected.name}</Text><Text style={styles.meta}>{selected.detail}</Text>
          {names.length ? <View style={styles.preview}>{names.map((name, index) => <Text key={`${index}-${name}`} style={styles.previewText}>{name}</Text>)}</View> : null}
          {placements.length ? <View style={styles.preview}>{placements.map((placement: any, index: number) => <Text key={index} style={styles.previewText}>{placement.name}{"\n"}{placement.from ? `${dateLabel(placement.from)} → ` : ""}{placedDate(placement.offset)}</Text>)}</View> : null}
          {selected.unsupported ? <Text style={styles.error}>{selected.unsupported}</Text> : null}
          {!reuseIntoSession ? <><Text style={styles.eyebrow}>PLACE IN {selected.kind === 'block' ? 'BLOCK' : 'WEEK'}</Text>
          {weeks.filter((week, index, all) => selected.kind !== 'block' || all.findIndex((other) => other.blockId === week.blockId) === index).map((week) => <Pressable key={`${week.blockId}:${week.index}`} onPress={() => { setDestination(week); setDate(week.startDate); setConfirmation(false); setError(''); }} style={[styles.destination, destination.blockId === week.blockId && (selected.kind === 'block' || destination.index === week.index) && styles.destinationSelected]}><View style={styles.copy}><Text style={styles.name}>{week.blockName}{selected.kind !== 'block' ? ` · Week ${week.index}` : ''}</Text><Text style={styles.meta}>{selected.kind === 'block' ? blockRange(week) : week.rangeLabel}{week.sessions?.length ? ` · ${week.sessions.length} existing Sessions` : ''}</Text></View>{destination.blockId === week.blockId && (selected.kind === 'block' || destination.index === week.index) ? <Ionicons name="checkmark-circle" size={22} color={SLColors.accentViolet} /> : null}</Pressable>)}
          {selected.kind === 'session' ? <View style={styles.dates}>{daysFor(destination.startDate).map((day) => <Pressable key={day} onPress={() => { setDate(day); setConfirmation(false); }} style={[styles.day, date === day && styles.destinationSelected]}><Text style={styles.meta}>{new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}</Text><Text style={styles.name}>{Number(day.slice(-2))}</Text></Pressable>)}</View> : null}
          </> : <Text style={styles.explanation}>Add these prescriptions to this empty Session on {dateLabel(date)}.</Text>}
          <Text style={styles.explanation}>{reuseIntoSession ? 'Keeps this draft and its date' : selected.kind === 'session' ? 'Creates a new draft' : 'Creates new drafts'} with the same prescriptions. The source stays unchanged.</Text>
        </>}
        {loading ? <ActivityIndicator color={SLColors.accentViolet} /> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
      {selected ? <View style={styles.footer}><Text style={styles.meta}>{destination.blockName} · {selected.kind === 'session' ? dateLabel(date) : `Week ${destination.index}`}</Text><Pressable disabled={busy || loading || !!selected.unsupported || (!!error && !confirmation)} onPress={() => void copy()} style={[styles.primary, (busy || loading || !!selected.unsupported) && { opacity: 0.45 }]}>{busy ? <ActivityIndicator color={SLColors.textPrimary} /> : <Text style={styles.primaryText}>{reuseIntoSession ? 'Use in this Session' : confirmation ? 'Confirm & copy' : `Copy ${selected.kind === 'session' ? 'Session' : selected.kind === 'week' ? 'Week' : 'Block'}`}</Text>}</Pressable></View> : null}
    </View>
  </StrengthLedgerBottomSheet>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }, control: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }, title: { flex: 1, color: SLColors.textPrimary, fontSize: 22, fontFamily: SLFontFamilies.sansBold }, content: { paddingBottom: 32 }, search: { marginHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 12, backgroundColor: '#14131B', paddingHorizontal: 12 }, input: { minHeight: 48, flex: 1, color: SLColors.textPrimary, fontSize: 15 }, tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10 }, tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, active: { borderBottomColor: SLColors.accentViolet }, tabText: { color: SLColors.textSecondary, fontSize: 14 }, link: { color: SLColors.accentViolet }, context: { color: SLColors.textSecondary, fontSize: 12, padding: 16 }, row: { minHeight: 84, paddingVertical: 12, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline }, sourceIcon: { width: 42, alignItems: 'center' }, copy: { flex: 1, gap: 5 }, name: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 15, lineHeight: 20 }, meta: { color: SLColors.textSecondary, fontSize: 12, lineHeight: 18 }, empty: { margin: 32, color: SLColors.textSecondary, textAlign: 'center' }, eyebrow: { color: SLColors.accentViolet, fontSize: 11, letterSpacing: 1, marginHorizontal: 16, marginTop: 22, marginBottom: 10 }, sourceName: { color: SLColors.textPrimary, fontSize: 24, fontFamily: SLFontFamilies.sansBold, marginHorizontal: 16 }, preview: { margin: 16, gap: 8, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderHairline }, previewText: { color: SLColors.textSecondary, fontSize: 14 }, destination: { marginHorizontal: 16, minHeight: 66, padding: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderHairline }, destinationSelected: { backgroundColor: '#221936', borderColor: SLColors.accentViolet }, dates: { flexDirection: 'row', margin: 16 }, day: { flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 9 }, explanation: { margin: 16, color: SLColors.textSecondary, fontSize: 13, lineHeight: 19 }, error: { color: '#FF7995', margin: 16, fontSize: 14, lineHeight: 20 }, footer: { padding: 16, paddingBottom: 28, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderHairline }, primary: { minHeight: 50, borderRadius: 14, backgroundColor: '#633AA0', justifyContent: 'center', alignItems: 'center' }, primaryText: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 16 },
});
