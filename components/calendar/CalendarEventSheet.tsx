import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import type { AthleteCalendarPersonalEvent } from '@/components/calendar/AthleteCalendarExperience';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
import {
  CALENDAR_ALERT_OPTIONS,
  CALENDAR_REPEAT_OPTIONS,
  calendarAlertLabel,
  calendarEventDraftFrom,
  calendarRepeatLabel,
  createSingleSubmitGate,
  eventMutationFromDraft,
  type CalendarEventDraft,
  type CalendarEventInitialValues,
  type CalendarEventMutation,
  type CalendarRepeatRule,
} from '@/lib/calendar-event-form';

export type { CalendarEventInitialValues, CalendarEventMutation } from '@/lib/calendar-event-form';

export function CalendarEventSheet({
  visible,
  initialDate,
  event,
  busy = false,
  serverErrors,
  onClose,
  onSave,
  onDelete,
  initialValues,
  saveError,
  timezone,
}: {
  visible: boolean;
  initialDate: string;
  event?: AthleteCalendarPersonalEvent | null;
  busy?: boolean;
  serverErrors?: Record<string, string> | null;
  onClose: () => void;
  onSave: (payload: CalendarEventMutation) => void;
  onDelete?: () => void;
  initialValues?: CalendarEventInitialValues;
  saveError?: string | null;
  timezone?: string | null;
}) {
  const [draft, setDraft] = useState<CalendarEventDraft>(() => calendarEventDraftFrom(event, initialDate, initialValues));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<'repeat' | 'alert' | null>(null);
  const submitGateRef = useRef(createSingleSubmitGate());

  useEffect(() => {
    if (visible) {
      setDraft(calendarEventDraftFrom(event, initialDate, initialValues));
      setLocalErrors({});
      setPicker(null);
    }
  }, [event, initialDate, initialValues, visible]);

  useEffect(() => {
    if (!busy) submitGateRef.current.release();
  }, [busy]);

  const errors = useMemo(() => ({ ...localErrors, ...(serverErrors || {}) }), [localErrors, serverErrors]);
  const update = <K extends keyof CalendarEventDraft>(key: K, value: CalendarEventDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = () => {
    if (busy || submitGateRef.current.isLocked()) return;
    const result = eventMutationFromDraft(draft, timezone);
    if ('errors' in result) {
      setLocalErrors(result.errors);
      return;
    }
    if (!submitGateRef.current.tryLock()) return;
    setLocalErrors({});
    onSave(result.payload);
  };
  const confirmDelete = () => Alert.alert(
    'Delete event?',
    'This removes the event from your Calendar.',
    [{ text: 'Keep Event', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onDelete }],
  );

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable accessibilityLabel="Close event editor" disabled={busy} onPress={onClose} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
              <Ionicons color={SLColors.textStrong} name="close" size={32} />
            </Pressable>
            <Text style={styles.title}>{event ? 'Edit Event' : 'New Event'}</Text>
            <Pressable accessibilityLabel={event ? 'Save event' : 'Add event'} disabled={busy} onPress={submit} style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed, busy && styles.disabled]}>
              <Ionicons color={SLColors.textStrong} name="checkmark" size={34} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" style={styles.scroll}>
            <View style={styles.group}>
              <Field error={errors.title} onChangeText={(value) => update('title', value)} placeholder="Title" value={draft.title} />
              <View style={styles.divider} />
              <Field onChangeText={(value) => update('location', value)} placeholder="Location or Video Call" value={draft.location} />
            </View>
            <View style={styles.group}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>All-day</Text>
                <Switch onValueChange={(value) => update('allDay', value)} trackColor={{ false: SLColors.borderStrong, true: SLColors.accentViolet }} value={draft.allDay} />
              </View>
              <View style={styles.divider} />
              <DateRow
                date={draft.startDate}
                error={errors.starts_at}
                label="Starts"
                onDate={(value) => update('startDate', value)}
                onTime={(value) => update('startTime', value)}
                showTime={!draft.allDay}
                time={draft.startTime}
              />
              <View style={styles.divider} />
              <DateRow
                date={draft.endDate}
                error={errors.ends_at}
                label="Ends"
                onDate={(value) => update('endDate', value)}
                onTime={(value) => update('endTime', value)}
                showTime={!draft.allDay}
                time={draft.endTime}
              />
            </View>
            <View style={styles.group}>
              <ChoiceRow label="Repeat" onPress={() => setPicker('repeat')} value={calendarRepeatLabel(draft.repeatRule)} />
            </View>
            <View style={styles.group}>
              <ChoiceRow label="Alert" onPress={() => setPicker('alert')} value={calendarAlertLabel(draft.alertOffsetMinutes)} />
            </View>
            <View style={styles.group}><Field multiline onChangeText={(value) => update('notes', value)} placeholder="Notes" value={draft.notes} /></View>
            {errors.timezone ? <Text style={styles.error}>{errors.timezone}</Text> : null}
            {errors.repeat_rule ? <Text style={styles.error}>{errors.repeat_rule}</Text> : null}
            {errors.alert_offset_minutes ? <Text style={styles.error}>{errors.alert_offset_minutes}</Text> : null}
            {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
            {busy ? <Text style={styles.saving}>Saving…</Text> : null}
            {event && onDelete ? <Pressable disabled={busy} onPress={confirmDelete} style={({ pressed }) => [styles.delete, pressed && styles.pressed]}><Text style={styles.deleteText}>Delete Event</Text></Pressable> : null}
          </ScrollView>
        </View>
        <RepeatPickerSheet
          onClose={() => setPicker(null)}
          onSelect={(value) => {
            update('repeatRule', value);
            setPicker(null);
          }}
          value={draft.repeatRule}
          visible={picker === 'repeat'}
        />
        <AlertPickerSheet
          onClose={() => setPicker(null)}
          onSelect={(value) => {
            update('alertOffsetMinutes', value);
            setPicker(null);
          }}
          value={draft.alertOffsetMinutes}
          visible={picker === 'alert'}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ value, placeholder, error, multiline, onChangeText }: { value: string; placeholder: string; error?: string; multiline?: boolean; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <TextInput
        autoCapitalize="sentences"
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={SLColors.textSubtle}
        style={[styles.input, multiline && styles.multiline, error && styles.inputError]}
        value={value}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function DateRow({ label, date, time, showTime, error, onDate, onTime }: {
  label: string; date: string; time: string; showTime: boolean; error?: string;
  onDate: (value: string) => void; onTime: (value: string) => void;
}) {
  const [androidPickerMode, setAndroidPickerMode] = useState<'date' | 'time' | null>(null);
  const value = dateTimePickerValue(date, time);
  const updateDate = (selected?: Date) => {
    if (selected) onDate(localDateValue(selected));
  };
  const updateTime = (selected?: Date) => {
    if (selected) onTime(localTimeValue(selected));
  };

  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.dateValues}>
          {Platform.OS === 'ios' ? (
            <>
              <DateTimePicker
                accessibilityLabel={`Select ${label.toLowerCase()} date`}
                display="compact"
                mode="date"
                onChange={(_, selected) => updateDate(selected)}
                style={styles.nativeDateSelector}
                themeVariant="dark"
                value={value}
              />
              {showTime ? (
                <DateTimePicker
                  accessibilityLabel={`Select ${label.toLowerCase()} time`}
                  display="compact"
                  mode="time"
                  onChange={(_, selected) => updateTime(selected)}
                  style={styles.nativeTimeSelector}
                  themeVariant="dark"
                  value={value}
                />
              ) : null}
            </>
          ) : (
            <>
              <Pressable
                accessibilityLabel={`Select ${label.toLowerCase()} date`}
                accessibilityRole="button"
                onPress={() => setAndroidPickerMode('date')}
                style={({ pressed }) => [styles.dateSelector, error && styles.inputError, pressed && styles.pressed]}
              >
                <Text style={styles.dateSelectorText}>{localizedDateLabel(value)}</Text>
              </Pressable>
              {showTime ? (
                <Pressable
                  accessibilityLabel={`Select ${label.toLowerCase()} time`}
                  accessibilityRole="button"
                  onPress={() => setAndroidPickerMode('time')}
                  style={({ pressed }) => [styles.dateSelector, pressed && styles.pressed]}
                >
                  <Text style={styles.dateSelectorText}>{localizedTimeLabel(value)}</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
      {Platform.OS === 'android' && androidPickerMode ? (
        <DateTimePicker
          display="default"
          mode={androidPickerMode}
          onChange={(event, selected) => {
            const mode = androidPickerMode;
            setAndroidPickerMode(null);
            if ((event as any)?.type !== 'set') return;
            if (mode === 'date') updateDate(selected);
            else updateTime(selected);
          }}
          value={value}
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function dateTimePickerValue(date: string, time: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  const fallback = new Date();
  if (!dateMatch) return fallback;
  const value = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    timeMatch ? Number(timeMatch[1]) : 9,
    timeMatch ? Number(timeMatch[2]) : 0,
  );
  return Number.isNaN(value.getTime()) ? fallback : value;
}

function localDateValue(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function localTimeValue(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function localizedDateLabel(value: Date) {
  return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function localizedTimeLabel(value: Date) {
  return value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function ChoiceRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.inlineValue}>
        <Text style={styles.rowValue}>{value}</Text>
        <Ionicons color={SLColors.textMuted} name="chevron-forward" size={20} />
      </View>
    </Pressable>
  );
}

function RepeatPickerSheet({
  onClose,
  onSelect,
  value,
  visible,
}: {
  onClose: () => void;
  onSelect: (value: CalendarRepeatRule) => void;
  value: CalendarRepeatRule;
  visible: boolean;
}) {
  return (
    <ChoicePickerShell onClose={onClose} title="Repeat" visible={visible}>
      {CALENDAR_REPEAT_OPTIONS.map((option) => (
        <PickerOption
          active={value === option.value}
          key={option.value}
          label={option.label}
          onPress={() => onSelect(option.value)}
        />
      ))}
    </ChoicePickerShell>
  );
}

function AlertPickerSheet({
  onClose,
  onSelect,
  value,
  visible,
}: {
  onClose: () => void;
  onSelect: (value: number | null) => void;
  value: number | null;
  visible: boolean;
}) {
  const isPreset = CALENDAR_ALERT_OPTIONS.some((option) => option.value === value);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('120');
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCustomOpen(!isPreset && value !== null);
    setCustomMinutes(String(!isPreset && value !== null ? value : 120));
    setCustomError(null);
  }, [isPreset, value, visible]);

  const applyCustom = () => {
    const minutes = Number(customMinutes.trim());
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 525600) {
      setCustomError('Enter whole minutes from 1 to 525600.');
      return;
    }
    onSelect(minutes);
  };

  return (
    <ChoicePickerShell onClose={onClose} title="Alert" visible={visible}>
      {CALENDAR_ALERT_OPTIONS.map((option) => (
        <PickerOption
          active={value === option.value && !customOpen}
          key={String(option.value)}
          label={option.label}
          onPress={() => onSelect(option.value)}
        />
      ))}
      <PickerOption
        active={customOpen}
        label="Custom"
        onPress={() => {
          setCustomOpen(true);
          setCustomError(null);
        }}
      />
      {customOpen ? (
        <View style={styles.customAlert}>
          <Text style={styles.customAlertLabel}>Minutes before event</Text>
          <TextInput
            accessibilityLabel="Custom alert minutes"
            keyboardType="number-pad"
            onChangeText={setCustomMinutes}
            placeholder="120"
            placeholderTextColor={SLColors.textMuted}
            style={[styles.customAlertInput, customError && styles.inputError]}
            value={customMinutes}
          />
          {customError ? <Text style={styles.error}>{customError}</Text> : null}
          <Pressable accessibilityRole="button" onPress={applyCustom} style={styles.customAlertButton}>
            <Text style={styles.customAlertButtonText}>Use Custom Alert</Text>
          </Pressable>
        </View>
      ) : null}
    </ChoicePickerShell>
  );
}

function ChoicePickerShell({
  children,
  onClose,
  title,
  visible,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <View style={styles.pickerRoot}>
        <View style={styles.pickerHeader}>
          <Pressable accessibilityLabel={`Close ${title} picker`} onPress={onClose} style={styles.pickerClose}>
            <Text style={styles.pickerCloseText}>Cancel</Text>
          </Pressable>
          <Text style={styles.pickerTitle}>{title}</Text>
          <View style={styles.pickerHeaderSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.pickerContent}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

function PickerOption({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={onPress} style={({ pressed }) => [styles.pickerOption, pressed && styles.pressed]}>
      <Text style={styles.pickerOptionText}>{label}</Text>
      {active ? <Ionicons color={SLColors.accentMagenta} name="checkmark" size={24} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: SLColors.canvas },
  sheet: { flex: 1, width: '100%', backgroundColor: SLColors.canvas },
  header: { minHeight: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  roundButton: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: SLColors.borderStrong, backgroundColor: SLColors.object },
  confirmButton: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.accentMagenta, borderWidth: 1, borderColor: SLColors.accentViolet },
  title: { ...SLTypography.screenTitle, color: SLColors.textStrong, textAlign: 'center' },
  scroll: { width: '100%' },
  form: { padding: 20, paddingBottom: 42, gap: 20 },
  group: { borderRadius: SLRadius.lg, backgroundColor: SLColors.object, paddingHorizontal: 20, overflow: 'hidden' },
  field: { width: '100%' },
  input: { minHeight: 58, color: SLColors.textStrong, fontSize: 18 },
  multiline: { minHeight: 84, paddingTop: 18, textAlignVertical: 'top' },
  inputError: { borderColor: SLColors.danger },
  error: { ...SLTypography.caption, color: SLColors.danger },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 18, color: SLColors.textStrong },
  rowValue: { fontSize: 17, color: SLColors.textMuted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: SLColors.borderStrong },
  dateValues: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  nativeDateSelector: { minWidth: 126 },
  nativeTimeSelector: { minWidth: 90 },
  dateSelector: { minHeight: 40, minWidth: 96, maxWidth: 150, borderRadius: 18, backgroundColor: SLColors.surfacePressed, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  dateSelectorText: { fontSize: 16, color: SLColors.textStrong },
  inlineValue: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 7 },
  saving: { ...SLTypography.caption, color: SLColors.textMuted, textAlign: 'center' },
  saveError: { ...SLTypography.caption, color: SLColors.danger, borderRadius: SLRadius.md, borderWidth: 1, borderColor: `${SLColors.danger}70`, backgroundColor: SLColors.dangerSoft, paddingHorizontal: 14, paddingVertical: 11 },
  delete: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  deleteText: { ...SLTypography.buttonLabel, color: SLColors.danger },
  pickerRoot: { flex: 1, backgroundColor: SLColors.canvas },
  pickerHeader: { minHeight: 78, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderStandard },
  pickerClose: { minWidth: 72, minHeight: 48, justifyContent: 'center' },
  pickerCloseText: { ...SLTypography.buttonLabel, color: SLColors.accentViolet },
  pickerTitle: { ...SLTypography.sectionTitle, color: SLColors.textStrong },
  pickerHeaderSpacer: { width: 72 },
  pickerContent: { padding: 20, gap: 1 },
  pickerOption: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: SLColors.object, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderStandard },
  pickerOptionText: { ...SLTypography.rowTitle, color: SLColors.textStrong },
  customAlert: { marginTop: 18, borderRadius: SLRadius.lg, padding: 18, backgroundColor: SLColors.object, gap: 12 },
  customAlertLabel: { ...SLTypography.rowTitle, color: SLColors.textStrong },
  customAlertInput: { minHeight: 48, borderRadius: SLRadius.md, backgroundColor: SLColors.surfacePressed, color: SLColors.textStrong, fontSize: 17, paddingHorizontal: 14 },
  customAlertButton: { minHeight: 48, borderRadius: SLRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.accentMagenta },
  customAlertButtonText: { ...SLTypography.buttonLabel, color: SLColors.white },
  pressed: { opacity: 0.74 },
  disabled: { opacity: 0.48 },
});
