import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ImageBackground,
  LayoutAnimation,
  Platform,
  RefreshControl,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SLContextualHeader } from '@/components/ui';
import { SLMotionEntrance, SLMotionPressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLMotion, SLTypography } from '@/constants/theme';
import { useSLReducedMotion } from '@/lib/motion';
import type {
  ProgramTimelineBlock,
  ProgramTimelineLifecycle,
  ProgramTimelinePayload,
  ProgramTimelineSession,
  ProgramTimelineWeek,
} from '@/lib/program-timeline';

const PROGRAM_ART = require('@/assets/images/ledger-index-v2/ledger-hero-plate-v1.png');

const lifecycleTone: Record<ProgramTimelineLifecycle, string> = {
  completed: SLColors.success,
  in_progress: SLColors.accentViolet,
  today: SLColors.accentViolet,
  upcoming: SLColors.textMuted,
  missed: SLColors.accentRed,
  no_session: SLColors.textSubtle,
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function lifecycleLabel(value: ProgramTimelineLifecycle) {
  if (value === 'completed') return 'Complete';
  if (value === 'in_progress') return 'In progress';
  if (value === 'today') return 'Current';
  if (value === 'upcoming') return 'Upcoming';
  if (value === 'missed') return 'Missed';
  return 'No Sessions';
}

function blockTone(status: ProgramTimelineBlock['status']) {
  if (status === 'completed') return lifecycleTone.completed;
  if (status === 'current') return SLColors.accentViolet;
  return SLColors.textMuted;
}

function sessionEvidence(session: ProgramTimelineSession) {
  const count = session.lifecycle === 'completed' ? session.setCount : session.plannedSetCount;
  return count == null ? null : `${count} ${session.lifecycle === 'completed' ? 'saved' : 'prescribed'} set${count === 1 ? '' : 's'}`;
}

function weekFingerprint(week: ProgramTimelineWeek) {
  if (week.programmingState === 'unbuilt') return 'NO SESSIONS';
  if (week.lifecycle === 'missed') return 'MISSED';
  if (week.lifecycle === 'completed') return 'COMPLETE';
  if (week.lifecycle === 'upcoming') return 'PLANNED';
  return `${week.completedCount}/${week.sessionCount} COMPLETE`;
}

function configureMapLayout(reduceMotion: boolean) {
  if (reduceMotion) return;
  LayoutAnimation.configureNext({
    duration: SLMotion.componentMs,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}

const WeekNode = memo(function WeekNode({
  week,
  selected,
  expanded,
  onPress,
}: {
  week: ProgramTimelineWeek;
  selected: boolean;
  expanded: boolean;
  onPress: (week: ProgramTimelineWeek) => void;
}) {
  const tone = week.current ? SLColors.accentViolet : lifecycleTone[week.lifecycle];
  const unbuilt = week.programmingState === 'unbuilt';
  return (
    <SLMotionPressable
      accessibilityHint="Opens this Week into its Sessions"
      accessibilityLabel={`Week ${week.number}, ${week.dateRangeLabel}, ${weekFingerprint(week)}`}
      accessibilityRole="button"
      accessibilityState={{ expanded, selected }}
      onPress={() => onPress(week)}
      pressScale={0.99}
      style={[
        styles.weekNode,
        unbuilt && styles.weekNodeUnbuilt,
        selected && styles.weekNodeSelected,
        week.current && styles.weekNodeCurrent,
      ]}
    >
      <View style={[styles.weekNodeStatus, { backgroundColor: unbuilt ? SLColors.textSubtle : tone }]} />
      <Text style={[styles.weekNodeNumber, { color: week.current ? tone : SLColors.textStrong }]}>W{String(week.number).padStart(2, '0')}</Text>
      <View style={styles.weekNodeCopy}>
        <Text style={styles.weekNodeDate}>{week.dateRangeLabel}</Text>
        <Text style={styles.weekNodeSets}>{week.sessionCount ? `${week.sessionCount} Session${week.sessionCount === 1 ? '' : 's'}${week.plannedSetCount ? ` · ${week.plannedSetCount} sets` : ''}` : 'No Sessions planned'}</Text>
      </View>
      <View style={styles.weekNodeState}>{!unbuilt || week.current ? <Text style={{ ...styles.weekNodeFingerprint, color: week.current ? tone : SLColors.textMuted }}>{week.current ? 'CURRENT' : weekFingerprint(week)}</Text> : null}<Ionicons color={SLColors.textMuted} name={expanded ? 'chevron-up' : 'chevron-down'} size={15} /></View>
    </SLMotionPressable>
  );
});

const SessionNode = memo(function SessionNode({
  session,
  dayLabel,
  index,
  onPress,
}: {
  session: ProgramTimelineSession;
  dayLabel: string;
  index: number;
  onPress: (session: ProgramTimelineSession) => void;
}) {
  const tone = lifecycleTone[session.lifecycle];
  const names = session.movementNames || [];
  const movementSummary = names.length ? `${names.slice(0, 3).join(' · ')}${names.length > 3 ? ` +${names.length - 3}` : ''}` : session.movementCount != null ? `${session.movementCount} movement${session.movementCount === 1 ? '' : 's'}` : null;
  const evidence = sessionEvidence(session);
  return (
    <SLMotionEntrance delay={Math.min(index, 5) * 35} distance={8} motionKey={`${session.id}-${session.lifecycle}`} style={styles.sessionEntrance}>
      <SLMotionPressable
        accessibilityLabel={[session.title, dayLabel, lifecycleLabel(session.lifecycle), movementSummary, evidence].filter(Boolean).join(', ')}
        accessibilityRole="button"
        onPress={() => {
          void Haptics.selectionAsync().catch(() => undefined);
          onPress(session);
        }}
        pressScale={0.975}
        style={[styles.sessionNode, { borderLeftColor: tone }]}
      >
        <Text style={styles.sessionDay}>{dayLabel}</Text>
        <View style={styles.sessionCopy}>
          <Text numberOfLines={2} style={styles.sessionTitle}>{session.title}</Text>
          {movementSummary ? <Text numberOfLines={1} style={styles.sessionMeta}>{movementSummary}</Text> : null}
          <View style={styles.sessionFooter}>
            {evidence ? <Text style={styles.sessionEvidence}>{evidence}</Text> : null}
            <Text style={[styles.sessionStateText, { color: tone }]}>{lifecycleLabel(session.lifecycle)}</Text>
          </View>
        </View>
        <Ionicons color={SLColors.textMuted} name="chevron-forward" size={18} />
      </SLMotionPressable>
    </SLMotionEntrance>
  );
});

function WeekExpansion({
  week,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onOpenSession,
}: {
  week: ProgramTimelineWeek;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onOpenSession: (session: ProgramTimelineSession) => void;
}) {
  const sessions = week.days.flatMap((day) => day.sessions.map((session) => ({ session, dayLabel: `${day.weekday} ${day.dayNumber}` })));
  const gesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-18, 18])
    .runOnJS(true)
    .onEnd((event) => {
      if (event.translationX <= -54 && canGoNext) onNext();
      if (event.translationX >= 54 && canGoPrevious) onPrevious();
    }), [canGoNext, canGoPrevious, onNext, onPrevious]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.weekExpansion}>
        <View style={styles.expansionHeader}>
          <View style={styles.expansionIdentity}>
            <Text style={styles.expansionKicker}>SESSION SEQUENCE</Text>
            <Text style={styles.expansionSummary}>{week.sessionCount} Session{week.sessionCount === 1 ? '' : 's'}</Text>
          </View>
        </View>
        {sessions.length ? (
          <View style={styles.sessionGrid}>
            {sessions.map(({ session, dayLabel }, index) => (
              <SessionNode dayLabel={dayLabel} index={index} key={session.id} onPress={onOpenSession} session={session} />
            ))}
          </View>
        ) : null}
        <View style={styles.traverseRow}>
          <SLMotionPressable accessibilityLabel="Previous Week" accessibilityRole="button" disabled={!canGoPrevious} onPress={onPrevious} style={[styles.traverseButton, !canGoPrevious && styles.disabled]}>
            <Ionicons color={SLColors.accentViolet} name="chevron-back" size={16} /><Text style={styles.traverseText}>Previous</Text>
          </SLMotionPressable>
          <SLMotionPressable accessibilityLabel="Next Week" accessibilityRole="button" disabled={!canGoNext} onPress={onNext} style={[styles.traverseButton, !canGoNext && styles.disabled]}>
            <Text style={styles.traverseText}>Next</Text><Ionicons color={SLColors.accentViolet} name="chevron-forward" size={16} />
          </SLMotionPressable>
        </View>
      </View>
    </GestureDetector>
  );
}

const BlockTerritory = memo(function BlockTerritory({
  block,
  selectedWeekKey,
  expandedWeekKey,
  orderedWeeks,
  onInspect,
  onOpenSession,
  onTraverse,
}: {
  block: ProgramTimelineBlock;
  selectedWeekKey: string | null;
  expandedWeekKey: string | null;
  orderedWeeks: ProgramTimelineWeek[];
  onInspect: (week: ProgramTimelineWeek) => void;
  onOpenSession: (session: ProgramTimelineSession) => void;
  onTraverse: (direction: -1 | 1) => void;
}) {
  const currentWeek = block.weeks.find((week) => week.current);
  const statusLabel = block.status === 'current' ? 'CURRENT BLOCK' : block.status === 'completed' ? 'COMPLETED BLOCK' : 'UPCOMING BLOCK';

  return (
    <View style={styles.blockTerritory}>
      <View style={styles.blockHeading}>
        <Text style={[styles.blockState, { color: blockTone(block.status) }]}>{statusLabel}</Text>
        <Text style={styles.blockTitle}>{block.name}</Text>
        <Text style={styles.blockMeta}>{block.dateRangeLabel} · {block.totalWeeks} Week{block.totalWeeks === 1 ? '' : 's'}</Text>
        <View style={styles.blockProgress}>
          {block.weeks.map((week) => <View key={week.key} style={[styles.blockSegment, (block.status === 'completed' || (currentWeek && week.number < currentWeek.number)) && styles.blockSegmentPast, week.current && styles.blockSegmentCurrent]} />)}
        </View>
      </View>
      <View style={styles.weekMap}>
        {block.weeks.map((week) => {
          const expanded = expandedWeekKey === week.key;
          const index = orderedWeeks.findIndex((candidate) => candidate.key === week.key);
          return <View key={week.key} style={styles.weekWrap}>
            <WeekNode expanded={expanded} onPress={onInspect} selected={selectedWeekKey === week.key} week={week} />
            {expanded ? <WeekExpansion
              canGoNext={index < orderedWeeks.length - 1}
              canGoPrevious={index > 0}
              onNext={() => onTraverse(1)}
              onOpenSession={onOpenSession}
              onPrevious={() => onTraverse(-1)}
              week={week}
            /> : null}
          </View>;
        })}
      </View>
    </View>
  );
});

function ProgramContext({ payload }: { payload: ProgramTimelinePayload }) {
  const currentIndex = payload.blocks.flatMap((block) => block.weeks).findIndex((week) => week.key === payload.program.currentWeekKey);
  const progress = Math.max(0, Math.min(1, payload.program.positionPercent));
  return (
    <ImageBackground imageStyle={styles.programImage} resizeMode="cover" source={PROGRAM_ART} style={styles.contextCard}>
        <View style={styles.programScrim} />
        <View style={styles.programCopy}>
          <Text style={styles.contextKicker}>CURRENT PROGRAM</Text>
          <Text numberOfLines={2} style={styles.programName}>{payload.program.name}</Text>
          <Text style={styles.programMeta}>{payload.program.dateRangeLabel}</Text>
          <Text style={styles.programPosition}>{currentIndex >= 0 ? `Week ${currentIndex + 1} of ${payload.program.totalWeeks}` : `${payload.program.totalWeeks} Weeks`} · {payload.program.totalSessions} Session{payload.program.totalSessions === 1 ? '' : 's'}</Text>
          <View accessibilityLabel={`${Math.round(progress * 100)} percent through Program`} style={styles.blockRail}>
            <View style={[styles.blockRailSegment, { width: `${progress * 100}%` }]} />
          </View>
        </View>
    </ImageBackground>
  );
}

export function AthleteProgramTimeline({
  payload,
  initialWeekKey,
  onBack,
  onOpenSession,
  refreshing,
  onRefresh,
}: {
  payload: ProgramTimelinePayload;
  initialWeekKey?: string;
  onBack: () => void;
  onOpenSession: (session: ProgramTimelineSession) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useSLReducedMotion();
  const listRef = useRef<FlatList<ProgramTimelineBlock>>(null);
  const orderedWeeks = useMemo(() => payload.blocks.flatMap((block) => block.weeks), [payload.blocks]);
  const startingWeekKey = orderedWeeks.some((week) => week.key === initialWeekKey) ? initialWeekKey || null : payload.program.currentWeekKey;
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(startingWeekKey);
  const [expandedWeekKey, setExpandedWeekKey] = useState<string | null>(startingWeekKey);

  useFocusEffect(useCallback(() => {
    if (!initialWeekKey) requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));
  }, [initialWeekKey]));

  useEffect(() => {
    setSelectedWeekKey((current) => orderedWeeks.some((week) => week.key === current) ? current : startingWeekKey);
    setExpandedWeekKey((current) => orderedWeeks.some((week) => week.key === current) ? current : startingWeekKey);
  }, [orderedWeeks, startingWeekKey]);

  const scrollToWeek = useCallback((week: ProgramTimelineWeek) => {
    const blockIndex = payload.blocks.findIndex((block) => block.weeks.some((candidate) => candidate.key === week.key));
    if (blockIndex >= 0) listRef.current?.scrollToIndex({ animated: !reduceMotion, index: blockIndex, viewPosition: 0.06 });
  }, [payload.blocks, reduceMotion]);

  const inspectWeek = useCallback((week: ProgramTimelineWeek) => {
    configureMapLayout(reduceMotion);
    setSelectedWeekKey(week.key);
    const opening = expandedWeekKey !== week.key;
    setExpandedWeekKey(opening ? week.key : null);
    if (opening) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    else void Haptics.selectionAsync().catch(() => undefined);
  }, [expandedWeekKey, reduceMotion, selectedWeekKey]);

  const traverse = useCallback((direction: -1 | 1) => {
    const currentKey = expandedWeekKey || selectedWeekKey;
    const currentIndex = orderedWeeks.findIndex((week) => week.key === currentKey);
    const next = orderedWeeks[currentIndex + direction];
    if (!next) return;
    configureMapLayout(reduceMotion);
    setSelectedWeekKey(next.key);
    setExpandedWeekKey(next.key);
    scrollToWeek(next);
    void Haptics.selectionAsync().catch(() => undefined);
  }, [expandedWeekKey, orderedWeeks, reduceMotion, scrollToWeek, selectedWeekKey]);

  const returnToCurrent = useCallback(() => {
    const current = orderedWeeks.find((week) => week.key === payload.program.currentWeekKey);
    if (!current) return;
    configureMapLayout(reduceMotion);
    setSelectedWeekKey(current.key);
    setExpandedWeekKey(current.key);
    scrollToWeek(current);
    void Haptics.selectionAsync().catch(() => undefined);
  }, [orderedWeeks, payload.program.currentWeekKey, reduceMotion, scrollToWeek]);

  const selectedIsCurrent = selectedWeekKey === payload.program.currentWeekKey;

  return (
    <View style={styles.root}>
      <SLContextualHeader
        action={!selectedIsCurrent ? { accessibilityLabel: 'Return to current Week', icon: 'locate', onPress: returnToCurrent } : undefined}
        breadcrumb="Training"
        onBack={onBack}
        style={{ paddingTop: insets.top + 6 }}
        title="Program map"
      />
      <FlatList
        contentContainerStyle={{ paddingBottom: Math.max(28, insets.bottom + 18) }}
        data={payload.blocks}
        initialNumToRender={3}
        keyExtractor={(block) => String(block.id)}
        ListHeaderComponent={<ProgramContext payload={payload} />}
        onScrollToIndexFailed={({ index }) => setTimeout(() => listRef.current?.scrollToIndex({ animated: !reduceMotion, index, viewPosition: 0.06 }), 120)}
        ref={listRef}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={SLColors.accentViolet} />}
        removeClippedSubviews
        renderItem={({ item }) => (
          <BlockTerritory
            block={item}
            expandedWeekKey={expandedWeekKey}
            onInspect={inspectWeek}
            onOpenSession={onOpenSession}
            onTraverse={traverse}
            orderedWeeks={orderedWeeks}
            selectedWeekKey={selectedWeekKey}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  list: { flex: 1, backgroundColor: '#000000' },
  contextCard: { minHeight: 162, justifyContent: 'center', overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  programImage: { opacity: 0.62 },
  programScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,3,7,0.72)' },
  programCopy: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 18, gap: 4 },
  contextKicker: { ...SLTypography.micro, color: SLColors.accentViolet, letterSpacing: 0.7 },
  programName: { ...SLTypography.title, color: SLColors.textStrong, fontSize: 23, lineHeight: 28, maxWidth: '85%' },
  programMeta: { ...SLTypography.caption, color: SLColors.text },
  programPosition: { ...SLTypography.caption, color: SLColors.textMuted },
  blockRail: { height: 4, maxWidth: 290, marginTop: 8, borderRadius: 2, overflow: 'hidden', backgroundColor: '#2B2132' },
  blockRailSegment: { height: 4, borderRadius: 2, backgroundColor: SLColors.accentViolet },
  blockTerritory: { paddingTop: 17, paddingBottom: 14 },
  blockHeading: { paddingHorizontal: 16, paddingBottom: 14, gap: 3 },
  blockTitle: { ...SLTypography.sectionTitle, color: SLColors.textStrong, fontSize: 21, lineHeight: 25 },
  blockMeta: { ...SLTypography.caption, color: SLColors.textMuted },
  blockState: { ...SLTypography.micro, letterSpacing: 0.7 },
  blockProgress: { flexDirection: 'row', gap: 4, marginTop: 10 },
  blockSegment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#302739' },
  blockSegmentPast: { backgroundColor: '#654784' },
  blockSegmentCurrent: { backgroundColor: SLColors.accentViolet },
  weekMap: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  weekWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderSubtle },
  weekNode: { minHeight: 75, flexDirection: 'row', alignItems: 'center', gap: 11, paddingRight: 16, backgroundColor: '#050608' },
  weekNodeUnbuilt: { backgroundColor: '#050608' },
  weekNodeSelected: { backgroundColor: '#171020' },
  weekNodeCurrent: { backgroundColor: '#100C17' },
  weekNodeStatus: { alignSelf: 'stretch', width: 3 },
  weekNodeNumber: { ...SLTypography.sectionTitle, width: 48, fontSize: 20, lineHeight: 24 },
  weekNodeCopy: { flex: 1, minWidth: 0, gap: 3 },
  weekNodeDate: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  weekNodeFingerprint: { ...SLTypography.micro, color: SLColors.textMuted, textAlign: 'right', fontWeight: '800' },
  weekNodeFingerprintUnbuilt: { color: SLColors.textSubtle },
  weekNodeSets: { ...SLTypography.caption, color: SLColors.textMuted },
  weekNodeState: { alignItems: 'flex-end', gap: 4 },
  weekExpansion: { backgroundColor: '#09080D', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderSubtle, paddingBottom: 5 },
  expansionHeader: { minHeight: 43, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  expansionIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  expansionKicker: { ...SLTypography.micro, color: SLColors.accentViolet, letterSpacing: 0.7 },
  expansionSummary: { ...SLTypography.caption, color: SLColors.textMuted },
  sessionGrid: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  sessionEntrance: { width: '100%' },
  sessionNode: { minHeight: 88, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11, borderLeftWidth: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderSubtle, backgroundColor: '#0B0D11' },
  sessionDay: { ...SLTypography.micro, color: SLColors.textMuted, width: 38 },
  sessionCopy: { flex: 1, minWidth: 0, gap: 3 },
  sessionTitle: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  sessionMeta: { ...SLTypography.caption, color: SLColors.text },
  sessionFooter: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 12, rowGap: 2 },
  sessionEvidence: { ...SLTypography.caption, color: SLColors.textMuted },
  sessionStateText: { ...SLTypography.micro, fontWeight: '800', textTransform: 'uppercase' },
  unbuiltWeekBody: { ...SLTypography.caption, color: SLColors.textMuted, paddingHorizontal: 16, paddingVertical: 14 },
  traverseRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  traverseButton: { minWidth: 88, minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 3 },
  traverseText: { ...SLTypography.caption, color: SLColors.accentViolet },
  disabled: { opacity: 0.25 },
});
