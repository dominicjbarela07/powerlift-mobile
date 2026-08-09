import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';

import {
  getCheckInDetail,
  getDueCheckIns,
  submitCheckInAnswers,
  type MobileCheckInDetail,
  type MobileCheckInQuestion,
  type MobileCheckInSummary,
} from '@/lib/api';
import { SLColors, SLControlSize, SLFontFamilies, SLOpacity, SLRadius, SLTypography } from '@/constants/theme';

const colors = {
  text: SLColors.text,
  strong: SLColors.textStrong,
  muted: SLColors.textMuted,
  subtle: SLColors.textSubtle,
  line: SLColors.borderSubtle,
  lineSoft: SLColors.borderHairline,
  surface: SLColors.surfaceEmbedded,
  surfaceStrong: SLColors.focus,
  surfaceInput: SLColors.surfaceInset,
  violet: SLColors.accentViolet,
  violetSoft: SLColors.accentVioletSoft,
  amber: SLColors.warning,
  amberSoft: SLColors.warningSoft,
  amberActive: SLColors.warningSoft,
  green: SLColors.success,
  greenSoft: SLColors.successSoft,
  red: SLColors.danger,
  redSoft: SLColors.dangerSoft,
};

type CheckInState = {
  answers: Record<string, any>;
  due: MobileCheckInSummary[];
  error: string | null;
  loading: boolean;
  recent: MobileCheckInSummary[];
  selected: MobileCheckInDetail | null;
  submittedTitle: string | null;
  submitting: boolean;
  close: () => void;
  load: (opts?: { silent?: boolean }) => Promise<void>;
  open: (item: MobileCheckInSummary) => Promise<void>;
  submit: () => Promise<void>;
  updateAnswer: (questionId: number, value: any) => void;
};

export function useAthleteCheckIns(): CheckInState {
  const [due, setDue] = useState<MobileCheckInSummary[]>([]);
  const [recent, setRecent] = useState<MobileCheckInSummary[]>([]);
  const [selected, setSelected] = useState<MobileCheckInDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const response = await getDueCheckIns();
      if (!response.ok || !response.json?.ok) {
        setError(response.json?.error || `Unable to load check-ins (${response.status})`);
        setDue([]);
        setRecent([]);
        return;
      }
      setDue(response.json.due_check_ins || []);
      setRecent(response.json.recent_submissions || []);
    } catch (err) {
      console.warn('Check-ins list failed', err);
      setError('Network error while loading check-ins.');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const open = useCallback(async (item: MobileCheckInSummary) => {
    setError(null);
    setSubmittedTitle(null);
    setSelected(null);
    setAnswers({});
    try {
      const response = await getCheckInDetail(item.id);
      if (!response.ok || !response.json?.ok || !response.json.submission) {
        setError(response.json?.error || `Unable to load check-in (${response.status})`);
        return;
      }
      const detail = response.json.submission;
      const seeded: Record<string, any> = {};
      for (const answer of detail.answers || []) {
        if (answer.value !== null && answer.value !== undefined) {
          seeded[String(answer.question_id)] = answer.value;
        }
      }
      setAnswers(seeded);
      setSelected(detail);
    } catch (err) {
      console.warn('Check-in detail failed', err);
      setError('Network error while opening this check-in.');
    }
  }, []);

  const close = useCallback(() => {
    setSelected(null);
    setAnswers({});
  }, []);

  const updateAnswer = useCallback((questionId: number, value: any) => {
    setAnswers((current) => ({ ...current, [String(questionId)]: value }));
  }, []);

  const submit = useCallback(async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await submitCheckInAnswers(selected.id, answers);
      if (!response.ok || !response.json?.ok) {
        const missing = response.json?.missing || [];
        const message = missing.length
          ? `Please answer: ${missing.map((item) => item.prompt).join(', ')}`
          : response.json?.error || `Unable to submit (${response.status})`;
        setError(message);
        return;
      }
      setSubmittedTitle(selected.title);
      setSelected(null);
      setAnswers({});
      await load({ silent: true });
    } catch (err) {
      console.warn('Check-in submit failed', err);
      setError('Network error while submitting.');
    } finally {
      setSubmitting(false);
    }
  }, [answers, load, selected]);

  return {
    answers,
    close,
    due,
    error,
    load,
    loading,
    open,
    recent,
    selected,
    submit,
    submittedTitle,
    submitting,
    updateAnswer,
  };
}

export function TodayCheckInSurface() {
  const router = useRouter();
  const checkIns = useAthleteCheckIns();
  const openItems = checkIns.due;

  if (checkIns.loading) {
    return (
      <View style={styles.todayLoading}>
        <ActivityIndicator color={colors.amber} />
        <Text style={styles.mutedText}>Checking for coach check-ins...</Text>
      </View>
    );
  }

  if (checkIns.submittedTitle) {
    return <CheckInSubmitted title={checkIns.submittedTitle} />;
  }

  if (!openItems.length && !checkIns.error) return null;

  return (
    <View style={styles.todaySurface}>
      <View style={styles.todaySurfaceBody}>
        <Text style={styles.zoneKicker}>Coach Check-In</Text>
        {checkIns.error ? <ErrorLine text={checkIns.error} /> : null}
        {openItems.map((item) => (
          <DueCheckInCard key={item.id} item={item} onPress={() => openCheckIn(router, item, 'today')} />
        ))}
      </View>
    </View>
  );
}

export function TodaySubmittedCheckIn({ title }: { title?: string | null }) {
  if (!title) return null;
  return <CheckInSubmitted title={title} />;
}

export function ReflectionCheckInHistory() {
  const router = useRouter();
  const checkIns = useAthleteCheckIns();

  if (checkIns.loading) {
    return (
      <View style={styles.historyEmpty}>
        <ActivityIndicator color={colors.violet} />
        <Text style={styles.mutedText}>Loading completed check-ins...</Text>
      </View>
    );
  }

  if (checkIns.error) return <ErrorLine text={checkIns.error} />;

  if (!checkIns.recent.length) {
    return (
      <View style={styles.historyEmpty}>
        <Text style={styles.historyEmptyTitle}>No completed check-ins yet.</Text>
        <Text style={styles.mutedText}>After you respond, your past check-ins will live here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.historyList}>
      {checkIns.recent.map((item) => (
        <HistoryCheckInRow key={item.id} item={item} onPress={() => openCheckIn(router, item, 'history')} />
      ))}
    </View>
  );
}

export function CheckInFallbackSurface() {
  const router = useRouter();
  const checkIns = useAthleteCheckIns();

  if (checkIns.loading) {
    return (
      <View style={styles.fallbackCentered}>
        <ActivityIndicator color={colors.amber} />
        <Text style={styles.mutedText}>Loading check-ins...</Text>
      </View>
    );
  }

  return (
    <View style={styles.fallback}>
      <View style={styles.fallbackHeader}>
        <Text style={styles.zoneKicker}>Internal Check-In Surface</Text>
        <Text style={styles.fallbackTitle}>Today owns due check-ins.</Text>
        <Text style={styles.mutedText}>This page remains available as a fallback, but athletes should complete check-ins from Today and revisit them in Check-Ins.</Text>
      </View>
      {checkIns.submittedTitle ? <CheckInSubmitted title={checkIns.submittedTitle} /> : null}
      {checkIns.error ? <ErrorLine text={checkIns.error} /> : null}
      {checkIns.due.length ? (
        <View style={styles.historyList}>
          {checkIns.due.map((item) => (
            <DueCheckInCard key={item.id} item={item} onPress={() => openCheckIn(router, item, 'today')} />
          ))}
        </View>
      ) : (
        <View style={styles.historyEmpty}>
          <Text style={styles.historyEmptyTitle}>Nothing due right now.</Text>
          <Text style={styles.mutedText}>Completed check-ins live in Check-Ins.</Text>
        </View>
      )}
    </View>
  );
}

export function StandaloneCheckInFormScreen({
  returnTo,
  submissionId,
}: {
  returnTo?: string | string[];
  submissionId?: string | string[];
}) {
  const router = useRouter();
  const id = Number(Array.isArray(submissionId) ? submissionId[0] : submissionId);
  const target = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const [selected, setSelected] = useState<MobileCheckInDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = useCallback((submittedTitle?: string | null) => {
    if (target === 'history' || target === 'reflection') {
      router.replace('/(tabs)/check-ins' as any);
      return;
    }
    if (target === 'calendar') {
      router.replace('/(tabs)/athlete-calendar' as any);
      return;
    }
    router.replace({
      pathname: '/(tabs)/athlete-dashboard',
      params: submittedTitle ? { submittedCheckIn: submittedTitle } : undefined,
    } as any);
  }, [router, target]);

  const load = useCallback(async () => {
    if (!id || Number.isNaN(id)) {
      setError('Check-in unavailable.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await getCheckInDetail(id);
      if (!response.ok || !response.json?.ok || !response.json.submission) {
        setError(response.json?.error || `Unable to load check-in (${response.status})`);
        setSelected(null);
        return;
      }
      const detail = response.json.submission;
      const seeded: Record<string, any> = {};
      for (const answer of detail.answers || []) {
        if (answer.value !== null && answer.value !== undefined) {
          seeded[String(answer.question_id)] = answer.value;
        }
      }
      setSelected(detail);
      setAnswers(seeded);
    } catch (err) {
      console.warn('Check-in detail failed', err);
      setError('Network error while opening this check-in.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const updateAnswer = useCallback((questionId: number, value: any) => {
    setAnswers((current) => ({ ...current, [String(questionId)]: value }));
  }, []);

  const submit = useCallback(async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await submitCheckInAnswers(selected.id, answers);
      if (!response.ok || !response.json?.ok) {
        const missing = response.json?.missing || [];
        const message = missing.length
          ? `Please answer: ${missing.map((item) => item.prompt).join(', ')}`
          : response.json?.error || `Unable to submit (${response.status})`;
        setError(message);
        return;
      }
      goBack(selected.title);
    } catch (err) {
      console.warn('Check-in submit failed', err);
      setError('Network error while submitting.');
    } finally {
      setSubmitting(false);
    }
  }, [answers, goBack, selected]);

  if (loading) {
    return (
      <View style={styles.fallbackCentered}>
        <ActivityIndicator color={colors.amber} />
        <Text style={styles.mutedText}>Loading check-in...</Text>
      </View>
    );
  }

  if (!selected) {
    return (
      <View style={styles.fallback}>
        {error ? <ErrorLine text={error} /> : null}
        <Pressable onPress={() => goBack()} style={styles.submitButton}>
          <Text style={styles.submitText}>Back to Today</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <CheckInConversation
      answers={answers}
      error={error}
      onBack={() => goBack()}
      onSubmit={submit}
      onUpdateAnswer={updateAnswer}
      submission={selected}
      submitting={submitting}
    />
  );
}

function openCheckIn(router: ReturnType<typeof useRouter>, item: MobileCheckInSummary, returnTo: 'today' | 'history') {
  router.push({
    pathname: '/(tabs)/check-in/[submissionId]',
    params: { submissionId: String(item.id), returnTo },
  } as any);
}

function DueCheckInCard({ item, onPress }: { item: MobileCheckInSummary; onPress: () => void }) {
  const overdue = statusLabel(item) === 'Overdue';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dueCard, overdue && styles.dueCardLate, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
    >
      <View style={styles.dueCardTop}>
        <Text style={[styles.dueStatus, overdue && styles.dueStatusLate]}>{statusLabel(item)}</Text>
        <Text style={styles.dueEstimate}>~1 min</Text>
      </View>
      <Text style={styles.dueTitle}>{item.title}</Text>
      {item.description ? <Text style={styles.dueDescription} numberOfLines={2}>{item.description}</Text> : null}
      <View style={styles.dueFooter}>
        <Text style={styles.dueMeta}>{item.due_at ? dueTimingLabel(item) : 'Coach update'}</Text>
        <View style={styles.openAction}>
          <Text style={styles.openActionText}>Open Check-In</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.strong} />
        </View>
      </View>
    </Pressable>
  );
}

function CheckInConversation({
  answers,
  error,
  onBack,
  onSubmit,
  onUpdateAnswer,
  submission,
  submitting,
}: {
  answers: Record<string, any>;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
  onUpdateAnswer: (questionId: number, value: any) => void;
  submission: MobileCheckInDetail;
  submitting: boolean;
}) {
  const questions = submission.form?.questions || [];
  const alreadySubmitted = submission.status === 'submitted' || !!submission.submitted_at;
  return (
    <View style={styles.conversation}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Ionicons name="chevron-back" size={18} color={colors.muted} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.conversationHeader}>
        <Text style={styles.conversationStatus}>{statusLabel(submission)}</Text>
        <Text style={styles.conversationTitle}>{submission.title}</Text>
        <View style={styles.conversationMetaRow}>
          <Text style={styles.conversationMeta}>{estimatedTime(questions.length)}</Text>
          <Text style={styles.conversationDot}>•</Text>
          <Text style={styles.conversationMeta}>{questions.length} prompt{questions.length === 1 ? '' : 's'}</Text>
        </View>
        {submission.description ? <Text style={styles.conversationDescription}>{submission.description}</Text> : null}
      </View>

      {error ? <ErrorLine text={error} /> : null}

      <View style={styles.questionStack}>
        {questions.map((question) => (
          <QuestionField
            disabled={alreadySubmitted}
            key={question.id}
            question={question}
            value={answers[String(question.id)]}
            onChange={(value) => onUpdateAnswer(question.id, value)}
          />
        ))}
      </View>

      {alreadySubmitted ? (
        <View style={styles.submittedBox}>
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.green} />
          <View style={styles.submittedCopy}>
            <Text style={styles.submittedTitle}>Recovery Check-In Submitted</Text>
            <Text style={styles.submittedText}>Your responses are available to your coach.</Text>
          </View>
        </View>
      ) : (
        <Pressable
          disabled={submitting}
          onPress={onSubmit}
          style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, submitting && styles.disabled]}
        >
          <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit to Coach'}</Text>
          <Ionicons name="send-outline" size={17} color={colors.strong} />
        </Pressable>
      )}
    </View>
  );
}

function QuestionField({
  disabled,
  onChange,
  question,
  value,
}: {
  disabled: boolean;
  onChange: (value: any) => void;
  question: MobileCheckInQuestion;
  value: any;
}) {
  const type = question.question_type;
  const [focused, setFocused] = useState(false);
  const min = Number(question.config?.min ?? 1);
  const max = Number(question.config?.max ?? 10);
  const scaleValues = useMemo(() => {
    const start = Number.isFinite(min) ? min : 1;
    const end = Number.isFinite(max) ? max : 10;
    const count = Math.max(1, Math.min(12, end - start + 1));
    return Array.from({ length: count }, (_, optionIndex) => start + optionIndex);
  }, [max, min]);

  return (
    <View style={styles.questionCard}>
      <Text style={styles.questionPrompt}>{question.prompt}</Text>
      {type === 'long_text' ? (
        <TextInput
          editable={!disabled}
          multiline
          onBlur={() => setFocused(false)}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          style={[styles.input, styles.textArea, focused && styles.inputFocused]}
          value={String(value || '')}
        />
      ) : type === 'number' ? (
        <TextInput
          editable={!disabled}
          keyboardType="decimal-pad"
          onBlur={() => setFocused(false)}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          style={[styles.input, focused && styles.inputFocused]}
          value={String(value || '')}
        />
      ) : type === 'scale' ? (
        <ScaleSelector
          disabled={disabled}
          onChange={onChange}
          options={scaleValues}
          value={value}
        />
      ) : type === 'single_choice' ? (
        <View style={styles.choiceWrap}>
          {(question.options || []).map((option) => (
            <ChoiceChip disabled={disabled} key={option} label={option} selected={String(value || '') === option} onPress={() => onChange(option)} />
          ))}
        </View>
      ) : type === 'multi_choice' ? (
        <View style={styles.choiceWrap}>
          {(question.options || []).map((option) => {
            const selected = Array.isArray(value) && value.includes(option);
            return (
              <ChoiceChip
                disabled={disabled}
                key={option}
                label={option}
                selected={selected}
                onPress={() => {
                  const current = Array.isArray(value) ? value : [];
                  onChange(selected ? current.filter((item) => item !== option) : [...current, option]);
                }}
              />
            );
          })}
        </View>
      ) : type === 'yes_no' ? (
        <View style={styles.yesNoRow}>
          {['Yes', 'No'].map((option) => (
            <ChoiceChip disabled={disabled} key={option} label={option} selected={String(value || '') === option} onPress={() => onChange(option)} />
          ))}
        </View>
      ) : type === 'date' ? (
        <TextInput
          editable={!disabled}
          onBlur={() => setFocused(false)}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.subtle}
          style={[styles.input, focused && styles.inputFocused]}
          value={String(value || '')}
        />
      ) : (
        <TextInput
          editable={!disabled}
          onBlur={() => setFocused(false)}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          style={[styles.input, focused && styles.inputFocused]}
          value={String(value || '')}
        />
      )}
    </View>
  );
}

function ScaleSelector({
  disabled,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  onChange: (value: any) => void;
  options: number[];
  value: any;
}) {
  const selectedIndex = options.findIndex((option) => String(value || '') === String(option));
  return (
    <View style={styles.scaleShell}>
      <View style={styles.scaleTrack}>
        {options.map((option, index) => {
          const selected = index === selectedIndex;
          const active = selectedIndex >= 0 && index <= selectedIndex;
          return (
            <Pressable
              disabled={disabled}
              key={option}
              onPress={() => onChange(String(option))}
              style={({ pressed }) => [
                styles.scaleSegment,
                index > 0 && styles.scaleSegmentDivider,
                active && styles.scaleSegmentActive,
                selected && styles.scaleSegmentSelected,
                pressed && styles.pressed,
                disabled && styles.disabled,
              ]}
            >
              <Text style={[styles.scaleSegmentText, active && styles.scaleSegmentTextActive, selected && styles.scaleSegmentTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.scaleHintRow}>
        <Text style={styles.scaleHint}>Low</Text>
        <Text style={styles.scaleHint}>High</Text>
      </View>
    </View>
  );
}

function ChoiceChip({
  disabled,
  label,
  onPress,
  scale,
  selected,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  scale?: boolean;
  selected: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceChip,
        scale && styles.scaleChip,
        selected && styles.choiceChipSelected,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.choiceText, scale && styles.scaleText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function HistoryCheckInRow({ item, onPress }: { item: MobileCheckInSummary; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
      <View style={styles.historyIcon}>
        <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.amber} />
      </View>
      <View style={styles.historyCopy}>
        <Text style={styles.historyTitle}>{item.title}</Text>
        <Text style={styles.historyMeta}>{item.submitted_at ? `Submitted ${formatDateTime(item.submitted_at)}` : statusLabel(item)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.muted} />
    </Pressable>
  );
}

function CheckInSubmitted({ title }: { title: string }) {
  return (
    <View style={styles.completedState}>
      <Ionicons name="checkmark-circle" size={24} color={colors.green} />
      <View style={styles.submittedCopy}>
        <Text style={styles.submittedTitle}>{title} Submitted</Text>
        <Text style={styles.submittedText}>Thanks. Your coach now has this week’s update.</Text>
      </View>
    </View>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <View style={styles.errorLine}>
      <Ionicons name="alert-circle-outline" size={18} color={colors.red} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

function statusLabel(item: { status?: string | null; submitted_at?: string | null }) {
  const status = String(item.status || '').toLowerCase();
  if (status === 'late') return 'Overdue';
  if (status === 'submitted' || item.submitted_at) return 'Submitted';
  return 'Due Today';
}

function dueTimingLabel(item: MobileCheckInSummary) {
  if (String(item.status || '').toLowerCase() === 'late') return 'Overdue';
  return `Due ${formatDateTime(item.due_at)}`;
}

function estimatedTime(questionCount: number) {
  const minutes = Math.max(1, Math.ceil(questionCount / 7));
  return `~${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

const styles = StyleSheet.create({
  todayLoading: {
    marginBottom: 10,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
  },
  mutedText: {
    ...SLTypography.label,
    color: colors.muted,
  },
  todaySurface: {
    flexDirection: 'row',
    marginBottom: 10,
    backgroundColor: SLColors.surfaceEmbedded,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  todaySurfaceRail: {
    width: 4,
    backgroundColor: colors.amber,
  },
  todaySurfaceBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  zoneKicker: {
    ...SLTypography.utilityLabel,
    color: colors.amber,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  dueCard: {
    gap: 9,
    padding: 15,
    backgroundColor: SLColors.surfaceInset,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.radiusCard,
  },
  dueCardLate: {
    borderColor: SLColors.danger,
    backgroundColor: SLColors.dangerSoft,
  },
  dueCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  dueStatus: {
    ...SLTypography.utilityLabel,
    color: colors.amber,
    textTransform: 'uppercase',
  },
  dueStatusLate: {
    color: colors.red,
  },
  dueEstimate: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  dueTitle: {
    ...SLTypography.sectionTitle,
    color: colors.strong,
  },
  dueDescription: {
    ...SLTypography.label,
    color: colors.muted,
  },
  dueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 3,
  },
  dueMeta: {
    ...SLTypography.caption,
    flex: 1,
    color: colors.muted,
  },
  openAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: SLRadius.pill,
    backgroundColor: colors.violetSoft,
  },
  openActionText: {
    ...SLTypography.chipLabel,
    color: colors.strong,
  },
  conversation: {
    gap: 18,
    marginBottom: 14,
    paddingVertical: 6,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backText: {
    ...SLTypography.label,
    color: colors.muted,
  },
  conversationHeader: {
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  conversationStatus: {
    ...SLTypography.utilityLabel,
    color: colors.amber,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  conversationTitle: {
    color: colors.strong,
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 30,
    lineHeight: 35,
  },
  conversationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  conversationMeta: {
    ...SLTypography.label,
    color: colors.muted,
  },
  conversationDot: {
    color: colors.subtle,
    fontFamily: SLFontFamilies.sansBold,
  },
  conversationDescription: {
    ...SLTypography.note,
    color: colors.muted,
  },
  errorLine: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: SLColors.danger,
    borderRadius: SLRadius.radiusCard,
    backgroundColor: colors.redSoft,
  },
  errorText: {
    ...SLTypography.label,
    flex: 1,
    color: colors.red,
  },
  questionStack: {
    gap: 18,
  },
  questionCard: {
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderBottomWidth: 0,
    borderColor: SLColors.borderHairline,
  },
  questionPrompt: {
    ...SLTypography.sectionTitle,
    color: colors.strong,
  },
  input: {
    minHeight: SLControlSize.comfortable,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.radiusCard,
    backgroundColor: colors.surfaceInput,
    color: colors.text,
    ...SLTypography.body,
  },
  inputFocused: {
    borderColor: SLColors.warning,
    backgroundColor: SLColors.focus,
  },
  textArea: {
    minHeight: 118,
    paddingTop: 13,
    textAlignVertical: 'top',
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  yesNoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  scaleShell: {
    gap: 8,
  },
  scaleTrack: {
    flexDirection: 'row',
    minHeight: SLControlSize.comfortable,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.radiusCard,
    backgroundColor: SLColors.surfaceInset,
  },
  scaleSegment: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleSegmentDivider: {
    borderLeftWidth: 1,
    borderLeftColor: SLColors.borderHairline,
  },
  scaleSegmentActive: {
    backgroundColor: SLColors.warningSoft,
  },
  scaleSegmentSelected: {
    backgroundColor: colors.amberActive,
  },
  scaleSegmentText: {
    ...SLTypography.label,
    color: colors.muted,
  },
  scaleSegmentTextActive: {
    color: colors.text,
  },
  scaleSegmentTextSelected: {
    color: colors.strong,
  },
  scaleHintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  scaleHint: {
    ...SLTypography.micro,
    color: colors.subtle,
  },
  choiceChip: {
    minHeight: SLControlSize.minimumTouchTarget,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: SLColors.surfaceInset,
  },
  scaleChip: {
    minWidth: 42,
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  choiceChipSelected: {
    borderColor: SLColors.warning,
    backgroundColor: colors.amberSoft,
  },
  choiceText: {
    ...SLTypography.rowTitle,
    color: colors.muted,
  },
  scaleText: {
    fontSize: SLTypography.body.fontSize,
  },
  choiceTextSelected: {
    color: colors.strong,
  },
  submitButton: {
    minHeight: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: SLRadius.radiusCard,
    backgroundColor: SLColors.railViolet,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
  },
  submitText: {
    ...SLTypography.bodyStrong,
    color: colors.strong,
  },
  completedState: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SLColors.success,
    borderRadius: SLRadius.radiusCard,
    backgroundColor: SLColors.successSoft,
    marginBottom: 10,
  },
  submittedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SLColors.success,
    borderRadius: SLRadius.radiusCard,
    backgroundColor: SLColors.successSoft,
  },
  submittedCopy: {
    flex: 1,
    gap: 3,
  },
  submittedTitle: {
    ...SLTypography.cardTitle,
    color: colors.strong,
  },
  submittedText: {
    ...SLTypography.label,
    color: colors.green,
  },
  historyList: {
    gap: 0,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  historyIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.amberSoft,
  },
  historyCopy: {
    flex: 1,
    gap: 3,
  },
  historyTitle: {
    ...SLTypography.rowTitle,
    color: colors.strong,
  },
  historyMeta: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  historyEmpty: {
    gap: 6,
    paddingVertical: 14,
  },
  historyEmptyTitle: {
    ...SLTypography.rowTitle,
    color: colors.strong,
  },
  fallback: {
    gap: 16,
    padding: 18,
    paddingBottom: 42,
  },
  fallbackHeader: {
    gap: 8,
    paddingBottom: 4,
  },
  fallbackTitle: {
    color: colors.strong,
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 25,
    lineHeight: 30,
  },
  fallbackCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pressed: {
    opacity: SLOpacity.pressed,
  },
  disabled: {
    opacity: SLOpacity.loading,
  },
});
