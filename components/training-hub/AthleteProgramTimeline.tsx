import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgrammingMuscleRegionArt } from '@/components/anatomy/ProgrammingMuscleRegionArt';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
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
  upcoming: SLColors.warning,
  missed: SLColors.accentRed,
  no_session: SLColors.textSubtle,
};

function lifecycleLabel(value: ProgramTimelineLifecycle) {
  if (value === 'completed') return 'Complete';
  if (value === 'in_progress') return 'In progress';
  if (value === 'today') return 'Today';
  if (value === 'upcoming') return 'Upcoming';
  if (value === 'missed') return 'Missed';
  return 'No Session';
}

function blockTone(status: ProgramTimelineBlock['status']) {
  if (status === 'completed') return SLColors.success;
  if (status === 'current') return SLColors.warning;
  return SLColors.accentViolet;
}

function sessionEvidence(session: ProgramTimelineSession) {
  const values = [
    session.movementCount != null ? `${session.movementCount} movement${session.movementCount === 1 ? '' : 's'}` : null,
    session.setCount != null ? `${session.setCount} sets` : null,
    session.sessionRpe != null ? `RPE ${session.sessionRpe}` : null,
    session.estimatedDurationMinutes != null ? `~${Math.round(session.estimatedDurationMinutes)} min` : null,
  ].filter(Boolean);
  return values.slice(0, 3).join(' · ') || lifecycleLabel(session.lifecycle);
}

const TimelineSessionRow = memo(function TimelineSessionRow({
  session,
  dayLabel,
  onPress,
}: {
  session: ProgramTimelineSession;
  dayLabel: string;
  onPress: (session: ProgramTimelineSession) => void;
}) {
  const tone = lifecycleTone[session.lifecycle];
  return (
    <Pressable
      accessibilityLabel={`${session.title}, ${dayLabel}, ${lifecycleLabel(session.lifecycle)}`}
      accessibilityRole="button"
      onPress={() => onPress(session)}
      style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}
    >
      <View style={styles.sessionDate}><Text style={styles.sessionDateText}>{dayLabel}</Text></View>
      <View style={styles.sessionArt}>
        {session.primaryMuscles.length ? (
          <ProgrammingMuscleRegionArt level="session" primary={session.primaryMuscles} />
        ) : (
          <Ionicons color={SLColors.accentViolet} name="barbell-outline" size={25} />
        )}
      </View>
      <View style={styles.sessionCopy}>
        <Text numberOfLines={2} style={styles.sessionTitle}>{session.title}</Text>
        <Text numberOfLines={1} style={styles.sessionMeta}>{sessionEvidence(session)}</Text>
      </View>
      <View style={styles.sessionState}>
        <View style={[styles.stateDot, { backgroundColor: tone }]} />
        <Text numberOfLines={1} style={[styles.sessionStateText, { color: tone }]}>{lifecycleLabel(session.lifecycle)}</Text>
      </View>
      <Ionicons color={SLColors.textMuted} name="chevron-forward" size={17} />
    </Pressable>
  );
});

const TimelineWeekRow = memo(function TimelineWeekRow({
  week,
  expanded,
  onToggle,
  onOpenSession,
}: {
  week: ProgramTimelineWeek;
  expanded: boolean;
  onToggle: (week: ProgramTimelineWeek) => void;
  onOpenSession: (session: ProgramTimelineSession) => void;
}) {
  const tone = lifecycleTone[week.lifecycle];
  const countLabel = week.sessionCount === 0
    ? 'No sessions scheduled'
    : week.lifecycle === 'completed'
      ? `${week.sessionCount} Sessions · Complete`
      : `${week.completedCount} of ${week.sessionCount} complete`;
  return (
    <View style={[styles.weekWrap, week.current && styles.currentWeekWrap]}>
      <Pressable
        accessibilityHint="Expands this week and collapses the previously open week"
        accessibilityLabel={`Week ${week.number}, ${week.dateRangeLabel}, ${countLabel}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => onToggle(week)}
        style={({ pressed }) => [styles.weekHeader, pressed && styles.pressed]}
      >
        <View style={styles.timelineNodeColumn}>
          <View style={[styles.timelineNode, { borderColor: tone }, week.lifecycle === 'completed' && { backgroundColor: tone }]}>
            {week.lifecycle === 'completed' ? <Ionicons color={SLColors.canvas} name="checkmark" size={13} /> : null}
          </View>
          <View style={[styles.timelineStem, { backgroundColor: tone }]} />
        </View>
        <View style={[styles.weekNumberBox, week.current && styles.currentWeekNumberBox]}>
          <Text style={[styles.weekNumber, week.current && { color: tone }]}>W{week.number}</Text>
          {week.current ? <Text style={styles.currentLabel}>CURRENT</Text> : null}
        </View>
        <View style={styles.weekCopy}>
          <Text style={styles.weekRange}>{week.dateRangeLabel}</Text>
          <Text style={[styles.weekSummary, week.lifecycle === 'missed' && { color: tone }]}>{countLabel}</Text>
        </View>
        <Ionicons color={week.current ? tone : SLColors.textMuted} name={expanded ? 'chevron-up' : 'chevron-down'} size={19} />
      </Pressable>
      {expanded ? (
        <View style={styles.expandedWeek}>
          {week.days.map((day) => day.sessions.length ? day.sessions.map((session) => (
            <TimelineSessionRow
              dayLabel={`${day.weekday} ${day.dayNumber}`}
              key={session.id}
              onPress={onOpenSession}
              session={session}
            />
          )) : (
            <View key={day.date} style={styles.emptyDayRow}>
              <Text style={styles.emptyDayDate}>{day.weekday} {day.dayNumber}</Text>
              <View style={styles.emptyDayMark} />
              <Text style={styles.emptyDayLabel}>No Session</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

function ProgramContext({ payload }: { payload: ProgramTimelinePayload }) {
  return (
    <View style={styles.contextCard}>
      <ImageBackground imageStyle={styles.programImage} resizeMode="cover" source={PROGRAM_ART} style={styles.programHero}>
        <View style={styles.programScrim} />
        <View style={styles.programCopy}>
          <Text style={styles.contextKicker}>TRAINING PROGRAM</Text>
          <Text numberOfLines={2} style={styles.programName}>{payload.program.name}</Text>
          <Text style={styles.programMeta}>
            {payload.program.dateRangeLabel} · {payload.program.blockCount} Blocks · {payload.program.totalWeeks} Weeks · {payload.program.totalSessions} Sessions
          </Text>
        </View>
      </ImageBackground>
      <View style={styles.blockRailLabels}>
        {payload.blocks.map((block) => (
          <View key={block.id} style={[styles.blockRailLabelWrap, { flex: block.totalWeeks }]}>
            <Text numberOfLines={1} style={[styles.blockRailLabel, { color: blockTone(block.status) }]}>{block.name}</Text>
            <Text style={styles.blockRailWeeks}>{block.totalWeeks} weeks</Text>
          </View>
        ))}
      </View>
      <View style={styles.blockRail}>
        {payload.blocks.map((block) => (
          <View
            key={block.id}
            style={[
              styles.blockRailSegment,
              { flex: block.totalWeeks, backgroundColor: blockTone(block.status) },
            ]}
          />
        ))}
        <View style={[styles.positionMarker, { left: `${payload.program.positionPercent * 100}%` }]}>
          <View style={styles.positionMarkerCore} />
        </View>
      </View>
      <View style={[styles.youAreHere, { left: `${Math.max(8, Math.min(78, payload.program.positionPercent * 100 - 10))}%` }]}>
        <Text style={styles.youAreHereText}>YOU ARE HERE</Text>
      </View>
    </View>
  );
}

export function AthleteProgramTimeline({
  payload,
  onBack,
  onOpenSession,
  refreshing,
  onRefresh,
}: {
  payload: ProgramTimelinePayload;
  onBack: () => void;
  onOpenSession: (session: ProgramTimelineSession) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<SectionList<ProgramTimelineWeek, { title: string; block: ProgramTimelineBlock; data: ProgramTimelineWeek[] }>>(null);
  const [expandedWeekKey, setExpandedWeekKey] = useState<string | null>(payload.program.currentWeekKey);
  const sections = useMemo(() => payload.blocks.map((block) => ({ title: block.name, block, data: block.weeks })), [payload.blocks]);
  const expandedWeek = useMemo(() => payload.blocks.flatMap((block) => block.weeks).find((week) => week.key === expandedWeekKey) || null, [expandedWeekKey, payload.blocks]);

  const jumpTo = useCallback((sectionIndex: number, itemIndex = 0) => {
    listRef.current?.scrollToLocation({ animated: true, sectionIndex, itemIndex, viewOffset: 10, viewPosition: 0.08 });
  }, []);
  const jumpToCurrent = useCallback(() => {
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
      const itemIndex = sections[sectionIndex].data.findIndex((week) => week.key === payload.program.currentWeekKey);
      if (itemIndex >= 0) {
        setExpandedWeekKey(payload.program.currentWeekKey);
        jumpTo(sectionIndex, itemIndex);
        return;
      }
    }
  }, [jumpTo, payload.program.currentWeekKey, sections]);

  return (
    <View style={styles.root}>
      <View style={[styles.pageHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Ionicons color={SLColors.textStrong} name="chevron-back" size={25} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Program Timeline</Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>{payload.program.name}</Text>
        </View>
        <View style={styles.headerButtonPlaceholder} />
      </View>
      <SectionList
        contentContainerStyle={{ paddingBottom: Math.max(28, insets.bottom + 18) }}
        initialNumToRender={8}
        keyExtractor={(week) => week.key}
        ListHeaderComponent={(
          <>
            <ProgramContext payload={payload} />
            <ScrollView contentContainerStyle={styles.blockNavigatorContent} horizontal showsHorizontalScrollIndicator={false} style={styles.blockNavigator}>
              {payload.blocks.map((block, index) => (
                <Pressable
                  accessibilityLabel={`Jump to ${block.name}`}
                  accessibilityRole="button"
                  key={block.id}
                  onPress={() => jumpTo(index)}
                  style={({ pressed }) => [styles.blockNavigatorButton, block.status === 'current' && styles.blockNavigatorCurrent, pressed && styles.pressed]}
                >
                  <Text numberOfLines={1} style={[styles.blockNavigatorText, block.status === 'current' && styles.blockNavigatorCurrentText]}>
                    {block.status === 'current' ? `${block.name} · W${block.weeks.find((week) => week.current)?.number || 1}` : block.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
        onScrollToIndexFailed={() => setTimeout(jumpToCurrent, 120)}
        ref={listRef}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={SLColors.accentViolet} />}
        renderItem={({ item }) => (
          <TimelineWeekRow
            expanded={expandedWeekKey === item.key}
            onOpenSession={onOpenSession}
            onToggle={(week) => setExpandedWeekKey((current) => current === week.key ? null : week.key)}
            week={item}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.blockHeader}>
            <View style={[styles.blockHeaderDot, { backgroundColor: blockTone(section.block.status) }]} />
            <Text numberOfLines={1} style={[styles.blockHeaderTitle, section.block.status === 'current' && { color: SLColors.warning }]}>{section.block.name.toUpperCase()}</Text>
            <Text style={styles.blockHeaderMeta}>· {section.block.totalWeeks} WEEKS</Text>
          </View>
        )}
        sections={sections}
        stickySectionHeadersEnabled
        style={styles.list}
        windowSize={7}
      />
      {expandedWeek?.key !== payload.program.currentWeekKey ? (
        <Pressable accessibilityRole="button" onPress={jumpToCurrent} style={({ pressed }) => [styles.returnCurrent, { bottom: Math.max(18, insets.bottom + 8) }, pressed && styles.pressed]}>
          <Ionicons color={SLColors.canvas} name="locate" size={18} />
          <Text style={styles.returnCurrentText}>Current Week</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  list: { flex: 1, backgroundColor: '#000000' },
  pageHeader: { minHeight: 88, paddingHorizontal: 18, paddingBottom: 13, borderBottomColor: SLColors.borderHairline, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center', flexDirection: 'row' },
  headerButton: { width: 50, height: 50, borderRadius: 16, backgroundColor: SLColors.surfaceInset, borderColor: SLColors.borderStandard, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerButtonPlaceholder: { width: 50 },
  headerCopy: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  headerTitle: { ...SLTypography.screenTitle, color: SLColors.textStrong, fontSize: 22 },
  headerSubtitle: { ...SLTypography.body, color: SLColors.textMuted, marginTop: 2 },
  contextCard: { marginHorizontal: 16, marginTop: 14, marginBottom: 8, borderRadius: SLRadius.radiusCard, borderColor: SLColors.borderStandard, borderWidth: 1, backgroundColor: SLColors.surfaceInset, overflow: 'hidden', paddingBottom: 28 },
  programHero: { minHeight: 142, justifyContent: 'flex-end' },
  programImage: { opacity: 0.72 },
  programScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.46)' },
  programCopy: { padding: 18, gap: 4 },
  contextKicker: { ...SLTypography.utilityLabel, color: SLColors.warning, letterSpacing: 1 },
  programName: { ...SLTypography.screenTitle, color: SLColors.textStrong, fontSize: 25 },
  programMeta: { ...SLTypography.note, color: SLColors.textSecondary, lineHeight: 21 },
  blockRailLabels: { flexDirection: 'row', paddingHorizontal: 18, gap: 4, marginTop: 14 },
  blockRailLabelWrap: { minWidth: 0, alignItems: 'center' },
  blockRailLabel: { ...SLTypography.utilityLabel, fontSize: 11 },
  blockRailWeeks: { ...SLTypography.note, color: SLColors.textMuted, fontSize: 11 },
  blockRail: { height: 6, flexDirection: 'row', marginHorizontal: 20, marginTop: 10, borderRadius: 3, overflow: 'visible', gap: 2 },
  blockRailSegment: { height: 6, borderRadius: 3 },
  positionMarker: { position: 'absolute', top: -7, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: SLColors.warning, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  positionMarkerCore: { width: 7, height: 7, borderRadius: 4, backgroundColor: SLColors.warning },
  youAreHere: { position: 'absolute', bottom: 7 },
  youAreHereText: { ...SLTypography.utilityLabel, color: SLColors.warning, fontSize: 10 },
  blockNavigator: { marginVertical: 8 },
  blockNavigatorContent: { paddingHorizontal: 16, gap: 8 },
  blockNavigatorButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 13, borderColor: SLColors.borderStandard, borderWidth: 1, backgroundColor: SLColors.surfaceInset },
  blockNavigatorCurrent: { borderColor: SLColors.warning, backgroundColor: 'rgba(200,171,114,0.10)' },
  blockNavigatorText: { ...SLTypography.label, color: SLColors.textMuted },
  blockNavigatorCurrentText: { color: SLColors.warning },
  blockHeader: { minHeight: 50, paddingHorizontal: 18, alignItems: 'center', flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.96)', borderBottomColor: SLColors.borderHairline, borderBottomWidth: StyleSheet.hairlineWidth },
  blockHeaderDot: { width: 9, height: 9, borderRadius: 5, marginRight: 10 },
  blockHeaderTitle: { ...SLTypography.sectionTitle, color: SLColors.accentViolet, flexShrink: 1 },
  blockHeaderMeta: { ...SLTypography.utilityLabel, color: SLColors.textMuted, marginLeft: 6 },
  weekWrap: { marginHorizontal: 16, borderBottomColor: SLColors.borderHairline, borderBottomWidth: StyleSheet.hairlineWidth },
  currentWeekWrap: { borderColor: SLColors.warning, borderWidth: 1, borderRadius: 16, backgroundColor: 'rgba(200,171,114,0.035)', marginVertical: 5, overflow: 'hidden' },
  weekHeader: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingRight: 14 },
  timelineNodeColumn: { width: 34, alignItems: 'center', alignSelf: 'stretch' },
  timelineNode: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginTop: 26, zIndex: 2 },
  timelineStem: { position: 'absolute', width: 2, top: 49, bottom: -29, opacity: 0.48 },
  weekNumberBox: { width: 58, minHeight: 48, borderRadius: 12, borderColor: SLColors.borderStandard, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
  currentWeekNumberBox: { borderColor: SLColors.warning, backgroundColor: 'rgba(200,171,114,0.08)' },
  weekNumber: { ...SLTypography.cardTitle, color: SLColors.textStrong, fontSize: 20 },
  currentLabel: { ...SLTypography.utilityLabel, color: SLColors.warning, fontSize: 8 },
  weekCopy: { flex: 1, gap: 3, minWidth: 0 },
  weekRange: { ...SLTypography.body, color: SLColors.textStrong },
  weekSummary: { ...SLTypography.note, color: SLColors.textMuted },
  expandedWeek: { marginLeft: 40, paddingBottom: 8, borderTopColor: SLColors.borderHairline, borderTopWidth: StyleSheet.hairlineWidth },
  sessionRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderBottomColor: SLColors.borderHairline, borderBottomWidth: StyleSheet.hairlineWidth },
  sessionDate: { width: 42 },
  sessionDateText: { ...SLTypography.utilityLabel, color: SLColors.textMuted, fontSize: 11 },
  sessionArt: { width: 54, height: 54, borderRadius: 12, overflow: 'hidden', backgroundColor: SLColors.surfaceFlat, borderColor: SLColors.borderSubtle, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sessionCopy: { flex: 1, minWidth: 0, gap: 2 },
  sessionTitle: { ...SLTypography.cardTitle, color: SLColors.textStrong, fontSize: 17, lineHeight: 21 },
  sessionMeta: { ...SLTypography.note, color: SLColors.textMuted },
  sessionState: { maxWidth: 82, alignItems: 'flex-end', gap: 4 },
  stateDot: { width: 9, height: 9, borderRadius: 5 },
  sessionStateText: { ...SLTypography.utilityLabel, fontSize: 10 },
  emptyDayRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 12, borderBottomColor: SLColors.borderHairline, borderBottomWidth: StyleSheet.hairlineWidth },
  emptyDayDate: { ...SLTypography.utilityLabel, color: SLColors.textMuted, width: 54 },
  emptyDayMark: { width: 12, height: 12, borderRadius: 6, borderColor: SLColors.textSubtle, borderWidth: 1 },
  emptyDayLabel: { ...SLTypography.note, color: SLColors.textSubtle },
  returnCurrent: { position: 'absolute', right: 18, flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, backgroundColor: SLColors.accentViolet },
  returnCurrentText: { ...SLTypography.label, color: SLColors.canvas },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
