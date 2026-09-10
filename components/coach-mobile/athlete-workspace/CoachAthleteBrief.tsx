import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import { Text } from '@/components/ui/sl-text';
import { SLFontFamilies, SLLayout, SLRadius, SLSpacing } from '@/constants/theme';
import { LEDGER_INDEX_ASSETS } from '@/lib/ledger-index-assets';
import { workspaceLedgerParams } from '@/lib/coach-performance';
import { INK, PerformanceLoading, StrengthHero } from './PerformanceVisuals';
import { formatCoachRelativeDate } from '@/lib/coach-mobile-v2';

import { useCoachAthleteWorkspace } from './CoachAthleteWorkspaceContext';

type ActionRow = {
  key: string;
  title: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  onPress: () => void;
};

function dateLabel(value?: string | null) {
  if (!value) return 'Not established';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function CoachAthleteBrief() {
  const router = useRouter();
  const workspace = useCoachAthleteWorkspace();
  const [allActions, setAllActions] = useState(false);
  const { bootstrap, summary } = workspace;
  if (!bootstrap || !summary) return null;
  const basePath = `/(tabs)/coach-athlete/${workspace.athleteId}`;
  const training = summary.current_training || bootstrap.current_training || {};
  const reviews = Number(summary.pending_session_reviews.count || 0) + Number(summary.pending_video_reviews.count || 0);

  const actions: ActionRow[] = (() => {
    const rows: ActionRow[] = [];
    let hasMessageAction = false;
    for (const reason of summary.operational_status.reasons || []) {
      const raw = reason as any;
      const kind = String(raw.reason_type || raw.kind || 'attention');
      const reviewsReason = kind.includes('review') || kind.includes('video');
      const messageReason = kind.includes('message');
      hasMessageAction = hasMessageAction || messageReason;
      const programmingReason = kind.includes('program') || kind.includes('missed') || kind.includes('incomplete');
      rows.push({
        key: `${kind}:${raw.workout_id || raw.title || raw.label || rows.length}`,
        title: raw.title || raw.label || 'Review athlete evidence',
        detail: raw.supporting_text || raw.detail || 'Open the athlete record.',
        icon: reviewsReason ? 'checkmark-done-outline' : messageReason ? 'chatbubble-ellipses-outline' : programmingReason ? 'calendar-outline' : 'alert-circle-outline',
        tone: String(raw.severity || raw.priority || '').includes('high') ? COACH_V2.magenta : COACH_V2.gold,
        onPress: () => {
          if (reviewsReason) router.push(`${basePath}/reviews` as any);
          else if (messageReason) router.push(`${basePath}/messages` as any);
          else router.push(`${basePath}/training` as any);
        },
      });
    }
    const unreadMessages = Number(summary.unread_messages?.count || 0);
    if (unreadMessages > 0 && !hasMessageAction) {
      rows.push({
        key: 'unread-messages',
        title: `${unreadMessages} unread athlete message${unreadMessages === 1 ? '' : 's'}`,
        detail: 'See what the athlete sent you.',
        icon: 'chatbubble-ellipses-outline',
        tone: COACH_V2.cyan,
        onPress: () => router.push(`${basePath}/messages` as any),
      });
    }
    for (const checkIn of bootstrap.check_ins.items || []) {
      rows.push({
        key: `check-in:${checkIn.submission_id}`,
        title: `${checkIn.title} submitted`,
        detail: checkIn.submitted_at ? `Submitted ${formatCoachRelativeDate(checkIn.submitted_at)}` : 'Awaiting coach review',
        icon: 'clipboard-outline',
        tone: COACH_V2.gold,
        onPress: () => router.push(`${basePath}/reviews` as any),
      });
    }
    return rows;
  })();

  const decisions = (() => {
    const rows: Array<{ key: string; title: string; detail: string; onPress: () => void }> = [];
    const days = summary.programming_horizon.days_remaining;
    if (days == null || days <= 7) rows.push({
      key: 'programming',
      title: days == null ? 'Programming horizon not established' : days <= 0 ? 'Program through-date reached' : `Programming ends in ${days} day${days === 1 ? '' : 's'}`,
      detail: `${summary.programming_horizon.sessions_remaining ?? 0} assigned Session${summary.programming_horizon.sessions_remaining === 1 ? '' : 's'} remaining`,
      onPress: () => router.push(`${basePath}/training` as any),
    });
    if (summary.meet_context?.meet_date) rows.push({
      key: 'meet',
      title: summary.meet_context.meet_name || 'Upcoming meet',
      detail: `${dateLabel(summary.meet_context.meet_date)} · ${summary.meet_context.days_until_meet ?? '—'} days out`,
      onPress: () => router.push(`${basePath}/training` as any),
    });
    if (reviews > 0) rows.push({
      key: 'reviews',
      title: `${reviews} review${reviews === 1 ? '' : 's'} waiting`,
      detail: 'Session and video evidence requiring a coach decision',
      onPress: () => router.push(`${basePath}/reviews` as any),
    });
    return rows;
  })();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={workspace.refreshing} tintColor={COACH_V2.violetBright} onRefresh={() => { workspace.reloadPerformance(); void workspace.reload(true); }} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.intro}>
        <Text style={styles.kicker}>IN THEIR CORNER</Text>
        <Text style={styles.title}>Your coaching brief</Text>
        <Text style={styles.body}>{training.program_name || "The next decision starts here."}{training.block_name ? ` · ${training.block_name}` : ""}</Text>
      </View>

      {workspace.performance ? <StrengthHero data={workspace.performance} unit={workspace.unit} compact
        onPress={() => router.push(`${basePath}/performance` as any)}
        onLiftPress={(lift) => router.push({ pathname: '/(tabs)/ledger/strength', params: { ...workspaceLedgerParams(workspace.athleteId, 'brief'), lift } } as any)} />
        : <PerformanceLoading error={workspace.performanceError} onRetry={workspace.reloadPerformance} />}
      {workspace.performance ? <View style={styles.pulseRow}><View style={styles.pulseItem}><Text style={styles.pulseValue}>{workspace.performance.consistency?.completion_rate_pct == null ? '—' : `${Math.round(workspace.performance.consistency.completion_rate_pct)}%`}</Text><Text style={styles.body}>execution</Text></View><View style={styles.pulseDivider} /><View style={styles.pulseItem}><Text style={[styles.pulseValue, { color: INK.cyan }]}>{workspace.performance.coaching_context.readiness.at(-1)?.value ?? '—'}<Text style={styles.pulseSuffix}> / 5</Text></Text><Text style={styles.body}>latest readiness</Text></View></View> : null}

      <Section title="Needs Your Action" meta={actions.length ? `${actions.length} open` : 'Clear'}>
        {actions.length ? (allActions ? actions : actions.slice(0, 3)).map(({ key, ...row }) => <Action key={key} {...row} />) : (
          <Empty icon="checkmark-circle-outline" text="You’re up to date. The athlete record is ready when you are." tone={COACH_V2.green} />
        )}
      </Section>

      {actions.length > 3 ? <Pressable accessibilityRole="button" onPress={() => setAllActions((value) => !value)} style={styles.moreActions}><Text style={styles.sectionAction}>{allActions ? 'Show fewer actions' : `Show all ${actions.length} actions`} →</Text></Pressable> : null}

      <Section title="On the program" action="Open Training" onAction={() => router.push(`${basePath}/training` as any)}>
        <View style={styles.programHero}>
          <Image source={LEDGER_INDEX_ASSETS.chapter.journey} style={styles.programArt} />
          <View style={styles.flex}>
            <Text style={styles.programName}>{training.program_name || 'No active program'}</Text>
            <Text style={styles.body}>{[
              training.block_name,
              training.week_position && training.week_total ? `Week ${training.week_position} of ${training.week_total}` : null,
            ].filter(Boolean).join(' · ') || 'Program position is not established.'}</Text>
          </View>
        </View>
        <View style={styles.factRow}>
          <Fact label="Programmed through" value={dateLabel(summary.programming_horizon.programmed_through_date)} />
          <Fact label="Sessions remaining" value={String(summary.programming_horizon.sessions_remaining ?? '—')} />
          <Fact label="Next Session" value={summary.next_assigned_session?.label || 'None assigned'} />
        </View>
      </Section>

      <Section title="Between you two" action="Open Messages" onAction={() => router.push(`${basePath}/messages` as any)}>
        <Conversation label="ATHLETE" message={bootstrap.conversation.latest_athlete_message?.body_preview} when={bootstrap.conversation.latest_athlete_message?.created_at} />
        <Conversation label="COACH" message={bootstrap.conversation.latest_coach_reply?.body_preview} when={bootstrap.conversation.latest_coach_reply?.created_at} />
        {summary.coach_context.pinned_note ? (
          <Pressable onPress={() => router.push(`${basePath}/notes` as any)} style={styles.note}>
            <Ionicons color={COACH_V2.gold} name="pin-outline" size={18} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{summary.coach_context.pinned_note.title || 'Pinned coach note'}</Text>
              <Text numberOfLines={3} style={styles.body}>{summary.coach_context.pinned_note.body_preview || 'Open note'}</Text>
            </View>
            <Ionicons color={COACH_V2.muted} name="chevron-forward" size={17} />
          </Pressable>
        ) : summary.coach_context.scratchpad?.body_preview ? (
          <Pressable onPress={() => router.push(`${basePath}/notes` as any)} style={styles.note}>
            <Ionicons color={COACH_V2.violetBright} name="create-outline" size={18} />
            <Text numberOfLines={3} style={[styles.body, styles.flex]}>{summary.coach_context.scratchpad.body_preview}</Text>
            <Ionicons color={COACH_V2.muted} name="chevron-forward" size={17} />
          </Pressable>
        ) : null}
      </Section>

      <Section title="Upcoming Decisions">
        {decisions.length ? decisions.map((decision) => (
          <Pressable key={decision.key} onPress={decision.onPress} style={styles.decision}>
            <View style={styles.decisionMarker} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{decision.title}</Text>
              <Text style={styles.body}>{decision.detail}</Text>
            </View>
            <Ionicons color={COACH_V2.muted} name="chevron-forward" size={17} />
          </Pressable>
        )) : <Empty icon="time-outline" text="No upcoming decision is waiting. Keep the next training chapter in view." tone={COACH_V2.cyan} />}
      </Section>
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

function Section({ title, meta, action, onAction, children }: { title: string; meta?: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && onAction ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Action({ title, detail, icon, tone, onPress }: Omit<ActionRow, 'key'>) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
      <View style={[styles.actionIcon, { backgroundColor: `${tone}18` }]}><Ionicons color={tone} name={icon} size={19} /></View>
      <View style={styles.flex}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.body}>{detail}</Text></View>
      <Ionicons color={COACH_V2.muted} name="chevron-forward" size={17} />
    </Pressable>
  );
}

function Empty({ icon, text, tone }: { icon: keyof typeof Ionicons.glyphMap; text: string; tone: string }) {
  return <View style={styles.empty}><Ionicons color={tone} name={icon} size={20} /><Text style={[styles.body, styles.flex]}>{text}</Text></View>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><Text numberOfLines={2} style={styles.factValue}>{value}</Text><Text style={styles.factLabel}>{label}</Text></View>;
}

function Conversation({ label, message, when }: { label: string; message?: string | null; when?: string | null }) {
  return (
    <View style={styles.conversation}>
      <View style={styles.conversationTop}><Text style={styles.conversationLabel}>{label}</Text>{when ? <Text style={styles.conversationWhen}>{formatCoachRelativeDate(when)}</Text> : null}</View>
      <Text numberOfLines={3} style={styles.body}>{message || 'No recent message in this relationship.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingHorizontal: SLLayout.screenGutter, paddingTop: 18, paddingBottom: 155 },
  intro: { paddingHorizontal: 2, paddingTop: 2 },
  title: { color: INK.text, fontFamily: SLFontFamilies.display, fontSize: 33, marginTop: 5 },
  kicker: { color: INK.violet, fontSize: 11, letterSpacing: 1.5 },
  pulseRow: { flexDirection: 'row', gap: 24, paddingVertical: 6, paddingHorizontal: 8 },
  pulseItem: { flex: 1 },
  pulseDivider: { width: 1, backgroundColor: INK.line },
  pulseValue: { color: INK.green, fontFamily: SLFontFamilies.numeric, fontSize: 26 },
  pulseSuffix: { color: INK.muted, fontSize: 15 },
  moreActions: { minHeight: 44, justifyContent: 'center' },
  programArt: { width: 75, height: 80, resizeMode: 'contain' },
  section: { borderTopColor: INK.line, borderTopWidth: 1, paddingTop: 23, marginTop: 8 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: INK.text, flex: 1, fontFamily: SLFontFamilies.display, fontSize: 23 },
  sectionAction: { color: COACH_V2.violetBright, fontSize: 12, fontWeight: '800' },
  sectionMeta: { color: COACH_V2.muted, fontSize: 12, fontWeight: '700' },
  actionRow: { alignItems: 'center', borderTopColor: COACH_V2.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 11, minHeight: 62, paddingVertical: 10 },
  actionIcon: { alignItems: 'center', borderRadius: 12, height: 38, justifyContent: 'center', width: 38 },
  flex: { flex: 1, minWidth: 0 },
  rowTitle: { color: COACH_V2.text, fontSize: 14, fontWeight: '800' },
  body: { color: COACH_V2.muted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  pressed: { opacity: 0.72 },
  empty: { alignItems: 'center', backgroundColor: COACH_V2.surfaceRaised, borderRadius: SLRadius.md, flexDirection: 'row', gap: 10, padding: 13 },
  programHero: { alignItems: 'center', backgroundColor: '#0E0A15', borderRadius: 20, flexDirection: 'row', gap: 10, padding: 12 },
  programName: { color: COACH_V2.text, fontSize: 17, fontWeight: '800' },
  factRow: { borderTopColor: COACH_V2.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', marginTop: 12, paddingTop: 12 },
  fact: { borderRightColor: COACH_V2.border, borderRightWidth: StyleSheet.hairlineWidth, flex: 1, paddingHorizontal: 7 },
  factValue: { color: COACH_V2.text, fontSize: 13, fontWeight: '800' },
  factLabel: { color: COACH_V2.subtle, fontSize: 12, fontWeight: '500', marginTop: 5 },
  conversation: { borderTopColor: COACH_V2.border, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  conversationTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  conversationLabel: { color: COACH_V2.violetBright, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  conversationWhen: { color: COACH_V2.subtle, fontSize: 10 },
  note: { alignItems: 'center', backgroundColor: COACH_V2.surfaceRaised, borderRadius: SLRadius.md, flexDirection: 'row', gap: 10, marginTop: 8, padding: 12 },
  decision: { alignItems: 'center', borderTopColor: COACH_V2.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 11, minHeight: 58, paddingVertical: 9 },
  decisionMarker: { backgroundColor: COACH_V2.violetBright, borderRadius: 4, height: 24, width: 3 },
  bottomSpace: { height: SLSpacing.xl },
});
