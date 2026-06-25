import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { createIndividualProgram, getIndividualProgram, updateIndividualProgram } from '@/lib/api';
import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';

type ProgramTypeKey = 'offseason' | 'meet_prep' | 'general_strength' | 'custom';
type TimelineKey = '4' | '8' | '12' | '16' | 'custom';
type TimelineDateTarget = 'start' | 'meet' | null;
type ProgramBlock = { id?: number | null; name: string; weeks: number; focus: string };

type ProgramTypeOption = {
  key: ProgramTypeKey;
  label: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const programTypeOptions: ProgramTypeOption[] = [
  {
    key: 'offseason',
    label: 'Offseason',
    detail: 'Build capacity, improve movement quality, and create room for future strength work.',
    icon: 'layers-outline',
  },
  {
    key: 'meet_prep',
    label: 'Meet Prep',
    detail: 'Work backward from a meet date and organize training toward peak performance.',
    icon: 'trophy-outline',
  },
  {
    key: 'general_strength',
    label: 'General Strength',
    detail: 'Progress the main lifts with structured training blocks and repeatable sessions.',
    icon: 'barbell-outline',
  },
  {
    key: 'custom',
    label: 'Custom',
    detail: 'Start from a blank structure and shape the program manually.',
    icon: 'options-outline',
  },
];

const timelineOptions: Array<{ key: TimelineKey; label: string; detail: string }> = [
  { key: '4', label: '4 weeks', detail: 'Short reset or return-to-training block.' },
  { key: '8', label: '8 weeks', detail: 'Enough runway to build momentum.' },
  { key: '12', label: '12 weeks', detail: 'Classic strength block structure.' },
  { key: '16', label: '16 weeks', detail: 'Longer arc with more room to progress.' },
  { key: 'custom', label: 'Custom Length', detail: 'Enter any number of weeks.' },
];

const steps = ['Type', 'Timeline', 'Blocks', 'Review'];
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const colors = {
  text: '#ECE5DA',
  textStrong: SLColors.textStrong,
  muted: '#B8ACA1',
  subtle: '#82766D',
  line: 'rgba(222, 198, 166, 0.10)',
  lineSoft: 'rgba(222, 198, 166, 0.058)',
  surface: 'rgba(20, 14, 13, 0.32)',
  surfaceStrong: 'rgba(24, 16, 15, 0.50)',
  violet: SLColors.accentViolet,
  green: '#A7CBB5',
  amber: '#D6A75E',
};

const coerceProgramDate = (value?: string | null) => {
  const raw = String(value || '').trim();
  const [year, month, day] = raw.split('-').map((part) => Number(part));
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

const programDateOnly = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const countProgramWeeks = (start?: string | null, end?: string | null) => {
  const startDate = coerceProgramDate(start);
  const endDate = coerceProgramDate(end);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((programDateOnly(endDate).getTime() - programDateOnly(startDate).getTime()) / dayMs) + 1;
  return Math.max(1, Math.round(diffDays / 7));
};

const timelineStateForLength = (weeks: number): { timeline: TimelineKey; customLength: string } => {
  const normalized = Math.max(1, Math.trunc(Number(weeks) || 1));
  const label = String(normalized);
  if (label === '4' || label === '8' || label === '12' || label === '16') {
    return { timeline: label, customLength: label };
  }
  return { timeline: 'custom', customLength: label };
};

const hydrateLoadedProgramBlocks = (rows: any[]): ProgramBlock[] => {
  const sorted = [...(rows || [])].sort((a, b) => Number(a.order_idx || 0) - Number(b.order_idx || 0));
  if (!sorted.length) return buildBlockPlan('custom', 1);

  return sorted.map((block, index) => ({
    id: Number(block.id) || null,
    name: String(block.name || `Block ${index + 1}`),
    weeks: countProgramWeeks(block.start_date, block.end_date),
    focus: String(block.focus || 'Training focus'),
  }));
};

export default function CreateProgramScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; programId?: string }>();
  const { user } = useAuth();
  const isIndividual = user?.workspace_mode === 'individual' || !!user?.is_individual_workspace || !!user?.is_self_coached;
  const editProgramId = params.programId ? Number(params.programId) : null;
  const isEditMode = params.mode === 'edit' && Number.isFinite(editProgramId || NaN);
  const [stepIndex, setStepIndex] = useState(0);
  const [programType, setProgramType] = useState<ProgramTypeKey>('offseason');
  const [programName, setProgramName] = useState('Program Name');
  const [startDate, setStartDate] = useState(() => new Date());
  const [meetDate, setMeetDate] = useState(() => new Date());
  const [timeline, setTimeline] = useState<TimelineKey>('12');
  const [customLength, setCustomLength] = useState('12');
  const [blocks, setBlocks] = useState<ProgramBlock[]>(() => buildBlockPlan('offseason', 12));
  const [preserveLoadedBlocks, setPreserveLoadedBlocks] = useState(false);
  const [loadingProgram, setLoadingProgram] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedType = programTypeOptions.find((option) => option.key === programType) || programTypeOptions[0];
  const selectedTimeline = timelineOptions.find((option) => option.key === timeline) || timelineOptions[2];
  const customLengthValue = Number.parseInt(customLength, 10);
  const rawProgramLengthWeeks = timeline === 'custom'
    ? (Number.isFinite(customLengthValue) ? customLengthValue : 1)
    : Number(timeline);
  const programLengthWeeks = Math.max(1, Math.abs(Math.trunc(rawProgramLengthWeeks || 1)));
  const isLastStep = stepIndex === steps.length - 1;
  const canAdvance =
    !submitting &&
    (stepIndex !== 0 || (!!programType && programName.trim().length > 0)) &&
    (stepIndex !== 1 || timeline !== 'custom' || customLength.trim().length > 0);

  useEffect(() => {
    if (isEditMode && preserveLoadedBlocks) return;
    setBlocks(buildBlockPlan(programType, programLengthWeeks));
  }, [isEditMode, preserveLoadedBlocks, programType, programLengthWeeks]);

  useEffect(() => {
    if (!isEditMode || !editProgramId) return;

    let active = true;
    setLoadingProgram(true);
    getIndividualProgram(editProgramId)
      .then((result) => {
        if (!active) return;
        if (!result.ok || !result.program) {
          Alert.alert('Program not loaded', result.error || 'Program could not be loaded.');
          return;
        }

        const loadedProgram = result.program || {};
        const loadedBlocks = result.blocks || [];
        const loadedStartDate = coerceProgramDate(loadedProgram.start_date);
        const loadedEndDate = coerceProgramDate(loadedProgram.end_date);
        const lengthWeeks = countProgramWeeks(loadedProgram.start_date, loadedProgram.end_date);
        const timelineState = timelineStateForLength(lengthWeeks);

        setProgramName(String(loadedProgram.name || 'My Training Program'));
        setProgramType(backendProgramTypeToMobile(loadedProgram.program_type));
        setStartDate(loadedStartDate);
        setMeetDate(loadedProgram.meet_date ? coerceProgramDate(loadedProgram.meet_date) : loadedEndDate);
        setTimeline(timelineState.timeline);
        setCustomLength(timelineState.customLength);
        setBlocks(hydrateLoadedProgramBlocks(loadedBlocks));
        setPreserveLoadedBlocks(true);
      })
      .finally(() => {
        if (active) setLoadingProgram(false);
      });

    return () => {
      active = false;
    };
  }, [editProgramId, isEditMode]);

  const returnHome = () => {
    router.replace('/(tabs)/workout' as any);
  };

  const handleNext = async () => {
    if (!canAdvance) return;

    if (!isLastStep) {
      setStepIndex((current) => Math.min(current + 1, steps.length - 1));
      return;
    }

    const totalBlockWeeks = blocks.reduce((total, block) => total + Math.max(0, Number(block.weeks) || 0), 0);
    if (totalBlockWeeks !== programLengthWeeks) {
      Alert.alert('Check block weeks', `Your blocks need to add up to ${programLengthWeeks} weeks.`);
      return;
    }

    const endDate = addDays(startDate, programLengthWeeks * 7 - 1);
    setSubmitting(true);
    const payload = {
      name: programName.trim() || 'My Training Program',
      program_type: mobileProgramTypeToBackend(programType),
      start_date: toISODate(startDate),
      end_date: toISODate(endDate),
      meet_date: programType === 'meet_prep' ? toISODate(meetDate) : null,
      blocks: blocks.map((block, index) => ({
        id: block.id || null,
        name: (block.name || '').trim() || `Block ${index + 1}`,
        weeks: Math.max(1, Math.trunc(Number(block.weeks) || 1)),
        focus: block.focus,
      })),
    };
    const result = isEditMode && editProgramId
      ? await updateIndividualProgram(editProgramId, payload)
      : await createIndividualProgram(payload);
    setSubmitting(false);

    if (!result.ok) {
      Alert.alert(
        isEditMode ? 'Program not updated' : 'Program not created',
        result.error || 'Please check the program details and try again.'
      );
      return;
    }

    router.replace({
      pathname: '/(tabs)/workout',
      params: { programCreated: String(result.program?.id || Date.now()) },
    } as any);
  };

  if (!isIndividual) {
    return (
      <View style={styles.screen}>
        <View style={styles.blockedState}>
          <Ionicons name="lock-closed-outline" size={24} color={colors.muted} />
          <Text style={styles.blockedTitle}>Self-Coach flow only</Text>
          <Text style={styles.blockedBody}>This program builder mock is only available in Individual Mode.</Text>
          <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={returnHome}>
            <Text style={styles.secondaryButtonText}>Return to Training</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loadingProgram) {
    return (
      <View style={styles.screen}>
        <View style={styles.blockedState}>
          <ActivityIndicator size="small" color={colors.violet} />
          <Text style={styles.blockedTitle}>Loading program</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll}>
        <View style={styles.contentHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.flowTitle}>{isEditMode ? 'Edit Training Program' : 'Create Training Program'}</Text>
            <Text style={styles.programNamePreview} numberOfLines={1}>
              {programName.trim() || 'My Training Program'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isEditMode ? 'Exit edit program' : 'Exit create program'}
            onPress={returnHome}
            style={styles.exitButton}
          >
            <Ionicons name="arrow-back" size={15} color="#FCA5A5" />
            <Text style={styles.exitButtonText}>Exit</Text>
          </Pressable>
        </View>

        <View style={styles.stepTrack}>
          {steps.map((step, index) => {
            const active = index === stepIndex;
            const complete = index < stepIndex;
            return (
              <View key={step} style={styles.stepItem}>
                <View style={[styles.stepDot, active && styles.stepDotActive, complete && styles.stepDotComplete]}>
                  {complete ? <Ionicons name="checkmark" size={12} color={SLColors.textInverted} /> : null}
                </View>
                <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{step}</Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.panel, stepIndex === 0 && styles.formPanel]}>
          {stepIndex === 0 ? (
            <ProgramTypeStep
              programName={programName}
              programType={programType}
              onNameChange={setProgramName}
              onTypeChange={setProgramType}
            />
          ) : null}
          {stepIndex === 1 ? (
            <TimelineStep
              programType={programType}
              startDate={startDate}
              meetDate={meetDate}
              timeline={timeline}
              customLength={customLength}
              onStartDateChange={setStartDate}
              onMeetDateChange={setMeetDate}
              onTimelineChange={setTimeline}
              onCustomLengthChange={setCustomLength}
            />
          ) : null}
          {stepIndex === 2 ? (
            <BlocksStep blocks={blocks} totalWeeks={programLengthWeeks} onBlocksChange={setBlocks} />
          ) : null}
          {stepIndex === 3 ? (
            <ReviewStep
              programName={programName}
              selectedType={selectedType}
              selectedStart={formatProgramDate(startDate)}
              selectedEnd={formatProgramDate(addDays(startDate, programLengthWeeks * 7 - 1))}
              selectedMeet={programType === 'meet_prep' ? formatProgramDate(meetDate) : null}
              selectedTimeline={timeline === 'custom' ? `${customLength || programLengthWeeks} weeks` : selectedTimeline.label}
              blocks={blocks}
            />
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={stepIndex === 0}
          onPress={() => setStepIndex((current) => Math.max(current - 1, 0))}
          style={({ pressed }) => [
            styles.footerBackButton,
            stepIndex === 0 && styles.footerButtonDisabled,
            pressed && stepIndex > 0 && styles.pressed,
          ]}
        >
          <Ionicons name="arrow-back" size={16} color={stepIndex === 0 ? colors.subtle : colors.text} />
          <Text style={[styles.footerBackText, stepIndex === 0 && styles.footerButtonTextDisabled]}>Back</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={handleNext}
          disabled={!canAdvance}
          style={({ pressed }) => [
            styles.footerNextButton,
            !canAdvance && styles.footerButtonDisabled,
            pressed && canAdvance && styles.pressed,
          ]}
        >
          <Text style={[styles.footerNextText, !canAdvance && styles.footerButtonTextDisabled]}>
            {isLastStep ? (isEditMode ? 'Save Program' : 'Create Program') : 'Next'}
          </Text>
          {submitting && isLastStep ? (
            <ActivityIndicator size="small" color={SLColors.textInverted} />
          ) : (
            <Ionicons
              name={isLastStep ? 'checkmark' : 'arrow-forward'}
              size={16}
              color={canAdvance ? SLColors.textInverted : colors.subtle}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ProgramTypeStep({
  programName,
  programType,
  onNameChange,
  onTypeChange,
}: {
  programName: string;
  programType: ProgramTypeKey;
  onNameChange: (value: string) => void;
  onTypeChange: (value: ProgramTypeKey) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Program name</Text>
        <TextInput
          value={programName}
          onChangeText={onNameChange}
          placeholder="Program Name"
          placeholderTextColor={colors.subtle}
          style={styles.textInput}
        />
      </View>

      <View style={styles.programTypeHeader}>
        <Text style={styles.inputLabel}>Program Type</Text>
      </View>

      <View style={styles.optionList}>
        {programTypeOptions.map((option) => (
          <ProgramTypeRow
            key={option.key}
            option={option}
            selected={programType === option.key}
            onPress={() => onTypeChange(option.key)}
          />
        ))}
      </View>
    </View>
  );
}

function ProgramTypeRow({
  option,
  selected,
  onPress,
}: {
  option: ProgramTypeOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, selected && styles.optionRowSelected, pressed && styles.pressed]}
    >
      <View style={[styles.checkboxBox, selected && styles.checkboxBoxSelected]}>
        {selected ? <Ionicons name="checkmark" size={17} color={SLColors.textInverted} /> : null}
      </View>
      <View style={[styles.programTypeIcon, selected && styles.programTypeIconSelected]}>
        <Ionicons name={option.icon} size={18} color={selected ? colors.violet : colors.muted} />
      </View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{option.label}</Text>
        {selected ? <Text style={styles.optionExpandedDetail}>{option.detail}</Text> : null}
      </View>
    </Pressable>
  );
}

function ChoiceStep({
  eyebrow,
  title,
  body,
  options,
  selectedKey,
  onSelect,
}: {
  eyebrow: string;
  title: string;
  body: string;
  options: Array<{ key: string; label: string; detail: string }>;
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.stepCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.question}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <View style={styles.optionList}>
        {options.map((option) => {
          const selected = option.key === selectedKey;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(option.key)}
              style={({ pressed }) => [styles.choiceRow, selected && styles.optionRowSelected, pressed && styles.pressed]}
            >
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{option.label}</Text>
                <Text style={styles.optionDetail}>{option.detail}</Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={19} color={colors.violet} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TimelineStep({
  programType,
  startDate,
  meetDate,
  timeline,
  customLength,
  onStartDateChange,
  onMeetDateChange,
  onTimelineChange,
  onCustomLengthChange,
}: {
  programType: ProgramTypeKey;
  startDate: Date;
  meetDate: Date;
  timeline: TimelineKey;
  customLength: string;
  onStartDateChange: (value: Date) => void;
  onMeetDateChange: (value: Date) => void;
  onTimelineChange: (value: TimelineKey) => void;
  onCustomLengthChange: (value: string) => void;
}) {
  const [dateTarget, setDateTarget] = useState<TimelineDateTarget>(null);
  const isMeetPrep = programType === 'meet_prep';
  const pickerValue = dateTarget === 'meet' ? meetDate : startDate;
  const pickerLabel = dateTarget === 'meet' ? 'Meet Date' : 'Start Date';
  const setPickerValue = dateTarget === 'meet' ? onMeetDateChange : onStartDateChange;

  return (
    <View style={styles.stepContent}>
      <View style={styles.stepCopy}>
        <Text style={styles.eyebrow}>Timeline</Text>
        <Text style={styles.question}>{isMeetPrep ? 'Meet Date' : 'Start Date'}</Text>
      </View>

      {isMeetPrep ? (
        <DateField
          label="Meet Date"
          value={meetDate}
          onOpen={() => setDateTarget('meet')}
        />
      ) : null}

      <DateField
        label={isMeetPrep ? 'Program Start Date' : 'Start Date'}
        value={startDate}
        onOpen={() => setDateTarget('start')}
      />

      {dateTarget ? (
        <CalendarPanel
          label={pickerLabel}
          value={pickerValue}
          onSelect={setPickerValue}
          onDone={() => setDateTarget(null)}
        />
      ) : null}

      <View style={styles.stepCopy}>
        <Text style={styles.question}>Program Length</Text>
      </View>

      <View style={styles.optionList}>
        {timelineOptions.map((option) => {
          const selected = option.key === timeline;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onTimelineChange(option.key)}
              style={({ pressed }) => [styles.choiceRow, selected && styles.optionRowSelected, pressed && styles.pressed]}
            >
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{option.label}</Text>
                <Text style={styles.optionDetail}>{option.detail}</Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={19} color={colors.violet} /> : null}
            </Pressable>
          );
        })}
      </View>

      {timeline === 'custom' ? (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Program Length (weeks)</Text>
          <TextInput
            value={customLength}
            onChangeText={onCustomLengthChange}
            placeholder="12"
            placeholderTextColor={colors.subtle}
            keyboardType="number-pad"
            style={styles.textInput}
          />
        </View>
      ) : null}
    </View>
  );
}

function DateField({
  label,
  value,
  onOpen,
}: {
  label: string;
  value: Date;
  onOpen: () => void;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select ${label}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.dateField, pressed && styles.pressed]}
      >
        <Text style={styles.dateFieldText}>{formatProgramDate(value)}</Text>
        <Ionicons name="calendar-outline" size={17} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function CalendarPanel({
  label,
  value,
  onSelect,
  onDone,
}: {
  label: string;
  value: Date;
  onSelect: (value: Date) => void;
  onDone: () => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(value));
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);

  return (
    <View style={styles.calendarPanel}>
      <View style={styles.calendarTopRow}>
        <Text style={styles.calendarLabel}>{label}</Text>
        <Pressable accessibilityRole="button" onPress={onDone} style={styles.calendarDone}>
          <Text style={styles.calendarDoneText}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.calendarMonthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setVisibleMonth((current) => addMonths(current, -1))}
          style={styles.calendarArrow}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.calendarMonthTitle}>{formatMonthTitle(visibleMonth)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => setVisibleMonth((current) => addMonths(current, 1))}
          style={styles.calendarArrow}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textStrong} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {weekdays.map((day) => (
          <Text key={day} style={styles.weekdayLabel}>{day}</Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {days.map((day, index) => {
          const inMonth = sameMonth(day, visibleMonth);
          const selected = sameDate(day, value);
          const today = sameDate(day, new Date());
          return (
            <Pressable
              key={`${day.toISOString()}-${index}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(day)}
              style={({ pressed }) => [
                styles.calendarDay,
                !inMonth && styles.calendarDayOutside,
                today && styles.calendarDayToday,
                selected && styles.calendarDaySelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.calendarDayText,
                  !inMonth && styles.calendarDayTextOutside,
                  selected && styles.calendarDayTextSelected,
                ]}
              >
                {day.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BlocksStep({
  blocks,
  totalWeeks,
  onBlocksChange,
}: {
  blocks: ProgramBlock[];
  totalWeeks: number;
  onBlocksChange: (blocks: ProgramBlock[]) => void;
}) {
  const [expandedIndex, setExpandedIndex] = useState(0);
  const assignedWeeks = blocks.reduce((total, block) => total + Math.max(0, Number(block.weeks) || 0), 0);
  const assignmentComplete = assignedWeeks === totalWeeks;

  const updateBlock = (index: number, patch: Partial<ProgramBlock>) => {
    onBlocksChange(blocks.map((block, blockIndex) => (
      blockIndex === index ? { ...block, ...patch } : block
    )));
  };

  const setBlockWeeks = (index: number, nextWeeks: number) => {
    const current = blocks[index]?.weeks || 1;
    const next = Math.max(1, Math.trunc(nextWeeks || 1));
    const diff = next - current;
    if (diff === 0) return;

    const updated = blocks.map((block) => ({ ...block }));

    if (diff > 0) {
      let remaining = diff;
      for (let offset = 1; offset < updated.length && remaining > 0; offset += 1) {
        const donorIndex = (index + offset) % updated.length;
        const available = Math.max(0, updated[donorIndex].weeks - 1);
        const take = Math.min(available, remaining);
        updated[donorIndex].weeks -= take;
        remaining -= take;
      }
      updated[index].weeks = next - remaining;
    } else {
      const giveTo = updated[index + 1] ? index + 1 : Math.max(0, index - 1);
      updated[index].weeks = next;
      updated[giveTo].weeks += Math.abs(diff);
    }

    onBlocksChange(updated);
  };

  const addBlock = () => {
    if (blocks.length >= totalWeeks) return;
    let donorIndex = -1;
    let donorWeeks = 1;
    blocks.forEach((block, index) => {
      if (block.weeks > donorWeeks) {
        donorWeeks = block.weeks;
        donorIndex = index;
      }
    });
    if (donorIndex < 0) return;

    const updated = blocks.map((block) => ({ ...block }));
    updated[donorIndex].weeks -= 1;
    updated.push({ name: `Block ${updated.length + 1}`, weeks: 1, focus: 'Training focus' });
    onBlocksChange(updated);
    setExpandedIndex(updated.length - 1);
  };

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return;
    const removedWeeks = blocks[index]?.weeks || 0;
    const updated = blocks.filter((_block, blockIndex) => blockIndex !== index).map((block) => ({ ...block }));
    const receiverIndex = Math.max(0, Math.min(index - 1, updated.length - 1));
    updated[receiverIndex].weeks += removedWeeks;
    onBlocksChange(updated);
    setExpandedIndex(Math.max(0, Math.min(receiverIndex, updated.length - 1)));
  };

  return (
    <View style={styles.stepContent}>
      <View style={styles.stepCopy}>
        <Text style={styles.eyebrow}>Blocks</Text>
        <Text style={styles.question}>Shape the training arc</Text>
        <Text style={styles.body}>Break the program into phases. The weeks stay balanced with your program length.</Text>
        <View style={[styles.blockStatusPill, assignmentComplete && styles.blockStatusPillComplete]}>
          <Ionicons
            name={assignmentComplete ? 'checkmark-circle' : 'alert-circle-outline'}
            size={15}
            color={assignmentComplete ? colors.green : colors.amber}
          />
          <Text style={styles.blockStatusText}>{assignedWeeks}/{totalWeeks} weeks assigned</Text>
        </View>
      </View>
      <View style={styles.blockEditorList}>
        {blocks.map((block, index) => (
          <View key={`block-editor-${index}`} style={styles.blockEditor}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setExpandedIndex(index)}
              style={({ pressed }) => [styles.blockSummaryRow, pressed && styles.pressed]}
            >
              <View style={styles.blockIndex}>
                <Text style={styles.blockIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.blockSummaryCopy}>
                <Text style={styles.optionTitle}>{block.name || `Block ${index + 1}`}</Text>
                <Text style={styles.optionDetail}>{block.weeks} weeks · {block.focus || 'Training focus'}</Text>
              </View>
              <Ionicons
                name={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.muted}
              />
            </Pressable>

            {expandedIndex === index ? (
              <View style={styles.blockExpandedEditor}>
                <View style={styles.blockEditorHint}>
                  <Ionicons name="create-outline" size={15} color={colors.violet} />
                  <Text style={styles.blockEditorHintText}>Tune this phase, then move to the next one.</Text>
                </View>
                <View style={styles.blockField}>
                  <Text style={styles.blockFieldLabel}>Name</Text>
                  <TextInput
                    value={block.name}
                    onChangeText={(value) => updateBlock(index, { name: value })}
                    placeholder={`Block ${index + 1}`}
                    placeholderTextColor={colors.subtle}
                    style={styles.blockInput}
                  />
                </View>

                <View style={styles.blockField}>
                  <Text style={styles.blockFieldLabel}>Weeks</Text>
                  <View style={styles.weekStepper}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={block.weeks <= 1}
                      onPress={() => setBlockWeeks(index, block.weeks - 1)}
                      style={({ pressed }) => [
                        styles.weekStepperButton,
                        block.weeks <= 1 && styles.footerButtonDisabled,
                        pressed && block.weeks > 1 && styles.pressed,
                      ]}
                    >
                      <Ionicons name="remove" size={18} color={block.weeks <= 1 ? colors.subtle : colors.textStrong} />
                    </Pressable>
                    <Text style={styles.weekStepperValue}>{block.weeks}</Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={blocks.every((candidate, candidateIndex) => candidateIndex === index || candidate.weeks <= 1)}
                      onPress={() => setBlockWeeks(index, block.weeks + 1)}
                      style={({ pressed }) => [
                        styles.weekStepperButton,
                        blocks.every((candidate, candidateIndex) => candidateIndex === index || candidate.weeks <= 1) && styles.footerButtonDisabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons name="add" size={18} color={colors.textStrong} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.blockField}>
                  <Text style={styles.blockFieldLabel}>Focus</Text>
                  <TextInput
                    value={block.focus}
                    onChangeText={(value) => updateBlock(index, { focus: value })}
                    placeholder="Training focus"
                    placeholderTextColor={colors.subtle}
                    style={styles.blockInput}
                  />
                </View>

                <View style={styles.blockEditorActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={blocks.length <= 1}
                    onPress={() => removeBlock(index)}
                    style={({ pressed }) => [
                      styles.removeBlockButton,
                      blocks.length <= 1 && styles.footerButtonDisabled,
                      pressed && blocks.length > 1 && styles.pressed,
                    ]}
                  >
                    <Text style={styles.removeBlockText}>Remove Block</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setExpandedIndex(-1)}
                    style={({ pressed }) => [styles.doneBlockButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.doneBlockText}>Done</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={blocks.length >= totalWeeks}
        onPress={addBlock}
        style={({ pressed }) => [
          styles.addBlockButton,
          blocks.length >= totalWeeks && styles.footerButtonDisabled,
          pressed && blocks.length < totalWeeks && styles.pressed,
        ]}
      >
        <Ionicons name="add" size={16} color={colors.textStrong} />
        <Text style={styles.addBlockText}>Add Block</Text>
      </Pressable>
    </View>
  );
}

function ReviewStep({
  programName,
  selectedType,
  selectedStart,
  selectedEnd,
  selectedMeet,
  selectedTimeline,
  blocks,
}: {
  programName: string;
  selectedType: ProgramTypeOption;
  selectedStart: string;
  selectedEnd: string;
  selectedMeet: string | null;
  selectedTimeline: string;
  blocks: Array<{ name: string; weeks: number; focus: string }>;
}) {
  const totalWeeks = blocks.reduce((total, block) => total + block.weeks, 0);
  const programTitle = programName.trim() || 'My Training Program';

  return (
    <View style={styles.stepContent}>
      <View style={styles.stepCopy}>
        <Text style={styles.eyebrow}>Review</Text>
        <Text style={styles.question}>Ready to build it?</Text>
        <Text style={styles.body}>Here is the first version of your training arc.</Text>
      </View>

      <View style={styles.reviewHero}>
        <View style={styles.reviewHeroIcon}>
          <Ionicons name={selectedType.icon} size={20} color={colors.violet} />
        </View>
        <View style={styles.reviewHeroCopy}>
          <Text style={styles.reviewProgramName}>{programTitle}</Text>
          <Text style={styles.reviewProgramMeta}>{selectedType.label} · {selectedTimeline}</Text>
        </View>
      </View>

      <View style={styles.reviewHighlightGrid}>
        <View style={styles.reviewHighlight}>
          <Text style={styles.reviewHighlightLabel}>Start</Text>
          <Text style={styles.reviewHighlightValue}>{selectedStart}</Text>
        </View>
        <View style={styles.reviewHighlight}>
          <Text style={styles.reviewHighlightLabel}>End</Text>
          <Text style={styles.reviewHighlightValue}>{selectedEnd}</Text>
        </View>
        {selectedMeet ? (
          <View style={styles.reviewHighlight}>
            <Text style={styles.reviewHighlightLabel}>Meet</Text>
            <Text style={styles.reviewHighlightValue}>{selectedMeet}</Text>
          </View>
        ) : null}
        <View style={styles.reviewHighlight}>
          <Text style={styles.reviewHighlightLabel}>Blocks</Text>
          <Text style={styles.reviewHighlightValue}>{blocks.length}</Text>
        </View>
        <View style={styles.reviewHighlight}>
          <Text style={styles.reviewHighlightLabel}>Weeks</Text>
          <Text style={styles.reviewHighlightValue}>{totalWeeks}</Text>
        </View>
      </View>

      <View style={styles.reviewSection}>
        <View style={styles.reviewSectionHeader}>
          <Text style={styles.inputLabel}>Block Plan</Text>
          <Text style={styles.reviewSectionMeta}>{totalWeeks} weeks</Text>
        </View>
        <View style={styles.reviewBlockList}>
          {blocks.map((block, index) => (
            <View key={`review-block-${index}`} style={styles.reviewBlockRow}>
              <View style={styles.blockIndex}>
                <Text style={styles.blockIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.blockSummaryCopy}>
                <Text style={styles.optionTitle}>{block.name || `Block ${index + 1}`}</Text>
                <Text style={styles.optionDetail}>{block.focus || 'Training focus'}</Text>
              </View>
              <Text style={styles.reviewBlockWeeks}>{block.weeks}w</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.reviewNote}>
        <Ionicons name="sparkles-outline" size={16} color={colors.green} />
        <Text style={styles.reviewNoteText}>Next you will add sessions and schedule training from Programming.</Text>
      </View>
    </View>
  );
}

function buildBlockPlan(type: ProgramTypeKey, lengthWeeks: number) {
  const weeks = Math.max(1, Math.abs(Math.trunc(lengthWeeks || 1)));
  const blockCount = weeks <= 4 ? 1 : 3;
  const baseWeeks = Math.floor(weeks / blockCount);
  const remainder = weeks % blockCount;

  return Array.from({ length: blockCount }, (_item, index) => ({
    name: `Block ${index + 1}`,
    weeks: Math.max(1, baseWeeks + (index < remainder ? 1 : 0)),
    focus: 'Training focus',
  }));
}

function mobileProgramTypeToBackend(type: ProgramTypeKey) {
  if (type === 'meet_prep') return 'meet_prep';
  if (type === 'offseason') return 'offseason';
  if (type === 'general_strength') return 'strength_base';
  return 'general';
}

function backendProgramTypeToMobile(type?: string | null): ProgramTypeKey {
  const raw = String(type || '').trim().toLowerCase();
  if (raw === 'meet_prep') return 'meet_prep';
  if (raw === 'offseason') return 'offseason';
  if (raw === 'strength_base' || raw === 'general_strength') return 'general_strength';
  if (raw === 'general') return 'custom';
  return 'custom';
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function sameDate(a: Date, b: Date) {
  return sameMonth(a, b) && a.getDate() === b.getDate();
}

function calendarDays(month: Date) {
  const start = startOfMonth(month);
  const firstGridDate = new Date(start);
  firstGridDate.setDate(start.getDate() - start.getDay());

  return Array.from({ length: 42 }, (_item, index) => {
    const day = new Date(firstGridDate);
    day.setDate(firstGridDate.getDate() + index);
    return day;
  });
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatProgramDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingTop: 10,
    paddingBottom: 184,
    gap: 16,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  flowTitle: {
    ...SLTypography.utilityLabel,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  programNamePreview: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  exitButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.34)',
    backgroundColor: 'rgba(127, 29, 29, 0.16)',
    paddingHorizontal: 11,
    borderRadius: 8,
  },
  exitButtonText: {
    ...SLTypography.buttonLabel,
    color: '#FCA5A5',
  },
  stepTrack: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    paddingTop: 8,
    paddingBottom: 9,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(24, 16, 15, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    borderColor: colors.violet,
    backgroundColor: colors.violet,
  },
  stepDotComplete: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },
  stepLabel: {
    ...SLTypography.micro,
    color: colors.subtle,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.textStrong,
  },
  panel: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  formPanel: {
    borderTopWidth: 0,
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
  },
  stepContent: {
    paddingVertical: 8,
    gap: 16,
  },
  stepCopy: {
    paddingHorizontal: 14,
    gap: 6,
  },
  eyebrow: {
    ...SLTypography.utilityLabel,
    color: colors.violet,
    textTransform: 'uppercase',
  },
  question: {
    ...SLTypography.sectionTitle,
    color: colors.textStrong,
  },
  body: {
    ...SLTypography.body,
    color: colors.muted,
  },
  blockStatusPill: {
    minHeight: 34,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(214, 167, 94, 0.24)',
    backgroundColor: 'rgba(214, 167, 94, 0.08)',
    paddingHorizontal: 10,
    borderRadius: 999,
    marginTop: 4,
  },
  blockStatusPillComplete: {
    borderColor: 'rgba(167, 203, 181, 0.24)',
    backgroundColor: 'rgba(167, 203, 181, 0.08)',
  },
  blockStatusText: {
    ...SLTypography.caption,
    color: colors.text,
  },
  inputGroup: {
    paddingHorizontal: 0,
    gap: 7,
  },
  inputLabel: {
    ...SLTypography.label,
    color: colors.muted,
  },
  programTypeHeader: {
    paddingHorizontal: 0,
  },
  textInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(5, 10, 19, 0.44)',
    color: colors.textStrong,
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 16,
    paddingHorizontal: 12,
  },
  dateField: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(5, 10, 19, 0.44)',
    paddingHorizontal: 12,
  },
  dateFieldText: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 16,
    color: colors.textStrong,
  },
  calendarPanel: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(10, 11, 11, 0.20)',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 12,
  },
  calendarTopRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  calendarLabel: {
    ...SLTypography.label,
    color: colors.subtle,
    textTransform: 'uppercase',
  },
  calendarDone: {
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  calendarDoneText: {
    ...SLTypography.buttonLabel,
    color: colors.violet,
  },
  calendarMonthRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  calendarArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(5, 10, 19, 0.30)',
  },
  calendarMonthTitle: {
    ...SLTypography.bodyStrong,
    flex: 1,
    color: colors.textStrong,
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekdayLabel: {
    ...SLTypography.micro,
    flex: 1,
    color: colors.subtle,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.lineSoft,
  },
  calendarDay: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(24, 16, 15, 0.08)',
  },
  calendarDayOutside: {
    backgroundColor: 'rgba(5, 10, 19, 0.12)',
  },
  calendarDayToday: {
    borderColor: 'rgba(167, 139, 250, 0.32)',
    backgroundColor: 'rgba(167, 139, 250, 0.06)',
  },
  calendarDaySelected: {
    backgroundColor: colors.violet,
  },
  calendarDayText: {
    fontFamily: SLFontFamilies.monoSemiBold,
    fontSize: 14,
    color: colors.textStrong,
  },
  calendarDayTextOutside: {
    color: colors.subtle,
  },
  calendarDayTextSelected: {
    color: SLColors.textInverted,
  },
  optionList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  optionRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'transparent',
  },
  choiceRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(24, 16, 15, 0.16)',
  },
  optionRowSelected: {
    borderColor: 'rgba(167, 139, 250, 0.34)',
    backgroundColor: 'rgba(167, 139, 250, 0.045)',
  },
  checkboxBox: {
    width: 34,
    height: 34,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(5, 10, 19, 0.24)',
  },
  checkboxBoxSelected: {
    borderColor: colors.violet,
    backgroundColor: colors.violet,
  },
  programTypeIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(5, 10, 19, 0.24)',
  },
  programTypeIconSelected: {
    borderColor: 'rgba(167, 139, 250, 0.30)',
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
  },
  optionCopy: {
    flex: 1,
    gap: 3,
  },
  optionTitle: {
    ...SLTypography.bodyStrong,
    color: colors.textStrong,
  },
  optionExpandedDetail: {
    ...SLTypography.caption,
    color: colors.muted,
    paddingTop: 3,
  },
  optionDetail: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  blockEditorList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  blockEditor: {
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(24, 16, 15, 0.16)',
  },
  blockSummaryRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  blockIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.20)',
  },
  blockIndexText: {
    fontFamily: SLFontFamilies.monoSemiBold,
    fontSize: 12,
    color: colors.violet,
  },
  blockSummaryCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  blockExpandedEditor: {
    gap: 12,
    paddingTop: 2,
    paddingBottom: 16,
    paddingLeft: 40,
    paddingRight: 0,
  },
  blockEditorHint: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.16)',
    backgroundColor: 'rgba(167, 139, 250, 0.055)',
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  blockEditorHintText: {
    ...SLTypography.caption,
    flex: 1,
    color: colors.muted,
  },
  blockEditorFields: {
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  blockField: {
    gap: 5,
  },
  blockFieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  blockWeeksField: {
    width: 76,
    gap: 5,
  },
  blockFocusField: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  blockFieldLabel: {
    ...SLTypography.caption,
    color: colors.subtle,
    textTransform: 'uppercase',
  },
  blockInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(5, 10, 19, 0.44)',
    color: colors.textStrong,
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 15,
    paddingHorizontal: 10,
  },
  weekStepper: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(5, 10, 19, 0.44)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  weekStepperButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStepperValue: {
    minWidth: 44,
    textAlign: 'center',
    fontFamily: SLFontFamilies.monoSemiBold,
    fontSize: 16,
    color: colors.textStrong,
  },
  blockEditorActions: {
    flexDirection: 'row',
    gap: 10,
  },
  removeBlockButton: {
    minHeight: 40,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.28)',
    backgroundColor: 'rgba(127, 29, 29, 0.12)',
    borderRadius: 8,
  },
  removeBlockText: {
    ...SLTypography.buttonLabel,
    color: '#FCA5A5',
  },
  doneBlockButton: {
    minHeight: 40,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  doneBlockText: {
    ...SLTypography.buttonLabel,
    color: colors.textStrong,
  },
  addBlockButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginTop: 2,
  },
  addBlockText: {
    ...SLTypography.buttonLabel,
    color: colors.textStrong,
  },
  reviewHero: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.20)',
    backgroundColor: 'rgba(167, 139, 250, 0.055)',
    padding: 14,
    borderRadius: 12,
  },
  reviewHeroIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.26)',
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
    borderRadius: 12,
  },
  reviewHeroCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  reviewProgramName: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 20,
    lineHeight: 25,
    color: colors.textStrong,
  },
  reviewProgramMeta: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  reviewHighlightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reviewHighlight: {
    minHeight: 66,
    flexBasis: '47%',
    flexGrow: 1,
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(24, 16, 15, 0.18)',
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  reviewHighlightLabel: {
    ...SLTypography.utilityLabel,
    color: colors.subtle,
    textTransform: 'uppercase',
  },
  reviewHighlightValue: {
    ...SLTypography.bodyStrong,
    color: colors.textStrong,
  },
  reviewSection: {
    gap: 10,
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewSectionMeta: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  reviewBlockList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  reviewBlockRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(24, 16, 15, 0.16)',
    paddingVertical: 11,
  },
  reviewBlockWeeks: {
    fontFamily: SLFontFamilies.monoSemiBold,
    fontSize: 14,
    color: colors.green,
  },
  reviewNote: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: 'rgba(167, 203, 181, 0.18)',
    backgroundColor: 'rgba(167, 203, 181, 0.07)',
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  reviewNoteText: {
    ...SLTypography.caption,
    flex: 1,
    color: colors.muted,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderColor: SLColors.shellHairline,
    backgroundColor: SLColors.shellTabSurface,
  },
  footerBackButton: {
    minHeight: 48,
    flex: 0.9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  footerNextButton: {
    minHeight: 48,
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.green,
    borderRadius: 8,
  },
  footerBackText: {
    ...SLTypography.buttonLabel,
    color: colors.text,
  },
  footerNextText: {
    ...SLTypography.buttonLabel,
    color: SLColors.textInverted,
  },
  footerButtonDisabled: {
    opacity: 0.45,
  },
  footerButtonTextDisabled: {
    color: colors.subtle,
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  secondaryButtonText: {
    ...SLTypography.buttonLabel,
    color: colors.textStrong,
  },
  blockedState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  blockedTitle: {
    ...SLTypography.sectionTitle,
    color: colors.textStrong,
    textAlign: 'center',
  },
  blockedBody: {
    ...SLTypography.body,
    color: colors.muted,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
});
