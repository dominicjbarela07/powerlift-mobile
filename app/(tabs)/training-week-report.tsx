import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard/KeyboardSurface';
import { Text } from '@/components/ui/sl-text';
import { useAuth } from '@/context/AuthContext';
import { SLColors } from '@/constants/theme';
import { fetchJson } from '@/lib/api';
import { moveReportWeek, reportDuration, reportWeekEnd, reportWeekOf, shareTrainingWeekPdf, type WeekReportExport, type TrainingWeekReport } from '@/lib/training-week-report';

export default function TrainingWeekReportScreen() {
  const { user, token } = useAuth();
  const params = useLocalSearchParams<{ weekOf?: string }>();
  const router = useRouter(); const insets = useSafeAreaInsets();
  const [week, setWeek] = useState(() => reportWeekOf(params.weekOf));
  const [unit, setUnit] = useState<'lb' | 'kg'>(user?.preferred_units === 'kg' ? 'kg' : 'lb');
  const [result, setResult] = useState<WeekReportExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [revision, setRevision] = useState(0);
  const sharingRef = useRef(false);
  const generation = useRef(0);
  const currentKey = `${user?.id}:${week}:${unit}`;
  const keyRef = useRef(currentKey); keyRef.current = currentKey;
  const [loadedKey, setLoadedKey] = useState('');
  const thisWeek = reportWeekOf();
  useFocusEffect(useCallback(() => {
    const controller = new AbortController(); const request = ++generation.current;
    setResult(null); setLoadedKey(''); setLoading(true); setError(null); setShareError(null);
    if (!user?.id || !token) { setError('Sign in to view your training week.'); setLoading(false); return; }
    void (async () => {
      try {
        const query = new URLSearchParams({ week_of: week, unit });
        const response = await fetchJson<WeekReportExport & { error?: string }>(`/athletes/mobile/training-week-report?${query}`, { signal: controller.signal });
        if (controller.signal.aborted || generation.current !== request) return;
        if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Your report could not be prepared.');
        if (!response.json.pdf_base64?.startsWith('JVBERi0')) throw new Error('The PDF could not be prepared. Please try again.');
        setResult(response.json); setLoadedKey(currentKey);
      } catch (caught: any) {
        if (!controller.signal.aborted && generation.current === request) setError(caught?.message || 'Your report could not be prepared.');
      } finally { if (!controller.signal.aborted && generation.current === request) setLoading(false); }
    })();
    return () => { controller.abort(); generation.current += 1; };
  }, [currentKey, revision, token, unit, user?.id, week]));
  const visible = loadedKey === currentKey ? result : null;
  const summary = visible?.report.summary;
  const share = async () => {
    if (!visible || !user?.id || sharingRef.current) return;
    const ownerKey = currentKey;
    sharingRef.current = true; setSharing(true); setShareError(null);
    try {
      await shareTrainingWeekPdf(visible, user.id, {
        available: () => Sharing.isAvailableAsync(),
        write: async (base64, filename) => {
          if (keyRef.current !== ownerKey) throw new Error('Your account or reporting week changed. Prepare the report again.');
          if (!FileSystem.cacheDirectory) throw new Error('PDF storage is unavailable.');
          const uri = FileSystem.cacheDirectory + filename;
          const directory = uri.slice(0, uri.lastIndexOf('/'));
          await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
          try { await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 }); }
          catch (caught) { await FileSystem.deleteAsync(directory, { idempotent: true }); throw caught; }
          return uri;
        },
        share: async (uri) => {
          if (keyRef.current !== ownerKey) throw new Error('Your account or reporting week changed. Prepare the report again.');
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Weekly training report' });
        },
        remove: (uri) => FileSystem.deleteAsync(uri.slice(0, uri.lastIndexOf('/')), { idempotent: true }),
      });
    } catch (caught: any) { if (keyRef.current === ownerKey) setShareError(caught?.message || 'The PDF could not be shared.'); }
    finally { sharingRef.current = false; setSharing(false); }
  };
  const changeWeek = (direction: number) => { setWeek(moveReportWeek(week, direction)); void Haptics.selectionAsync(); };
  return <View style={styles.root}>
    <View style={styles.heading}>
      <Pressable accessibilityLabel="Back to Calendar" accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/athlete-calendar')} style={styles.iconButton}>
        <Ionicons name="chevron-back" size={25} color={SLColors.textPrimary} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>Weekly training report</Text>
    </View>
    <View style={styles.weekPicker}>
      <Pressable accessibilityLabel="Previous reporting week" accessibilityRole="button" disabled={sharing} onPress={() => changeWeek(-1)} style={styles.iconButton}><Ionicons name="chevron-back" size={21} color={SLColors.accentMuted} /></Pressable>
      <View style={styles.weekCopy}>
        <Text style={styles.weekTag}>{week === thisWeek ? 'THIS WEEK · SO FAR' : 'REPORTING WEEK'}</Text>
        <Text style={styles.weekDates}>{new Date(`${week}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(`${reportWeekEnd(week)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
      </View>
      <Pressable accessibilityLabel="Next reporting week" accessibilityRole="button" disabled={week >= thisWeek || sharing} onPress={() => changeWeek(1)} style={[styles.iconButton, week >= thisWeek && styles.disabled]}><Ionicons name="chevron-forward" size={21} color={SLColors.accentMuted} /></Pressable>
    </View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      {loading ? <View style={styles.status}><ActivityIndicator color={SLColors.accentViolet} /><Text style={styles.muted}>Loading your training week…</Text></View> : error ? <View style={styles.status}><Ionicons name="cloud-offline-outline" size={28} color={SLColors.danger} /><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setRevision(v => v + 1)} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : visible && summary ? <>
        <View style={styles.summary}>
          <Stat value={String(summary.session_count)} label="Sessions" />
          <Stat value={String(summary.set_count)} label="Work sets" />
          <View style={styles.units}>{(['lb', 'kg'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Report in ${value}`} accessibilityState={{ selected: unit === value }} disabled={sharing} onPress={() => setUnit(value)} style={[styles.unit, unit === value && styles.unitActive]}><Text style={[styles.unitText, unit === value && styles.unitTextActive]}>{value}</Text></Pressable>)}</View>
        </View>
        {!summary.session_count ? <View style={styles.status}><Ionicons name="calendar-outline" size={32} color={SLColors.accentMuted} /><Text style={styles.emptyTitle}>No completed Sessions</Text><Text style={styles.muted}>Choose an earlier week to see your saved training.</Text><Pressable accessibilityRole="button" onPress={() => changeWeek(-1)} style={styles.retry}><Text style={styles.retryText}>Previous week</Text></Pressable></View> : <View style={styles.sessions}>
          {visible.report.sessions.map(session => <SessionRow key={`${currentKey}:${session.id}`} session={session} />)}
        </View>}
      </> : null}
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(14, insets.bottom) }]}>
      {shareError ? <Text accessibilityRole="alert" style={styles.error}>{shareError}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Share training week PDF" disabled={!summary?.session_count || sharing || loading} onPress={() => void share()} style={({ pressed }) => [styles.share, (!summary?.session_count || loading) && styles.disabled, pressed && styles.pressed]}>
        <LinearGradient colors={[SLColors.accentViolet, '#7936D5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shareFill}>
          {sharing ? <ActivityIndicator color="white" /> : <Ionicons name="share-outline" size={22} color="white" />}
          <Text style={styles.shareText}>{sharing ? 'Opening PDF…' : 'Export PDF'}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  </View>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function SessionRow({ session }: { session: TrainingWeekReport['sessions'][number] }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(`${session.date}T12:00:00`);
  return <View style={styles.session}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${session.title}, ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${session.set_count} work sets`} accessibilityState={{ expanded }} onPress={() => { setExpanded(v => !v); void Haptics.selectionAsync(); }} style={({ pressed }) => [styles.sessionHeader, pressed && styles.pressed]}>
      <View style={styles.sessionDate}><Text style={styles.sessionDay}>{date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</Text><Text style={styles.sessionNumber}>{date.getDate()}</Text></View>
      <View style={styles.sessionCopy}><Text style={styles.sessionTitle}>{session.title}</Text><Text style={styles.sessionMeta}>{session.set_count} work sets{session.duration_seconds !== null ? ` · ${reportDuration(session.duration_seconds)}` : ''}</Text></View>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color={SLColors.accentMuted} />
    </Pressable>
    {expanded ? <View style={styles.sessionBody}>
      {session.movements.map((movement, index) => <View key={index} style={styles.movement}>
        <Text style={styles.movementName}>{movement.name}</Text>
        {movement.equipment ? <Text style={styles.equipment}>{movement.equipment}</Text> : null}
        {movement.set_lines.map((line, i) => <Text key={i} style={styles.setLine}>{line}</Text>)}
        {movement.comparison.prior_set ? <View style={styles.comparison}>
          {movement.comparison.percent !== null ? <Text style={[styles.comparisonLabel, movement.comparison.percent > 0 && styles.improved]}>{movement.comparison.label}</Text> : null}
          <Text style={styles.previous}>Last · {new Date(`${movement.comparison.prior_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {movement.comparison.prior_set}{movement.comparison.prior_effort ? ` @ ${movement.comparison.prior_effort}` : ''}</Text>
        </View> : null}
      </View>)}
      {session.note ? <View style={styles.note}><Text style={styles.noteLabel}>SESSION NOTE{session.note_is_excerpt ? ' · EXCERPT' : ''}</Text><Text style={styles.noteText}>{session.note}</Text></View> : null}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SLColors.background },
  heading: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, paddingTop: 14, paddingBottom: 21, gap: 10 },
  title: { flex: 1, fontSize: 27, lineHeight: 33, fontWeight: '700', color: SLColors.textStrong },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  weekPicker: { marginHorizontal: 22, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: SLColors.borderStandard, paddingVertical: 10 },
  weekCopy: { flex: 1, alignItems: 'center' },
  weekTag: { color: SLColors.accentMuted, fontSize: 10, letterSpacing: 1.6, marginBottom: 5 },
  weekDates: { color: SLColors.textStrong, fontSize: 19, fontWeight: '600' },
  content: { paddingHorizontal: 22 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 26 },
  stat: { flex: 1 },
  statValue: { color: SLColors.textStrong, fontSize: 32, lineHeight: 37, fontWeight: '600' },
  statLabel: { color: SLColors.textMuted, fontSize: 12, marginTop: 4 },
  units: { flexDirection: 'row', borderRadius: 12, backgroundColor: SLColors.surfaceInset, padding: 3 },
  unit: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 9 },
  unitActive: { backgroundColor: SLColors.surfaceRaised },
  unitText: { fontSize: 13, color: SLColors.textMuted },
  unitTextActive: { color: SLColors.accentMuted, fontWeight: '700' },
  sessions: { borderTopWidth: 1, borderColor: SLColors.borderStandard },
  session: { borderBottomWidth: 1, borderColor: SLColors.borderStandard },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 100, paddingVertical: 20 },
  sessionDate: { alignItems: 'center', width: 40 },
  sessionDay: { color: SLColors.accentMuted, fontSize: 11, letterSpacing: 1.2, fontWeight: '600' },
  sessionNumber: { color: SLColors.textStrong, fontSize: 29, lineHeight: 35, fontWeight: '600', marginTop: 1 },
  sessionCopy: { flex: 1, minWidth: 0 },
  sessionTitle: { color: SLColors.textStrong, fontSize: 19, lineHeight: 25, fontWeight: '600' },
  sessionMeta: { color: SLColors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 5 },
  sessionBody: { marginLeft: 56, paddingBottom: 22 },
  movement: { paddingTop: 15, paddingBottom: 17, borderTopWidth: 1, borderColor: SLColors.borderSubtle },
  movementName: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: SLColors.textPrimary, marginBottom: 7 },
  equipment: { color: SLColors.accentMuted, fontSize: 12, lineHeight: 17, marginBottom: 6 },
  setLine: { color: SLColors.textSecondary, fontSize: 14, lineHeight: 23 },
  comparison: { marginTop: 8, gap: 3 },
  comparisonLabel: { color: SLColors.textMuted, fontSize: 12, lineHeight: 18 },
  improved: { color: SLColors.success },
  previous: { color: SLColors.textMuted, fontSize: 12, lineHeight: 18 },
  note: { marginTop: 14 },
  noteLabel: { color: SLColors.accentMuted, fontSize: 9, letterSpacing: 1.1, fontWeight: '600' },
  noteText: { color: SLColors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 7 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 22, paddingTop: 14, backgroundColor: SLColors.background, borderTopWidth: 1, borderColor: SLColors.borderSubtle },
  share: { borderRadius: 16, overflow: 'hidden' },
  shareFill: { minHeight: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  shareText: { color: 'white', fontSize: 18, fontWeight: '700' },
  status: { alignItems: 'center', paddingVertical: 48, gap: 16 },
  muted: { color: SLColors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  emptyTitle: { color: SLColors.textStrong, fontSize: 22, fontWeight: '600' },
  error: { color: SLColors.danger, textAlign: 'center', fontSize: 13, marginBottom: 8 },
  retry: { minHeight: 44, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: SLColors.surfaceRaised },
  retryText: { color: SLColors.accentMuted, fontSize: 15 },
  disabled: { opacity: 0.3 }, pressed: { opacity: 0.8 },
});
