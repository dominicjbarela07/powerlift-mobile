import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { StrengthLedgerBottomSheet } from '@/components/sheets/StrengthLedgerBottomSheet';
import { AthleteCoachingScratchpadTrigger } from '@/components/coach-mobile/AthleteCoachingScratchpad';
import { SLCompactTabRail, SLContextualHeader, type SLContextualHeaderAction } from '@/components/ui';
import { SLButton } from '@/components/ui/sl-button';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLFontFamilies } from '@/constants/theme';
import {
  changeCoachCheckInFormState,
  createCoachCheckInForm,
  duplicateCoachCheckInForm,
  getCoachCheckInReview,
  getCoachCheckIns,
  markCoachCheckInReviewed,
  updateCoachCheckInAssignments,
  updateCoachCheckInForm,
  type CoachCheckInAthlete,
  type CoachCheckInForm,
  type CoachCheckInQuestion,
  type CoachCheckInReview,
  type CoachCheckInsCommandCenter,
  type CoachCheckInSubmissionCard,
  type CoachCheckInTemplate,
} from '@/lib/api';

const C = {
  canvas: '#020205', surface: '#08090E', raised: '#0D0F16', selected: '#211433', line: '#292C36',
  text: '#F8F6FA', muted: '#A09AA8', subtle: '#747180', violet: '#A967FF', violetSoft: '#2B1743',
  green: '#4AD28A', amber: '#F1B742', red: '#FF5A68', blue: '#58A8FF', orange: '#FF8A45',
};

type Tab = 'forms' | 'athletes' | 'inbox';
type ViewState =
  | { kind: 'home' }
  | { kind: 'templates' }
  | { kind: 'form'; formId: number }
  | { kind: 'builder'; formId?: number; template?: CoachCheckInTemplate }
  | { kind: 'assign'; formId: number }
  | { kind: 'analytics'; formId: number }
  | { kind: 'review'; submissionId: number };

const questionIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  scale: 'options-outline', yes_no: 'checkmark-circle-outline', single_choice: 'radio-button-on-outline',
  multi_choice: 'list-outline', number: 'calculator-outline', short_text: 'text-outline', long_text: 'reader-outline',
};

const formatDate = (value?: string | null, includeTime = false) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, includeTime
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric' }).format(date);
};

const relative = (value?: string | null) => {
  if (!value) return 'No submission';
  const delta = Date.now() - new Date(value).getTime();
  if (delta < 60 * 60 * 1000) return `${Math.max(1, Math.round(delta / 60000))}m ago`;
  if (delta < 24 * 60 * 60 * 1000) return `${Math.round(delta / 3600000)}h ago`;
  return `${Math.round(delta / 86400000)}d ago`;
};

export function CoachCheckInsV2({ initialAthleteId }: { initialAthleteId?: number }) {
  const router = useRouter();
  const [data, setData] = useState<CoachCheckInsCommandCenter | null>(null);
  const [tab, setTab] = useState<Tab>('forms');
  const [view, setView] = useState<ViewState>({ kind: 'home' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didChooseInitialTab, setDidChooseInitialTab] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await getCoachCheckIns(initialAthleteId);
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || `Unable to load Check-Ins (${response.status})`);
      setData(response.json);
      if (!didChooseInitialTab) {
        setTab(response.json.summary.awaiting_review || response.json.summary.overdue ? 'inbox' : initialAthleteId ? 'athletes' : 'forms');
        setDidChooseInitialTab(true);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Coach Check-Ins.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [didChooseInitialTab, initialAthleteId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openForm = (formId: number) => setView({ kind: 'form', formId });
  const openReview = (submissionId: number) => setView({ kind: 'review', submissionId });
  const home = () => setView({ kind: 'home' });
  const refresh = async () => { setRefreshing(true); await load(true); };

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState error={error || 'Coach Check-Ins are unavailable.'} onRetry={() => void load()} />;

  if (view.kind === 'templates') return <TemplatePicker data={data} onBack={home} onCreated={(next) => { setData(next); home(); }} onCustom={(template) => setView({ kind: 'builder', template })} />;
  if (view.kind === 'form') {
    const form = data.forms.find((row) => row.id === view.formId);
    if (!form) return <ErrorState error="This Check-In form is unavailable." onRetry={home} />;
    return <FormDetail data={data} form={form} onBack={home} onData={setData} onAssign={() => setView({ kind: 'assign', formId: form.id })} onEdit={() => setView({ kind: 'builder', formId: form.id })} onAnalytics={() => setView({ kind: 'analytics', formId: form.id })} onSubmissions={() => { setTab('inbox'); home(); }} />;
  }
  if (view.kind === 'builder') {
    const form = view.formId ? data.forms.find((row) => row.id === view.formId) : undefined;
    return <FormBuilder data={data} form={form} template={view.template} onBack={() => form ? openForm(form.id) : setView({ kind: 'templates' })} onSaved={(next, formId) => { setData(next); openForm(formId); }} />;
  }
  if (view.kind === 'assign') {
    const form = data.forms.find((row) => row.id === view.formId);
    if (!form) return <ErrorState error="This Check-In form is unavailable." onRetry={home} />;
    return <AssignmentEditor data={data} form={form} onBack={() => openForm(form.id)} onSaved={(next) => { setData(next); openForm(form.id); }} />;
  }
  if (view.kind === 'analytics') {
    const form = data.forms.find((row) => row.id === view.formId);
    if (!form) return <ErrorState error="This Check-In form is unavailable." onRetry={home} />;
    return <FormAnalytics form={form} onBack={() => openForm(form.id)} />;
  }
  if (view.kind === 'review') return <ResponseReview submissionId={view.submissionId} onBack={home} onData={setData} router={router} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl tintColor={C.violet} refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <View style={styles.titleRow}>
        <View><Text style={styles.pageTitle}>Check-Ins</Text><Text style={styles.subtitle}>Athlete monitoring</Text></View>
        <IconButton icon="add" label="Create Check-In" onPress={() => setView({ kind: 'templates' })} />
      </View>
      {error ? <InlineError text={error} /> : null}
      <Snapshot summary={data.summary} />
      <Segmented value={tab} options={[
        { key: 'forms', label: 'Forms' },
        { key: 'athletes', label: 'Athletes' },
        { key: 'inbox', label: `Inbox${data.summary.awaiting_review || data.summary.overdue ? ` ${data.summary.awaiting_review + data.summary.overdue}` : ''}` },
      ]} onChange={(key) => setTab(key as Tab)} />
      {tab === 'forms' ? <FormsHome data={data} onCreate={() => setView({ kind: 'templates' })} onOpen={openForm} /> : null}
      {tab === 'athletes' ? <AthleteCoverage data={data} onAssign={(formId) => setView({ kind: 'assign', formId })} onOpenReview={openReview} router={router} /> : null}
      {tab === 'inbox' ? <Inbox data={data} onOpen={openReview} router={router} /> : null}
    </ScrollView>
  );
}

function Snapshot({ summary }: { summary: CoachCheckInsCommandCenter['summary'] }) {
  const rows = [
    [String(summary.active_forms), 'Active\nForms', C.amber],
    [`${summary.covered_athletes}/${summary.total_athletes}`, 'Athletes\nCovered', C.green],
    [String(summary.awaiting_review), 'Awaiting\nReview', C.orange],
    [String(summary.overdue), 'Overdue\nResponses', C.red],
  ];
  return <View style={styles.snapshot}>{rows.map(([value, label, color]) => <View key={label} style={styles.snapshotCell}><Text style={[styles.snapshotValue, { color }]}>{value}</Text><Text style={styles.snapshotLabel}>{label}</Text></View>)}</View>;
}

function FormsHome({ data, onCreate, onOpen }: { data: CoachCheckInsCommandCenter; onCreate: () => void; onOpen: (id: number) => void }) {
  const active = data.forms.filter((form) => form.is_active);
  const archived = data.forms.filter((form) => !form.is_active);
  return <View style={styles.sectionStack}>
    <SectionHeading title="ACTIVE FORMS" count={active.length} />
    {!active.length ? <Empty icon="clipboard-outline" title="No active Check-In forms" body="Create a form, assign athletes, and begin monitoring." /> : active.map((form) => <FormCard key={form.id} form={form} onPress={() => onOpen(form.id)} />)}
    <SLButton label="Create Check-In" iconLeft="add" fullWidth onPress={onCreate} />
    {archived.length ? <><SectionHeading title="ARCHIVED" count={archived.length} />{archived.map((form) => <FormCard key={form.id} form={form} onPress={() => onOpen(form.id)} />)}</> : null}
  </View>;
}

function FormCard({ form, onPress }: { form: CoachCheckInForm; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.cardTop}><View style={styles.iconTile}><Ionicons name="clipboard-outline" color={form.is_active ? C.amber : C.muted} size={22} /></View><View style={styles.flex}><Text style={styles.cardTitle}>{form.title}</Text><Text style={styles.meta}>{form.cadence_label}{form.delivery_time_local ? ` · ${form.delivery_time_local}` : ''}</Text><Text style={styles.meta}>{form.question_count} questions · {form.assigned_athlete_count} athlete{form.assigned_athlete_count === 1 ? '' : 's'}</Text></View><Pill label={form.is_active ? 'ACTIVE' : 'ARCHIVED'} tone={form.is_active ? 'success' : 'neutral'} /></View>
    <View style={styles.metricRow}><Text style={styles.metricStrong}>{form.completion_rate == null ? 'No submissions' : `${Math.round(form.completion_rate)}% completion`}</Text><Ionicons name="chevron-forward" color={C.muted} size={18} /></View>
    {form.completion_rate != null ? <View style={styles.track}><View style={[styles.trackFill, { width: `${Math.max(0, Math.min(100, form.completion_rate))}%` }]} /></View> : null}
  </Pressable>;
}

function AthleteCoverage({ data, onAssign, onOpenReview, router }: { data: CoachCheckInsCommandCenter; onAssign: (formId: number) => void; onOpenReview: (id: number) => void; router: ReturnType<typeof useRouter> }) {
  const [filter, setFilter] = useState<'all' | 'needs'>('all');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const rows = data.athletes.filter((row) => (filter === 'all' || row.coverage_state !== 'covered') && (!needle || row.name.toLowerCase().includes(needle) || row.forms.some((form) => form.title.toLowerCase().includes(needle))));
  return <View style={styles.sectionStack}>
    <View style={styles.coverageCard}><View><Text style={styles.eyebrow}>COVERAGE SUMMARY</Text><Text style={styles.cardTitle}>{data.summary.covered_athletes} of {data.summary.total_athletes} athletes covered</Text></View><Text style={styles.coveragePercent}>{data.summary.total_athletes ? Math.round(data.summary.covered_athletes / data.summary.total_athletes * 100) : 0}%</Text></View>
    <Segmented value={filter} options={[{ key: 'all', label: 'All Athletes' }, { key: 'needs', label: 'Needs Coverage' }]} onChange={(key) => setFilter(key as 'all' | 'needs')} />
    <SearchField value={query} onChangeText={setQuery} placeholder="Search athletes or forms" />
    {rows.map((athlete) => <AthleteCard key={athlete.id} athlete={athlete} onReview={() => athlete.last_submission_id && onOpenReview(athlete.last_submission_id)} onOpen={() => router.push({ pathname: '/(tabs)/coach-athlete/[athleteId]', params: { athleteId: String(athlete.id), athleteName: athlete.name } } as any)} />)}
    {!rows.length ? <Empty icon="checkmark-circle-outline" title="Every athlete is covered" body="All active roster athletes have at least one active Check-In form." /> : null}
    {data.forms.find((form) => form.is_active) ? <SLButton label="Assign Form" iconLeft="person-add-outline" fullWidth onPress={() => onAssign(data.forms.find((form) => form.is_active)!.id)} /> : null}
  </View>;
}

function AthleteCard({ athlete, onOpen, onReview }: { athlete: CoachCheckInAthlete; onOpen: () => void; onReview: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.cardTop}><Avatar athlete={athlete} /><View style={styles.flex}><Text style={styles.cardTitle}>{athlete.name}</Text><Text style={styles.meta}>{athlete.active_form_count} active form{athlete.active_form_count === 1 ? '' : 's'}</Text></View><Pill label={athlete.coverage_state === 'covered' ? 'COVERED' : athlete.coverage_state === 'overdue' ? 'OVERDUE' : 'NEEDS COVERAGE'} tone={athlete.coverage_state === 'covered' ? 'success' : athlete.coverage_state === 'overdue' ? 'danger' : 'warning'} /></View>
    {athlete.forms.map((form) => <View key={form.assignment_id} style={styles.assignmentLine}><Text style={styles.rowText}>{form.title}</Text><Text style={styles.meta}>{form.cadence_label}{form.due_time_local ? ` · ${form.due_time_local}` : ''}</Text></View>)}
    <View style={styles.metricRow}><Text style={[styles.meta, athlete.overdue_count ? { color: C.red } : null]}>{athlete.overdue_count ? `${athlete.overdue_count} overdue` : `Last submission: ${relative(athlete.last_submission_at)}`}</Text>{athlete.last_submission_id ? <Pressable hitSlop={10} onPress={(event) => { event.stopPropagation(); onReview(); }}><Text style={styles.link}>View response</Text></Pressable> : null}</View>
  </Pressable>;
}

function Inbox({ data, onOpen, router }: { data: CoachCheckInsCommandCenter; onOpen: (id: number) => void; router: ReturnType<typeof useRouter> }) {
  return <View style={styles.sectionStack}>
    <SectionHeading title="NEEDS REVIEW" count={data.inbox.needs_review.length} />
    {data.inbox.needs_review.map((row) => <SubmissionCard key={row.id} row={row} onOpen={() => onOpen(row.id)} />)}
    {!data.inbox.needs_review.length ? <Empty icon="checkmark-circle-outline" title="Inbox reviewed" body="No submitted Check-Ins are waiting for review." /> : null}
    <SectionHeading title="OVERDUE" count={data.inbox.overdue.length} />
    {data.inbox.overdue.map((row) => <OverdueCard key={row.id} row={row} onAthlete={() => row.athlete && router.push({ pathname: '/(tabs)/coach-athlete/[athleteId]', params: { athleteId: String(row.athlete.id), athleteName: row.athlete.name } } as any)} onMessage={() => row.athlete && router.push({ pathname: '/(tabs)/messages', params: { athleteId: String(row.athlete.id) } } as any)} />)}
    {!data.inbox.overdue.length ? <Text style={styles.quietEmpty}>No overdue responses.</Text> : null}
    {data.inbox.recently_reviewed.length ? <><SectionHeading title="RECENTLY REVIEWED" count={data.inbox.recently_reviewed.length} />{data.inbox.recently_reviewed.map((row) => <SubmissionCard key={row.id} row={row} onOpen={() => onOpen(row.id)} compact />)}</> : null}
  </View>;
}

function SubmissionCard({ row, onOpen, compact = false }: { row: CoachCheckInSubmissionCard; onOpen: () => void; compact?: boolean }) {
  const evidence = Object.values(row.evidence || {}).slice(0, 3);
  return <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.cardTop}>{row.athlete ? <Avatar athlete={row.athlete} /> : null}<View style={styles.flex}><Text style={styles.cardTitle}>{row.athlete?.name || 'Athlete'}</Text><Text style={styles.meta}>{row.form_title}</Text><Text style={styles.meta}>{row.submitted_at ? `Submitted ${relative(row.submitted_at)}` : `Due ${formatDate(row.due_at, true)}`}</Text></View><Ionicons name="chevron-forward" color={C.muted} size={20} /></View>
    {!compact && evidence.length ? <View style={styles.evidenceStrip}>{evidence.map((metric) => <View key={metric.label} style={styles.evidenceCell}><Text style={styles.evidenceValue}>{metric.value}</Text><Text style={styles.evidenceLabel}>{metric.label}</Text></View>)}</View> : null}
    {!compact && row.excerpt ? <Text numberOfLines={2} style={styles.quote}>“{row.excerpt}”</Text> : null}
  </Pressable>;
}

function OverdueCard({ row, onAthlete, onMessage }: { row: CoachCheckInSubmissionCard; onAthlete: () => void; onMessage: () => void }) {
  return <View style={[styles.card, styles.dangerCard]}><View style={styles.cardTop}>{row.athlete ? <Avatar athlete={row.athlete} /> : null}<View style={styles.flex}><Text style={styles.cardTitle}>{row.athlete?.name}</Text><Text style={styles.meta}>{row.form_title}</Text><Text style={[styles.meta, { color: C.red }]}>Due {formatDate(row.due_at, true)}</Text></View><Ionicons name="alert-circle" color={C.red} size={21} /></View><View style={styles.twoActions}><SLButton label="Message" variant="secondary" size="sm" style={styles.flex} onPress={onMessage} /><SLButton label="View Athlete" variant="secondary" size="sm" style={styles.flex} onPress={onAthlete} /></View></View>;
}

function TemplatePicker({ data, onBack, onCreated, onCustom }: { data: CoachCheckInsCommandCenter; onBack: () => void; onCreated: (next: CoachCheckInsCommandCenter) => void; onCustom: (template: CoachCheckInTemplate) => void }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const create = async (template: CoachCheckInTemplate) => {
    if (template.key === 'blank_custom') { onCustom(template); return; }
    setSaving(template.key); setError(null);
    const response = await createCoachCheckInForm({ template_key: template.key });
    setSaving(null);
    if (!response.ok || !response.json?.ok || !response.json.command_center) { setError(response.json?.error || 'Unable to create Check-In.'); return; }
    onCreated(response.json.command_center);
  };
  return <ScreenShell title="Create Check-In" subtitle="Choose a starting point" onBack={onBack}>
    {error ? <InlineError text={error} /> : null}
    <SectionHeading title="TEMPLATES" />
    {data.templates.map((template) => <Pressable key={template.key} disabled={saving != null} onPress={() => void create(template)} style={({ pressed }) => [styles.templateCard, pressed && styles.pressed]}><View style={[styles.iconTile, { backgroundColor: template.key === 'blank_custom' ? C.violetSoft : C.raised }]}>{saving === template.key ? <ActivityIndicator color={C.violet} /> : <Ionicons name={template.key === 'blank_custom' ? 'add' : 'document-text-outline'} color={C.violet} size={22} />}</View><View style={styles.flex}><Text style={styles.cardTitle}>{template.name}</Text><Text numberOfLines={2} style={styles.meta}>{template.description}</Text><Text style={styles.templateMeta}>{template.questions.length ? `${template.questions.length} questions · ${template.cadence}` : 'Build your own form'}</Text></View><Ionicons name="chevron-forward" color={C.muted} size={18} /></Pressable>)}
  </ScreenShell>;
}

function FormDetail({ data, form, onBack, onData, onAssign, onEdit, onAnalytics, onSubmissions }: { data: CoachCheckInsCommandCenter; form: CoachCheckInForm; onBack: () => void; onData: (data: CoachCheckInsCommandCenter) => void; onAssign: () => void; onEdit: () => void; onAnalytics: () => void; onSubmissions: () => void }) {
  const [actions, setActions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutate = async (kind: 'duplicate' | 'archive' | 'restore') => {
    setSaving(true); setError(null);
    const response = kind === 'duplicate' ? await duplicateCoachCheckInForm(form.id) : await changeCoachCheckInFormState(form.id, kind);
    setSaving(false);
    if (!response.ok || !response.json?.ok || !response.json.command_center) { setError(response.json?.error || 'Unable to update Check-In.'); return; }
    onData(response.json.command_center); setActions(false);
  };
  return <ScreenShell title={form.title} subtitle="Form settings" onBack={onBack} action={{ accessibilityLabel: 'Form actions', icon: 'ellipsis-horizontal', onPress: () => setActions(true) }}>
    {error ? <InlineError text={error} /> : null}
    <View style={styles.detailCard}><View style={styles.metricRow}><Text style={styles.eyebrow}>BASIC INFO</Text><Pill label={form.is_active ? 'ACTIVE' : 'ARCHIVED'} tone={form.is_active ? 'success' : 'neutral'} /></View><Info label="Name" value={form.title} /><Info label="Description" value={form.description || 'No description'} /><Info label="Cadence" value={form.cadence_label} /><Info label="Delivery" value={form.delivery_time_local ? `${form.delivery_time_local} · Athlete local time` : 'Not scheduled'} /><Info label="Questions" value={`${form.question_count} questions`} /><Info label="Assigned Athletes" value={`${form.assigned_athlete_count} athletes`} /></View>
    <View style={styles.detailCard}><Text style={styles.eyebrow}>PERFORMANCE</Text><MetricLine label="Submissions" value={String(form.submission_count)} /><MetricLine label="Completion Rate" value={form.completion_rate == null ? 'No data' : `${Math.round(form.completion_rate)}%`} /><MetricLine label="Average Response Time" value={form.average_response_hours == null ? 'No data' : `${form.average_response_hours}h`} /></View>
    <ActionRow icon="create-outline" label="Edit Form & Questions" onPress={onEdit} />
    <ActionRow icon="people-outline" label="Assign Athletes & Schedule" onPress={onAssign} />
    <ActionRow icon="mail-unread-outline" label="View Submissions" onPress={onSubmissions} />
    <ActionRow icon="analytics-outline" label="View Analytics" onPress={onAnalytics} />
    <StrengthLedgerBottomSheet accessibilityLabel="Check-In form actions" visible={actions} onDismiss={() => setActions(false)} heightFraction={0.48}>
      <View style={styles.sheetBody}><Text style={styles.sheetTitle}>Form Actions</Text><ActionRow icon="create-outline" label="Edit Form" onPress={() => { setActions(false); onEdit(); }} /><ActionRow icon="copy-outline" label="Duplicate Form" loading={saving} onPress={() => void mutate('duplicate')} /><ActionRow icon={form.is_active ? 'archive-outline' : 'refresh-outline'} label={form.is_active ? 'Archive Form' : 'Restore Form'} danger={form.is_active} loading={saving} onPress={() => void mutate(form.is_active ? 'archive' : 'restore')} /><Text style={styles.sheetNote}>Archive preserves historical submissions and disables future assignments.</Text></View>
    </StrengthLedgerBottomSheet>
  </ScreenShell>;
}

function FormBuilder({ data, form, template, onBack, onSaved }: { data: CoachCheckInsCommandCenter; form?: CoachCheckInForm; template?: CoachCheckInTemplate; onBack: () => void; onSaved: (data: CoachCheckInsCommandCenter, formId: number) => void }) {
  const [title, setTitle] = useState(form?.title || template?.title || '');
  const [description, setDescription] = useState(form?.description || template?.description || '');
  const [questions, setQuestions] = useState<CoachCheckInQuestion[]>(form?.questions || template?.questions || []);
  const [questionSheet, setQuestionSheet] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState(data.supported_question_types[0]?.key || 'scale');
  const [optionsText, setOptionsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const move = (index: number, delta: number) => setQuestions((current) => { const next = [...current]; const target = index + delta; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const choiceType = type === 'single_choice' || type === 'multi_choice';
  const parsedOptions = optionsText.split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
  const openNewQuestion = () => { setEditingQuestionIndex(null); setPrompt(''); setType(data.supported_question_types[0]?.key || 'scale'); setOptionsText(''); setQuestionSheet(true); };
  const openQuestion = (index: number) => { const question = questions[index]; setEditingQuestionIndex(index); setPrompt(question.prompt); setType(question.question_type); setOptionsText((question.options || []).join('\n')); setQuestionSheet(true); };
  const saveQuestion = () => {
    if (!prompt.trim() || (choiceType && parsedOptions.length < 2)) return;
    const nextQuestion = { prompt: prompt.trim(), question_type: type, question_type_label: data.supported_question_types.find((row) => row.key === type)?.label, required: true, options: choiceType ? parsedOptions : [], config: type === 'scale' ? { min: '1', max: '10' } : {} };
    setQuestions((current) => editingQuestionIndex == null ? [...current, nextQuestion] : current.map((question, index) => index === editingQuestionIndex ? { ...question, ...nextQuestion } : question));
    setPrompt(''); setOptionsText(''); setEditingQuestionIndex(null); setQuestionSheet(false);
  };
  const save = async () => {
    if (!title.trim() || !questions.length) { setError('Add a name and at least one question.'); return; }
    setSaving(true); setError(null);
    const response = form ? await updateCoachCheckInForm(form.id, { title: title.trim(), description: description.trim(), questions }) : await createCoachCheckInForm({ title: title.trim(), description: description.trim(), questions });
    setSaving(false);
    if (!response.ok || !response.json?.ok || !response.json.command_center || !response.json.form_id) { setError(response.json?.error || 'Unable to save Check-In.'); return; }
    onSaved(response.json.command_center, response.json.form_id);
  };
  return <ScreenShell title={form ? 'Edit Form' : 'Custom Check-In'} subtitle={title || 'Form builder'} onBack={onBack}>
    {error ? <InlineError text={error} /> : null}
    <Text style={styles.eyebrow}>BASIC INFO</Text><Field label="Name" value={title} onChangeText={setTitle} /><Field label="Description" value={description} onChangeText={setDescription} multiline />
    <View style={styles.metricRow}><SectionHeading title={`QUESTIONS (${questions.length})`} /><Text style={styles.link}>Reorder</Text></View>
    {questions.map((question, index) => <View key={`${question.id || 'new'}-${index}`} style={styles.questionRow}><View style={styles.questionNumber}><Text style={styles.questionNumberText}>{index + 1}</Text></View><View style={styles.flex}><Text style={styles.rowText}>{question.prompt}</Text><Text style={styles.meta}>{question.question_type_label || question.question_type.replace('_', ' ')}</Text></View><View style={styles.reorderButtons}><MiniIcon icon="create-outline" label="Edit question" onPress={() => openQuestion(index)} /><MiniIcon icon="chevron-up" label="Move question up" disabled={index === 0} onPress={() => move(index, -1)} /><MiniIcon icon="chevron-down" label="Move question down" disabled={index === questions.length - 1} onPress={() => move(index, 1)} /><MiniIcon icon="trash-outline" label="Delete question" danger onPress={() => setQuestions((current) => current.filter((_, rowIndex) => rowIndex !== index))} /></View></View>)}
    <SLButton label="Add Question" iconLeft="add" variant="secondary" fullWidth onPress={openNewQuestion} />
    <SLButton label={form ? 'Save Changes' : 'Create Check-In'} loading={saving} fullWidth onPress={() => void save()} />
    <StrengthLedgerBottomSheet accessibilityLabel="Add Check-In question" visible={questionSheet} onDismiss={() => setQuestionSheet(false)} heightFraction={0.78}>
      <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled"><Text style={styles.sheetTitle}>{editingQuestionIndex == null ? 'Add Question' : 'Edit Question'}</Text><Field label="Question" value={prompt} onChangeText={setPrompt} multiline /><Text style={styles.eyebrow}>RESPONSE TYPE</Text>{data.supported_question_types.map((row) => <Pressable key={row.key} onPress={() => setType(row.key)} style={({ pressed }) => [styles.typeRow, type === row.key && styles.selectedRow, pressed && styles.pressed]}><View style={styles.iconTile}><Ionicons name={questionIcons[row.key] || 'help-outline'} color={C.violet} size={20} /></View><Text style={styles.rowText}>{row.label}</Text>{type === row.key ? <Ionicons name="checkmark-circle" color={C.violet} size={20} /> : null}</Pressable>)}{choiceType ? <><Field label="Choices (one per line)" value={optionsText} onChangeText={setOptionsText} multiline placeholder={'Option 1\nOption 2'} />{parsedOptions.length < 2 ? <Text style={styles.sheetNote}>Add at least two choices.</Text> : null}</> : null}<SLButton label={editingQuestionIndex == null ? 'Add Question' : 'Save Question'} disabled={!prompt.trim() || (choiceType && parsedOptions.length < 2)} fullWidth onPress={saveQuestion} /></ScrollView>
    </StrengthLedgerBottomSheet>
  </ScreenShell>;
}

function AssignmentEditor({ data, form, onBack, onSaved }: { data: CoachCheckInsCommandCenter; form: CoachCheckInForm; onBack: () => void; onSaved: (data: CoachCheckInsCommandCenter) => void }) {
  const selectedInitial = new Set(form.assignments.filter((row) => row.active).map((row) => row.athlete_id));
  const [selected, setSelected] = useState(selectedInitial);
  const [cadence, setCadence] = useState(form.assignments.find((row) => row.active)?.cadence || 'weekly');
  const [time, setTime] = useState(form.assignments.find((row) => row.active)?.due_time_local || '18:00');
  const [weekday, setWeekday] = useState(form.assignments.find((row) => row.active)?.weekdays?.[0] ?? 6);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const visibleAthletes = data.athletes.filter((athlete) => athlete.name.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id: number) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const save = async () => { setSaving(true); setError(null); const response = await updateCoachCheckInAssignments(form.id, { athlete_ids: [...selected], cadence, weekdays: cadence === 'weekly' ? [weekday] : cadence === 'custom_weekdays' ? [weekday] : [], due_time_local: time, start_date: new Date().toISOString().slice(0, 10), replace: true }); setSaving(false); if (!response.ok || !response.json?.ok || !response.json.command_center) { setError(response.json?.error || 'Unable to assign Check-In.'); return; } onSaved(response.json.command_center); };
  return <ScreenShell title={`Assign ${form.title}`} subtitle="Coverage & schedule" onBack={onBack}>
    {error ? <InlineError text={error} /> : null}
    <Segmented value={selected.size === data.athletes.length && data.athletes.length ? 'all' : 'selected'} options={[{ key: 'all', label: 'All Athletes' }, { key: 'selected', label: `Selected (${selected.size})` }]} onChange={(key) => key === 'all' ? setSelected(new Set(data.athletes.map((row) => row.id))) : null} />
    <SearchField value={query} onChangeText={setQuery} placeholder="Search athletes" />
    {visibleAthletes.map((athlete) => <Pressable key={athlete.id} onPress={() => toggle(athlete.id)} style={({ pressed }) => [styles.athleteSelect, pressed && styles.pressed]}><View style={[styles.checkbox, selected.has(athlete.id) && styles.checkboxSelected]}>{selected.has(athlete.id) ? <Ionicons name="checkmark" color={C.text} size={15} /> : null}</View><Avatar athlete={athlete} /><View style={styles.flex}><Text style={styles.rowText}>{athlete.name}</Text><Text style={styles.meta}>{athlete.active_form_count} active forms</Text></View></Pressable>)}
    <SectionHeading title="SCHEDULE & CADENCE" />
    <Segmented value={cadence} options={data.supported_cadences.map((row) => ({ key: row.key, label: row.label }))} onChange={setCadence} />
    {(cadence === 'weekly' || cadence === 'custom_weekdays') ? <View style={styles.weekdays}>{['M','T','W','T','F','S','S'].map((label, index) => <Pressable key={`${label}-${index}`} onPress={() => setWeekday(index)} style={[styles.day, weekday === index && styles.daySelected]}><Text style={[styles.dayText, weekday === index && styles.dayTextSelected]}>{label}</Text></Pressable>)}</View> : null}
    <Field label="Delivery time (athlete local)" value={time} onChangeText={setTime} placeholder="18:00" />
    <Text style={styles.sheetNote}>Every athlete receives this Check-In in their saved local timezone. No server-time conversion is exposed to them.</Text>
    <SLButton label={`Assign to ${selected.size} Athlete${selected.size === 1 ? '' : 's'}`} disabled={!selected.size} loading={saving} fullWidth onPress={() => void save()} />
  </ScreenShell>;
}

function ResponseReview({ submissionId, onBack, onData, router }: { submissionId: number; onBack: () => void; onData: (data: CoachCheckInsCommandCenter) => void; router: ReturnType<typeof useRouter> }) {
  const [review, setReview] = useState<CoachCheckInReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  React.useEffect(() => { void (async () => { const response = await getCoachCheckInReview(submissionId); if (!response.ok || !response.json?.ok) setError(response.json?.error || 'Unable to open response.'); else { setReview(response.json); setNote(response.json.coach_interpretation || ''); } setLoading(false); })(); }, [submissionId]);
  const mark = async () => { setSaving(true); setError(null); const response = await markCoachCheckInReviewed(submissionId, { coach_interpretation: note.trim(), tags: review?.evidence.filter((row) => row.adverse).map((row) => row.semantic) || [] }); if (!response.ok || !response.json?.ok) { setError(response.json?.error || 'Unable to mark reviewed.'); setSaving(false); return; } const center = await getCoachCheckIns(); if (center.ok && center.json?.ok) onData(center.json); setSaving(false); onBack(); };
  if (loading) return <LoadingState />;
  if (!review) return <ErrorState error={error || 'Response unavailable.'} onRetry={onBack} />;
  const athlete = review.submission.athlete;
  return <ScreenShell title={review.submission.form_title} subtitle={athlete?.name || 'Check-In response'} onBack={onBack}>
    {error ? <InlineError text={error} /> : null}
    <Text style={styles.submittedLine}>Submitted {formatDate(review.submission.submitted_at, true)}</Text>
    <View style={[styles.readCard, review.check_in_read.tone === 'attention' ? styles.readAttention : styles.readPositive]}><Text style={styles.eyebrow}>CHECK-IN READ</Text><Text style={styles.readHeadline}>{review.check_in_read.headline}</Text><Text style={styles.readDetail}>{review.check_in_read.detail}</Text><Text style={styles.method}>Compared with {review.check_in_read.prior_submission_count} prior Check-In{review.check_in_read.prior_submission_count === 1 ? '' : 's'} · No causal claim</Text></View>
    {review.changes_since_last.length ? <><SectionHeading title="CHANGED SINCE LAST CHECK-IN" />{review.changes_since_last.map((change) => <View key={change.semantic} style={styles.changeRow}><Ionicons name={change.direction === 'increased' ? 'arrow-up' : 'arrow-down'} color={change.adverse ? C.red : C.green} size={17} /><Text style={styles.rowText}>{change.label} {change.direction}</Text><Text style={[styles.delta, { color: change.adverse ? C.red : C.green }]}>{change.delta > 0 ? '+' : ''}{change.delta}</Text></View>)}</> : null}
    <SectionHeading title="RAW RESPONSES" count={review.responses.length} />
    {review.responses.map((row, index) => <View key={row.question_id} style={styles.responseCard}><Text style={styles.responseNumber}>{index + 1}. {row.prompt}</Text><Text style={styles.responseValue}>{row.display_value}</Text>{row.prior_only_baseline != null ? <Text style={[styles.meta, row.adverse && { color: C.red }]}>vs {row.prior_only_baseline} prior-only baseline · {row.delta_from_baseline! > 0 ? '+' : ''}{row.delta_from_baseline}</Text> : <Text style={styles.meta}>No prior baseline</Text>}</View>)}
    <Field label="Coach interpretation / private review note" value={note} onChangeText={setNote} multiline />
    {athlete ? <AthleteCoachingScratchpadTrigger athleteId={athlete.id} athleteName={athlete.name} variant="card" /> : null}
    <View style={styles.actionGrid}><SLButton label="Message" variant="secondary" iconLeft="chatbubble-outline" style={styles.flex} onPress={() => athlete && router.push({ pathname: '/(tabs)/messages', params: { athleteId: String(athlete.id) } } as any)} /><SLButton label="Open Athlete" variant="secondary" iconLeft="person-outline" style={styles.flex} onPress={() => athlete && router.push({ pathname: '/(tabs)/coach-athlete/[athleteId]', params: { athleteId: String(athlete.id), athleteName: athlete.name } } as any)} /></View>
    <SLButton label="Review Programming" variant="secondary" iconLeft="calendar-outline" fullWidth onPress={() => athlete && router.push({ pathname: '/(tabs)/workout', params: { athleteId: String(athlete.id), athleteName: athlete.name } } as any)} />
    <SLButton label={review.actions.can_mark_reviewed ? 'Mark Reviewed' : 'Reviewed'} iconLeft="checkmark-circle-outline" disabled={!review.actions.can_mark_reviewed} loading={saving} fullWidth onPress={() => void mark()} />
  </ScreenShell>;
}

function FormAnalytics({ form, onBack }: { form: CoachCheckInForm; onBack: () => void }) {
  const [range, setRange] = useState<'4W' | '12W' | 'YTD'>('12W');
  const points = range === '4W' ? form.analytics.trend.slice(-4) : range === '12W' ? form.analytics.trend.slice(-12) : form.analytics.trend;
  return <ScreenShell title={form.title} subtitle="Performance" onBack={onBack}>
    <Segmented value={range} options={[{ key: '4W', label: '4W' }, { key: '12W', label: '12W' }, { key: 'YTD', label: 'YTD' }]} onChange={(value) => setRange(value as '4W' | '12W' | 'YTD')} />
    <MetricHero label="Completion Rate" value={form.analytics.completion_rate == null ? 'No data' : `${Math.round(form.analytics.completion_rate)}%`} accent={C.green} />
    <TrendChart points={points} metric="completion_rate" unit="%" max={100} />
    <MetricHero label="Average Response Time" value={form.analytics.average_response_hours == null ? 'No data' : `${form.analytics.average_response_hours}h`} accent={C.green} />
    <TrendChart points={points} metric="average_response_hours" unit="h" />
    <View style={styles.detailCard}><MetricLine label="Assigned athletes" value={String(form.assigned_athlete_count)} /><MetricLine label="Submissions" value={String(form.submission_count)} /><MetricLine label="Overdue rate" value={form.analytics.overdue_rate == null ? 'No data' : `${form.analytics.overdue_rate}%`} /></View>
  </ScreenShell>;
}

function TrendChart({ points, metric, unit, max }: { points: CoachCheckInForm['analytics']['trend']; metric: 'completion_rate' | 'average_response_hours'; unit: string; max?: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const values = points.map((row) => row[metric]).filter((value): value is number => value != null);
  const ceiling = max || Math.max(4, ...values.map((value) => Math.ceil(value / 4) * 4));
  const width = 340, height = 180, left = 44, right = 12, top = 12, bottom = 28;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const coordinates = points.map((row, index) => ({ x: left + (points.length <= 1 ? plotWidth / 2 : index / (points.length - 1) * plotWidth), y: row[metric] == null ? null : top + plotHeight - Math.min(ceiling, row[metric]!) / ceiling * plotHeight, row }));
  const path = coordinates.filter((row) => row.y != null).map((row, index) => `${index ? 'L' : 'M'} ${row.x} ${row.y}`).join(' ');
  return <View style={styles.chartCard}><Svg accessibilityLabel={`${metric.replace('_', ' ')} trend chart`} width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
    {[0, .5, 1].map((ratio) => { const y = top + plotHeight - ratio * plotHeight; return <React.Fragment key={ratio}><Line x1={left} y1={y} x2={width-right} y2={y} stroke={C.line} strokeWidth={1} /><SvgText x={left-7} y={y+4} fill={C.muted} fontSize="10" textAnchor="end">{Math.round(ceiling*ratio)}{unit}</SvgText></React.Fragment>; })}
    <Line x1={left} y1={top} x2={left} y2={top+plotHeight} stroke={C.muted} strokeWidth={1} /><Line x1={left} y1={top+plotHeight} x2={width-right} y2={top+plotHeight} stroke={C.muted} strokeWidth={1} />
    {path ? <Path d={path} fill="none" stroke={C.green} strokeWidth={2.5} /> : null}
    {coordinates.map((point, index) => point.y == null ? null : <Circle accessibilityLabel={`${formatDate(point.row.week_start)} ${point.row[metric]}${unit}`} key={point.row.week_start} onPress={() => setSelected(index)} cx={point.x} cy={point.y} r={selected === index ? 6 : index === coordinates.length-1 ? 5 : 3.5} fill={selected === index ? C.green : C.surface} stroke={C.green} strokeWidth={2} />)}
    {points.length ? <><SvgText x={left} y={height-8} fill={C.muted} fontSize="10">{formatDate(points[0].week_start)}</SvgText><SvgText x={width-right} y={height-8} fill={C.muted} fontSize="10" textAnchor="end">{formatDate(points[points.length-1].week_start)}</SvgText></> : null}
  </Svg><Text style={styles.chartHint}>{selected != null && points[selected]?.[metric] != null ? `${formatDate(points[selected].week_start)} · ${points[selected][metric]}${unit}` : points.length ? 'Weekly axis · tap a point for exact evidence' : 'No submissions in this window.'}</Text></View>;
}

function ScreenShell({ title, subtitle, onBack, action, children }: { title: string; subtitle?: string; onBack: () => void; action?: SLContextualHeaderAction; children: React.ReactNode }) {
  return <ScrollView style={styles.screen} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><SLContextualHeader action={action} onBack={onBack} subtitle={subtitle} title={title} />{children}</ScrollView>;
}

function Segmented({ value, options, onChange }: { value: string; options: { key: string; label: string }[]; onChange: (key: string) => void }) {
  return <SLCompactTabRail items={options} onSelect={onChange} selectedKey={value} />;
}

function Avatar({ athlete }: { athlete: { name: string; avatar_url?: string | null } }) { return athlete.avatar_url ? <Image source={{ uri: athlete.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{athlete.name.split(/\s+/).map((part) => part[0]).slice(0,2).join('').toUpperCase()}</Text></View>; }
function IconButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) { return <Pressable accessibilityLabel={label} accessibilityRole="button" hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons name={icon} color={C.text} size={24} /></Pressable>; }
function MiniIcon({ icon, label, onPress, disabled, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) { return <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.miniIcon, pressed && styles.pressed, disabled && styles.disabled]}><Ionicons name={icon} color={danger ? C.red : C.muted} size={16} /></Pressable>; }
function SectionHeading({ title, count }: { title: string; count?: number }) { return <View style={styles.sectionHeading}><Text style={styles.eyebrow}>{title}</Text>{count != null ? <Text style={styles.sectionCount}>{count}</Text> : null}</View>; }
function Pill({ label, tone }: { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }) { const color = tone === 'success' ? C.green : tone === 'danger' ? C.red : tone === 'warning' ? C.amber : C.muted; return <View style={[styles.pill, { borderColor: color }]}><Text style={[styles.pillText, { color }]}>{label}</Text></View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.meta}>{label}</Text><Text style={styles.rowText}>{value}</Text></View>; }
function MetricLine({ label, value }: { label: string; value: string }) { return <View style={styles.metricRow}><Text style={styles.meta}>{label}</Text><Text style={styles.rowText}>{value}</Text></View>; }
function MetricHero({ label, value, accent }: { label: string; value: string; accent: string }) { return <View style={styles.metricHero}><Text style={styles.eyebrow}>{label}</Text><Text style={[styles.heroValue, { color: accent }]}>{value}</Text></View>; }
function Field({ label, value, onChangeText, multiline, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; placeholder?: string }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} placeholder={placeholder} placeholderTextColor={C.subtle} style={[styles.input, multiline && styles.multiline]} /></View>; }
function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) { return <View style={styles.search}><Ionicons name="search" color={C.muted} size={18} /><TextInput accessibilityLabel={placeholder} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.subtle} style={styles.searchInput} /></View>; }
function ActionRow({ icon, label, onPress, danger, loading }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean; loading?: boolean }) { return <Pressable accessibilityRole="button" disabled={loading} onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>{loading ? <ActivityIndicator color={C.violet} /> : <Ionicons name={icon} color={danger ? C.red : C.violet} size={20} />}<Text style={[styles.rowText, danger && { color: C.red }]}>{label}</Text><Ionicons name="chevron-forward" color={C.muted} size={17} /></Pressable>; }
function Empty({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) { return <View style={styles.empty}><Ionicons name={icon} color={C.muted} size={28} /><Text style={styles.cardTitle}>{title}</Text><Text style={styles.meta}>{body}</Text></View>; }
function InlineError({ text }: { text: string }) { return <View style={styles.error}><Ionicons name="alert-circle-outline" color={C.red} size={18} /><Text style={styles.errorText}>{text}</Text></View>; }
function LoadingState() { return <View style={styles.center}><ActivityIndicator color={C.violet} size="large" /><Text style={styles.meta}>Loading Coach Check-Ins…</Text></View>; }
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) { return <View style={styles.center}><InlineError text={error} /><SLButton label="Try Again" onPress={onRetry} /></View>; }

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.canvas}, page:{paddingTop:12,paddingBottom:120,gap:12}, center:{flex:1,minHeight:560,backgroundColor:C.canvas,alignItems:'center',justifyContent:'center',gap:14,padding:24}, flex:{flex:1}, disabled:{opacity:.35}, pressed:{opacity:.78,transform:[{scale:.99}]},
  titleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, pageTitle:{color:C.text,fontFamily:SLFontFamilies.display,fontSize:30,fontWeight:'700'}, subtitle:{color:C.muted,fontSize:13,marginTop:2},
  iconButton:{width:46,height:46,borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:C.surface,alignItems:'center',justifyContent:'center'}, miniIcon:{width:30,height:30,borderRadius:9,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},
  snapshot:{flexDirection:'row',borderWidth:1,borderColor:C.line,borderRadius:14,overflow:'hidden',backgroundColor:C.surface}, snapshotCell:{flex:1,alignItems:'center',paddingVertical:12,borderRightWidth:StyleSheet.hairlineWidth,borderRightColor:C.line}, snapshotValue:{fontSize:22,fontWeight:'700'}, snapshotLabel:{color:C.muted,fontSize:9,textAlign:'center',lineHeight:12,textTransform:'uppercase',marginTop:3},
  sectionStack:{gap:10}, sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:5}, eyebrow:{color:C.violet,fontSize:11,fontWeight:'700',letterSpacing:.7}, sectionCount:{color:C.muted,fontSize:13},
  card:{borderWidth:1,borderColor:C.line,borderRadius:14,backgroundColor:C.surface,padding:12,gap:10}, dangerCard:{borderColor:'rgba(255,90,104,.38)'}, cardTop:{flexDirection:'row',alignItems:'center',gap:10}, cardTitle:{color:C.text,fontSize:16,fontWeight:'700'}, meta:{color:C.muted,fontSize:12,lineHeight:17}, rowText:{color:C.text,fontSize:14,fontWeight:'600'}, iconTile:{width:42,height:42,borderRadius:11,backgroundColor:C.raised,alignItems:'center',justifyContent:'center'},
  metricRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}, metricStrong:{color:C.text,fontSize:12,fontWeight:'600'}, track:{height:4,borderRadius:2,backgroundColor:C.line,overflow:'hidden'}, trackFill:{height:'100%',backgroundColor:C.green}, pill:{borderWidth:1,borderRadius:8,paddingHorizontal:7,paddingVertical:3}, pillText:{fontSize:9,fontWeight:'700'},
  coverageCard:{borderWidth:1,borderColor:C.line,borderRadius:14,backgroundColor:C.surface,padding:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, coveragePercent:{color:C.green,fontSize:24,fontWeight:'700'}, avatar:{width:44,height:44,borderRadius:12,backgroundColor:C.raised}, avatarFallback:{width:44,height:44,borderRadius:12,backgroundColor:C.violetSoft,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.violet}, avatarText:{color:C.text,fontSize:13,fontWeight:'700'},
  assignmentLine:{paddingLeft:54,gap:2}, link:{color:C.violet,fontSize:12,fontWeight:'600'}, evidenceStrip:{flexDirection:'row',borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.line,paddingTop:10}, evidenceCell:{flex:1}, evidenceValue:{color:C.text,fontSize:16,fontWeight:'700'}, evidenceLabel:{color:C.muted,fontSize:9,textTransform:'uppercase'}, quote:{color:C.muted,fontSize:12,lineHeight:17,fontStyle:'italic'}, twoActions:{flexDirection:'row',gap:8}, quietEmpty:{color:C.subtle,fontSize:12,textAlign:'center',paddingVertical:8},
  templateCard:{flexDirection:'row',alignItems:'center',gap:11,borderWidth:1,borderColor:C.line,borderRadius:13,backgroundColor:C.surface,padding:11}, templateMeta:{color:C.violet,fontSize:10,marginTop:4}, detailCard:{borderWidth:1,borderColor:C.line,borderRadius:14,backgroundColor:C.surface,padding:13,gap:11}, info:{gap:2,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line,paddingBottom:9},
  actionRow:{minHeight:52,borderWidth:1,borderColor:C.line,borderRadius:12,backgroundColor:C.surface,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:11}, sheetBody:{paddingHorizontal:16,paddingBottom:40,gap:10}, sheetTitle:{color:C.text,fontSize:22,fontWeight:'700'}, sheetNote:{color:C.muted,fontSize:11,lineHeight:16},
  field:{gap:6}, fieldLabel:{color:C.muted,fontSize:11,textTransform:'uppercase'}, input:{minHeight:48,borderRadius:11,borderWidth:1,borderColor:C.line,backgroundColor:C.surface,color:C.text,paddingHorizontal:12,paddingVertical:10,fontSize:14}, multiline:{minHeight:84,textAlignVertical:'top'},
  search:{minHeight:46,borderRadius:12,borderWidth:1,borderColor:C.line,backgroundColor:C.surface,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:9}, searchInput:{flex:1,color:C.text,fontSize:14,paddingVertical:9},
  questionRow:{flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:C.line,borderRadius:12,backgroundColor:C.surface,padding:10}, questionNumber:{width:26,height:26,borderRadius:13,backgroundColor:C.violetSoft,alignItems:'center',justifyContent:'center'}, questionNumberText:{color:C.green,fontSize:11,fontWeight:'700'}, reorderButtons:{flexDirection:'row',gap:4}, typeRow:{minHeight:56,flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:C.line,borderRadius:12,padding:9}, selectedRow:{borderColor:C.violet,backgroundColor:C.violetSoft},
  athleteSelect:{minHeight:64,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line,paddingVertical:8}, checkbox:{width:22,height:22,borderRadius:5,borderWidth:1,borderColor:C.muted,alignItems:'center',justifyContent:'center'}, checkboxSelected:{backgroundColor:C.violet,borderColor:C.violet}, weekdays:{flexDirection:'row',justifyContent:'space-between'}, day:{width:40,height:40,borderRadius:10,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'}, daySelected:{backgroundColor:C.violetSoft,borderColor:C.violet}, dayText:{color:C.muted,fontSize:12}, dayTextSelected:{color:C.text,fontWeight:'700'},
  submittedLine:{color:C.muted,fontSize:12,textAlign:'center'}, readCard:{borderWidth:1,borderRadius:14,padding:14,gap:7}, readAttention:{borderColor:'rgba(241,183,66,.45)',backgroundColor:'rgba(241,183,66,.07)'}, readPositive:{borderColor:'rgba(74,210,138,.38)',backgroundColor:'rgba(74,210,138,.06)'}, readHeadline:{color:C.text,fontSize:18,fontWeight:'700'}, readDetail:{color:C.text,fontSize:13,lineHeight:19}, method:{color:C.muted,fontSize:10,lineHeight:14}, changeRow:{minHeight:44,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line}, delta:{fontSize:13,fontWeight:'700'}, responseCard:{borderWidth:1,borderColor:C.line,borderRadius:12,backgroundColor:C.surface,padding:12,gap:6}, responseNumber:{color:C.muted,fontSize:11}, responseValue:{color:C.text,fontSize:19,fontWeight:'700'}, actionGrid:{flexDirection:'row',gap:8},
  metricHero:{paddingVertical:5}, heroValue:{fontSize:30,fontWeight:'700',marginTop:5}, chartCard:{borderWidth:1,borderColor:C.line,borderRadius:14,backgroundColor:C.surface,padding:8}, chartHint:{color:C.muted,fontSize:10,textAlign:'center'},
  empty:{alignItems:'center',gap:7,borderWidth:1,borderStyle:'dashed',borderColor:C.line,borderRadius:14,padding:24}, error:{flexDirection:'row',alignItems:'center',gap:8,borderWidth:1,borderColor:'rgba(255,90,104,.4)',backgroundColor:'rgba(255,90,104,.07)',borderRadius:11,padding:11}, errorText:{color:'#FFC3C8',fontSize:12,flex:1},
});
