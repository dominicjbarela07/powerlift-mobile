import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import type { AthleteCalendarSession } from '@/components/calendar/AthleteCalendarExperience';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';

export type TrainingScheduleMutation = { start_time: string | null };

export function TrainingScheduleSheet({
  busy = false,
  error,
  fieldError,
  onClose,
  onOpenSession,
  onSave,
  session,
  visible,
}: {
  busy?: boolean;
  error?: string | null;
  fieldError?: string | null;
  onClose: () => void;
  onOpenSession: () => void;
  onSave: (payload: TrainingScheduleMutation) => void;
  session?: AthleteCalendarSession | null;
  visible: boolean;
}) {
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('17:30');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAllDay(!session?.scheduledStartTime);
    setStartTime(session?.scheduledStartTime || '17:30');
    setLocalError(null);
  }, [session, visible]);

  const submit = () => {
    if (allDay) {
      setLocalError(null);
      onSave({ start_time: null });
      return;
    }
    if (!validClock(startTime)) {
      setLocalError('Use a valid 24-hour time (HH:MM).');
      return;
    }
    setLocalError(null);
    onSave({ start_time: startTime });
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Cancel scheduling" disabled={busy} onPress={onClose} style={styles.roundButton}>
            <Ionicons color={SLColors.textStrong} name="close" size={28} />
          </Pressable>
          <Text style={styles.headerTitle}>Schedule Training</Text>
          <Pressable accessibilityLabel="Save training time" disabled={busy} onPress={submit} style={[styles.saveButton, busy && styles.disabled]}>
            <Text style={styles.saveText}>{busy ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.sessionCard}>
            <Text style={styles.kicker}>Training session</Text>
            <Text style={styles.sessionTitle}>{session?.title || 'Training Session'}</Text>
            <Text style={styles.meta}>{formatDate(session?.date)}</Text>
            <Text style={styles.meta}>
              {session?.blockName ? `${session.blockName} · ` : ''}
              {session?.estimatedDurationMinutes
                ? `About ${session.estimatedDurationMinutes} min`
                : 'Duration estimate unavailable'}
            </Text>
          </View>

          <View style={styles.options}>
            <OptionRow
              active={allDay}
              detail="Keep the prescribed training date without inventing a start time."
              label="Leave as all-day"
              onPress={() => setAllDay(true)}
            />
            <View style={styles.divider} />
            <OptionRow
              active={!allDay}
              detail="Place the session in the hourly Calendar."
              label="Start time"
              onPress={() => setAllDay(false)}
            />
            {!allDay ? (
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>Starts</Text>
                <TextInput
                  accessibilityLabel="Training start time"
                  autoCapitalize="none"
                  editable={!busy}
                  keyboardType="numbers-and-punctuation"
                  onChangeText={setStartTime}
                  placeholder="17:30"
                  placeholderTextColor={SLColors.textMuted}
                  style={[styles.timeInput, (localError || fieldError) && styles.inputError]}
                  value={startTime}
                />
              </View>
            ) : null}
          </View>

          {localError || fieldError || error ? (
            <Text style={styles.error}>{localError || fieldError || error}</Text>
          ) : null}

          <Pressable accessibilityRole="button" onPress={onOpenSession} style={styles.openButton}>
            <Ionicons color={SLColors.accentViolet} name="barbell-outline" size={21} />
            <Text style={styles.openText}>Open / View Session</Text>
            <Ionicons color={SLColors.textMuted} name="chevron-forward" size={19} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function OptionRow({ active, detail, label, onPress }: { active: boolean; detail: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={onPress} style={styles.optionRow}>
      <Ionicons color={active ? SLColors.accentMagenta : SLColors.textMuted} name={active ? 'radio-button-on' : 'radio-button-off'} size={23} />
      <View style={styles.flex}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionDetail}>{detail}</Text>
      </View>
    </Pressable>
  );
}

function validClock(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
}

function formatDate(value?: string | null) {
  if (!value) return 'Scheduled date unavailable';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SLColors.canvas },
  header: { minHeight: 86, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderStandard },
  roundButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.object, borderWidth: 1, borderColor: SLColors.borderStrong },
  headerTitle: { ...SLTypography.sectionTitle, color: SLColors.textStrong },
  saveButton: { minWidth: 64, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.accentMagenta },
  saveText: { ...SLTypography.buttonLabel, color: SLColors.white },
  content: { padding: 20, gap: 18 },
  sessionCard: { borderRadius: SLRadius.lg, backgroundColor: SLColors.object, borderWidth: 1, borderColor: SLColors.borderStandard, padding: 18 },
  kicker: { ...SLTypography.label, color: SLColors.accentViolet, marginBottom: 6 },
  sessionTitle: { ...SLTypography.screenTitle, color: SLColors.textStrong, marginBottom: 9 },
  meta: { ...SLTypography.note, color: SLColors.textMuted, marginTop: 3 },
  options: { borderRadius: SLRadius.lg, backgroundColor: SLColors.object, overflow: 'hidden', paddingHorizontal: 16 },
  optionRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionLabel: { ...SLTypography.rowTitle, color: SLColors.textStrong },
  optionDetail: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: SLColors.borderStandard },
  timeRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  timeLabel: { ...SLTypography.rowTitle, color: SLColors.textStrong },
  timeInput: { minWidth: 108, borderRadius: 18, backgroundColor: SLColors.surfacePressed, color: SLColors.textStrong, paddingHorizontal: 14, paddingVertical: 10, fontSize: 17, textAlign: 'center' },
  inputError: { borderWidth: 1, borderColor: SLColors.danger },
  error: { ...SLTypography.note, color: SLColors.danger },
  openButton: { minHeight: 58, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderStrong, backgroundColor: SLColors.object, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  openText: { ...SLTypography.buttonLabel, color: SLColors.textStrong, flex: 1 },
  flex: { flex: 1 },
  disabled: { opacity: 0.5 },
});
