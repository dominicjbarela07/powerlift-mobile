import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { SLButton } from '@/components/ui/sl-button';
import { SLProfileAvatar } from '@/components/ui/sl-profile-avatar';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLMaterialOverlay } from '@/components/ui/sl-workspace';
import { SLColors, SLFontFamilies, SLRadius, SLShadows, SLSpacing } from '@/constants/theme';
import { fetchJson } from '@/lib/api';

type RosterAthlete = {
  id: number;
  name: string;
  is_self?: boolean;
  avatar_url?: string | null;
  avatar_uploaded_at?: string | null;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 12);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function today() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function dateFromYmd(value: string) {
  if (!validDate(value)) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function ymdFromDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export default function AdaptiveSessionBootstrapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    editWorkoutId?: string | string[];
    athleteId?: string | string[];
    athleteName?: string | string[];
    date?: string | string[];
    templateId?: string | string[];
    programmingBlockId?: string | string[];
    programmingWeek?: string | string[];
    programmingDay?: string | string[];
  }>();
  const editSessionId = firstParam(params.editWorkoutId);
  const requestedAthleteId = firstParam(params.athleteId);
  const requestedAthleteName = firstParam(params.athleteName);
  const requestedDate = firstParam(params.date);
  const requestedTemplateId = firstParam(params.templateId);
  const programmingBlockId = firstParam(params.programmingBlockId);
  const programmingWeek = firstParam(params.programmingWeek);
  const programmingDay = firstParam(params.programmingDay);

  const [roster, setRoster] = useState<RosterAthlete[]>([]);
  const [athleteId, setAthleteId] = useState(requestedAthleteId);
  const [sessionDate, setSessionDate] = useState(validDate(requestedDate) ? requestedDate : today());
  const [title, setTitle] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(!editSessionId);
  const [saving, setSaving] = useState(false);
  const [createdDraftId, setCreatedDraftId] = useState('');
  const [error, setError] = useState('');
  const redirectedRef = useRef(false);
  const submissionRef = useRef(false);

  useEffect(() => {
    if (!editSessionId || redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace({
      pathname: '/workout/session-workspace/[workoutId]' as any,
      params: {
        workoutId: editSessionId,
        ...(requestedAthleteId ? { athleteId: requestedAthleteId } : {}),
        ...(programmingBlockId ? { programmingBlockId } : {}),
        ...(programmingWeek ? { programmingWeek } : {}),
        ...(programmingDay ? { programmingDay } : {}),
      },
    });
  }, [editSessionId, programmingBlockId, programmingDay, programmingWeek, requestedAthleteId, router]);

  useEffect(() => {
    if (editSessionId) return;
    let active = true;
    setLoadingRoster(true);
    fetchJson<any>('/coach/mobile/roster', { method: 'GET' })
      .then((response) => {
        const json = response.json || {};
        if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
        if (!active) return;
        const athletes = Array.isArray(json.athletes) ? json.athletes : [];
        setRoster(athletes);
        setAthleteId((current) => {
          if (current) return current;
          const requested = athletes.find((row: RosterAthlete) => requestedAthleteName && row.name === requestedAthleteName);
          const fallback = requested || athletes.find((row: RosterAthlete) => row.is_self) || (athletes.length === 1 ? athletes[0] : null);
          return fallback?.id ? String(fallback.id) : current;
        });
      })
      .catch((reason) => {
        if (active) setError(reason?.message || 'Athletes could not be loaded.');
      })
      .finally(() => {
        if (active) setLoadingRoster(false);
      });
    return () => {
      active = false;
    };
  }, [editSessionId, requestedAthleteName]);

  const selectedAthlete = useMemo(
    () => roster.find((athlete) => String(athlete.id) === athleteId) || null,
    [athleteId, roster],
  );

  const createDraft = async () => {
    if (submissionRef.current || saving) return;
    if (!athleteId) {
      setError('Choose an athlete before creating the Session.');
      return;
    }
    if (!validDate(sessionDate)) {
      setError('Choose a valid Session date.');
      return;
    }
    submissionRef.current = true;
    setSaving(true);
    setError('');
    try {
      let sessionId = createdDraftId;
      if (!sessionId) {
        const response = await fetchJson<any>('/workouts/mobile/new', {
          method: 'POST',
          body: {
            athlete_id: Number(athleteId),
            date: sessionDate,
            label: title.trim() || null,
            status: 'draft',
            training_block_id: programmingBlockId ? Number(programmingBlockId) : null,
            core_items: [],
            acc_items: [],
          } as any,
        });
        const json = response.json || {};
        if (!response.ok || !json.ok || !json.workout_id) throw new Error(json.error || `HTTP ${response.status}`);
        sessionId = String(json.workout_id);
        setCreatedDraftId(sessionId);
      }

      if (requestedTemplateId) {
        const templateResponse = await fetchJson<any>(`/workouts/mobile/${sessionId}/apply-template`, {
          method: 'POST',
          body: { template_id: requestedTemplateId, confirm_replace: true } as any,
        });
        const templateJson = templateResponse.json || {};
        if (!templateResponse.ok || !templateJson.ok) throw new Error(templateJson.error || 'The Session draft was created, but its template could not be loaded.');
      }

      router.replace({
        pathname: '/workout/session-workspace/[workoutId]' as any,
        params: {
          workoutId: sessionId,
          athleteId,
          ...(programmingBlockId ? { programmingBlockId } : {}),
          ...(programmingWeek ? { programmingWeek } : {}),
          ...(programmingDay ? { programmingDay } : {}),
        },
      });
    } catch (reason: any) {
      submissionRef.current = false;
      setError(reason?.message || 'The Session draft could not be created.');
      setSaving(false);
    }
  };

  if (editSessionId) {
    return <View style={styles.loadingState}><ActivityIndicator color={SLColors.accentViolet} /><Text style={styles.loadingText}>Opening Session Workspace</Text></View>;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close Create Session" hitSlop={8} onPress={() => router.back()} style={styles.closeButton}><Ionicons name="close" size={20} color={SLColors.textStrong} /></Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>Training Session</Text><Text style={styles.title}>Create Session</Text><Text style={styles.subtitle}>Start a server-backed draft, then program it in the Session Workspace.</Text></View>
        </View>

        <View style={styles.card}>
          <SLMaterialOverlay accent={SLColors.illuminationAccent} compact level={2} />
          <Text style={styles.sectionTitle}>Required setup</Text>
          <Text style={styles.fieldLabel}>Athlete</Text>
          {loadingRoster ? <ActivityIndicator color={SLColors.accentViolet} style={styles.loader} /> : (
            <View style={styles.athleteList}>
              {roster.map((athlete) => {
                const selected = String(athlete.id) === athleteId;
                return (
                  <Pressable key={athlete.id} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: !!createdDraftId }} disabled={!!createdDraftId} onPress={() => setAthleteId(String(athlete.id))} style={[styles.athleteRow, selected && styles.athleteRowSelected]}>
                    <SLProfileAvatar name={athlete.name} profilePhotoUrl={athlete.avatar_url} profilePhotoVersion={athlete.avatar_uploaded_at} size={34} />
                    <Text numberOfLines={1} style={styles.athleteName}>{athlete.name}</Text>
                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={selected ? SLColors.accentViolet : SLColors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.fieldLabel}>Session date</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Session date ${sessionDate}`} disabled={!!createdDraftId} onPress={() => setShowDatePicker(true)} style={styles.fieldButton}><Ionicons name="calendar-clear-outline" size={17} color={SLColors.accentViolet} /><Text style={styles.fieldButtonText}>{dateFromYmd(sessionDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Text></Pressable>
          {showDatePicker ? <DateTimePicker value={dateFromYmd(sessionDate)} mode="date" onChange={(_event, value) => { setShowDatePicker(Platform.OS === 'ios'); if (value) setSessionDate(ymdFromDate(value)); }} /> : null}

          <Text style={styles.fieldLabel}>Session title (optional)</Text>
          <TextInput accessibilityLabel="Session title" editable={!createdDraftId} maxLength={50} onChangeText={setTitle} placeholder="Untitled Session" placeholderTextColor={SLColors.textSubtle} style={styles.input} value={title} />
        </View>

        {error ? <View accessibilityRole="alert" style={styles.error}><Ionicons name="alert-circle-outline" size={18} color={SLColors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
        <SLButton fullWidth iconLeft="arrow-forward" label={saving ? (createdDraftId ? 'Loading Template' : 'Creating Draft') : (createdDraftId ? 'Retry Template' : 'Create Draft')} loading={saving} disabled={saving || loadingRoster || !athleteId} onPress={() => { void createDraft(); }} size="lg" variant="primary" />
        {selectedAthlete ? <Text style={styles.footerText}>The draft will be created for {selectedAthlete.name} and opened immediately in the Session Workspace.</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SLColors.canvas },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SLSpacing.md, backgroundColor: SLColors.canvas },
  loadingText: { color: SLColors.textMuted, fontFamily: SLFontFamilies.technical, fontSize: 12 },
  content: { paddingTop: SLSpacing.sm, paddingBottom: 120, gap: SLSpacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.lg },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  headerCopy: { flex: 1, minWidth: 0, gap: SLSpacing.xs },
  eyebrow: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.technical, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7 },
  title: { color: SLColors.textStrong, fontFamily: SLFontFamilies.display, fontSize: 25, lineHeight: 30 },
  subtitle: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 18 },
  card: { position: 'relative', overflow: 'hidden', gap: SLSpacing.sm, padding: SLSpacing.lg, borderRadius: SLRadius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceInset, ...SLShadows.level2 },
  sectionTitle: { color: SLColors.textStrong, fontFamily: SLFontFamilies.display, fontSize: 18 },
  fieldLabel: { marginTop: SLSpacing.xs, color: SLColors.textMuted, fontFamily: SLFontFamilies.technical, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  loader: { minHeight: 52 },
  athleteList: { gap: SLSpacing.xs },
  athleteRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.sm, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle, backgroundColor: SLColors.surfaceFlat },
  athleteRowSelected: { borderColor: SLColors.borderSelected, backgroundColor: SLColors.accentSoft },
  athleteName: { flex: 1, color: SLColors.text, fontFamily: SLFontFamilies.body, fontSize: 13 },
  fieldButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.md, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  fieldButtonText: { flex: 1, color: SLColors.text, fontFamily: SLFontFamilies.body, fontSize: 13 },
  input: { minHeight: 48, color: SLColors.text, paddingHorizontal: SLSpacing.md, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat, fontFamily: SLFontFamilies.body, fontSize: 14 },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: SLSpacing.sm, padding: SLSpacing.md, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.danger, backgroundColor: SLColors.dangerSoft },
  errorText: { flex: 1, color: SLColors.danger, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 18 },
  footerText: { color: SLColors.textMuted, textAlign: 'center', fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 16 },
});
