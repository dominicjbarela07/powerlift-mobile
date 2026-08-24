import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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

import { ProgrammingMuscleRegionArt } from '@/components/anatomy/ProgrammingMuscleRegionArt';
import { SLMotionEntrance, SLMotionPressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLMotion, SLTypography } from '@/constants/theme';
import { useSLReducedMotion } from '@/lib/motion';
import type {
  ProgramTimelineBlock,
  ProgramTimelineLifecycle,
  ProgramTimelinePayload,
  ProgramTimelineSession,
  ProgramTimelineWeek,
} from '@/lib/program-timeline';

const PROGRAM_ART = require('@/assets/images/ledger-index-v2/ledger-hero-plate-v1.png');
const BLOCK_GENERAL_ART = require('@/assets/images/gym_vibe.jpg');
const BLOCK_STRENGTH_ART = require('@/assets/images/ledger-index-v2/ledger-chapter-variants-v1.png');
const BLOCK_HYPERTROPHY_ART = require('@/assets/images/ledger-index-v2/ledger-chapter-accessories-v1.png');
const BLOCK_FOUNDATION_ART = require('@/assets/images/ledger-index-v2/ledger-chapter-journey-v1.png');

const MAP_COLUMNS = 3;
const MAP_ROW_HEIGHT = 112;

const lifecycleTone: Record<ProgramTimelineLifecycle, string> = {
  completed: '#43D786',
  in_progress: SLColors.accentViolet,
  today: SLColors.warning,
  upcoming: SLColors.warning,
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
  return 'Unbuilt';
}

function blockTone(status: ProgramTimelineBlock['status']) {
  if (status === 'completed') return lifecycleTone.completed;
  if (status === 'current') return SLColors.warning;
  return SLColors.accentViolet;
}

function blockArtwork(block: ProgramTimelineBlock) {
  const identity = block.name.toLowerCase();
  if (/(hypertrophy|bodybuild|offseason|volume|accessor)/.test(identity)) return BLOCK_HYPERTROPHY_ART;
  if (/(strength|power|peak|competition|intens)/.test(identity)) return BLOCK_STRENGTH_ART;
  if (/(base|foundation|recovery|return|reverse|rebuild|diet)/.test(identity)) return BLOCK_FOUNDATION_ART;
  return BLOCK_GENERAL_ART;
}

function sessionEvidence(session: ProgramTimelineSession) {
  return [
    session.movementCount != null ? `${session.movementCount} movement${session.movementCount === 1 ? '' : 's'}` : null,
    session.setCount != null ? `${session.setCount} sets` : null,
    session.sessionRpe != null ? `RPE ${session.sessionRpe}` : null,
    session.estimatedDurationMinutes != null ? `~${Math.round(session.estimatedDurationMinutes)} min` : null,
  ].filter(Boolean).slice(0, 3).join(' · ') || lifecycleLabel(session.lifecycle);
}

function weekFingerprint(week: ProgramTimelineWeek) {
  if (week.programmingState === 'unbuilt') return 'UNBUILT';
  if (week.lifecycle === 'upcoming') return `${week.sessionCount} PLANNED`;
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

function CurrentLandmarkPulse({ active }: { active: boolean }) {
  const reduceMotion = useSLReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.stopAnimation();
    if (!active || reduceMotion) {
      pulse.setValue(0);
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [active, pulse, reduceMotion]);

  if (!active) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.currentPulse,
        {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.04] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
        },
      ]}
    />
  );
}

function DensityMarks({ week }: { week: ProgramTimelineWeek }) {
  const sessions = week.days.flatMap((day) => day.sessions).slice(0, 7);
  if (!sessions.length) {
    return (
      <View accessibilityLabel="No Sessions programmed" style={styles.densityMarks}>
        {Array.from({ length: 5 }, (_, index) => <View key={index} style={styles.densityEmpty} />)}
      </View>
    );
  }
  return (
    <View accessibilityLabel={`${sessions.length} Sessions programmed`} style={styles.densityMarks}>
      {sessions.map((session) => (
        <View key={session.id} style={[styles.densityMark, { backgroundColor: lifecycleTone[session.lifecycle] }]} />
      ))}
    </View>
  );
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
  const tone = week.current ? SLColors.warning : lifecycleTone[week.lifecycle];
  const unbuilt = week.programmingState === 'unbuilt';
  return (
    <SLMotionPressable
      accessibilityHint="Opens this Week into its Sessions"
      accessibilityLabel={`Week ${week.number}, ${week.dateRangeLabel}, ${weekFingerprint(week)}`}
      accessibilityRole="button"
      accessibilityState={{ expanded, selected }}
      onPress={() => onPress(week)}
      pressScale={0.965}
      style={[
        styles.weekNode,
        unbuilt && styles.weekNodeUnbuilt,
        selected && styles.weekNodeSelected,
        week.current && styles.weekNodeCurrent,
      ]}
    >
      <CurrentLandmarkPulse active={week.current} />
      <View style={[styles.weekNodeStatus, { backgroundColor: unbuilt ? SLColors.textSubtle : tone }]} />
      <View style={styles.weekNodeTopline}>
        <Text style={[styles.weekNodeNumber, { color: selected || week.current ? tone : SLColors.textStrong }]}>W{week.number}</Text>
        {week.current ? <View style={styles.currentPill}><Text style={styles.currentPillText}>HERE</Text></View> : null}
        {week.lifecycle === 'completed' ? <Ionicons color={tone} name="checkmark-circle" size={16} /> : null}
      </View>
      <Text numberOfLines={1} style={[styles.weekNodeFingerprint, unbuilt && styles.weekNodeFingerprintUnbuilt]}>{weekFingerprint(week)}</Text>
      <DensityMarks week={week} />
      <Text numberOfLines={1} style={styles.weekNodeSets}>{week.plannedSetCount ? `${week.plannedSetCount} sets` : week.dateRangeLabel}</Text>
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
  return (
    <SLMotionEntrance delay={Math.min(index, 5) * 35} distance={8} motionKey={`${session.id}-${session.lifecycle}`} style={styles.sessionEntrance}>
      <SLMotionPressable
        accessibilityLabel={`${session.title}, ${dayLabel}, ${lifecycleLabel(session.lifecycle)}`}
        accessibilityRole="button"
        onPress={() => {
          void Haptics.selectionAsync().catch(() => undefined);
          onPress(session);
        }}
        pressScale={0.975}
        style={styles.sessionNode}
      >
        <View style={styles.sessionNodeTopline}>
          <Text style={styles.sessionDay}>{dayLabel}</Text>
          <View style={[styles.sessionLifecycleDot, { backgroundColor: tone }]} />
        </View>
        <View style={styles.sessionNodeBody}>
          <View style={styles.sessionArt}>
            {session.primaryMuscles.length ? (
              <ProgrammingMuscleRegionArt level="session" primary={session.primaryMuscles} secondary={session.secondaryMuscles} />
            ) : (
              <Ionicons color={SLColors.accentViolet} name="barbell-outline" size={25} />
            )}
          </View>
          <View style={styles.sessionCopy}>
            <Text numberOfLines={2} style={styles.sessionTitle}>{session.title}</Text>
            <Text numberOfLines={2} style={styles.sessionMeta}>{sessionEvidence(session)}</Text>
          </View>
        </View>
        <View style={styles.sessionNodeFooter}>
          <Text style={[styles.sessionStateText, { color: tone }]}>{lifecycleLabel(session.lifecycle)}</Text>
          <Ionicons color={SLColors.textMuted} name="chevron-forward" size={16} />
        </View>
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
        <View style={styles.expansionStem} />
        <View style={styles.expansionHeader}>
          <SLMotionPressable accessibilityLabel="Previous Week" accessibilityRole="button" disabled={!canGoPrevious} onPress={onPrevious} style={[styles.traverseButton, !canGoPrevious && styles.disabled]}>
            <Ionicons color={SLColors.textStrong} name="chevron-back" size={19} />
          </SLMotionPressable>
          <View style={styles.expansionIdentity}>
            <Text style={styles.expansionKicker}>WEEK {week.number} · {lifecycleLabel(week.lifecycle).toUpperCase()}</Text>
            <Text style={styles.expansionTitle}>{week.dateRangeLabel}</Text>
            <Text style={styles.expansionSummary}>
              {week.programmingState === 'unbuilt'
                ? 'Programming has not been built yet'
                : `${week.completedCount} of ${week.sessionCount} Sessions complete${week.plannedSetCount ? ` · ${week.plannedSetCount} planned sets` : ''}`}
            </Text>
          </View>
          <SLMotionPressable accessibilityLabel="Next Week" accessibilityRole="button" disabled={!canGoNext} onPress={onNext} style={[styles.traverseButton, !canGoNext && styles.disabled]}>
            <Ionicons color={SLColors.textStrong} name="chevron-forward" size={19} />
          </SLMotionPressable>
        </View>
        {sessions.length ? (
          <View style={styles.sessionGrid}>
            {sessions.map(({ session, dayLabel }, index) => (
              <SessionNode dayLabel={dayLabel} index={index} key={session.id} onPress={onOpenSession} session={session} />
            ))}
          </View>
        ) : (
          <View style={styles.unbuiltWeek}>
            <View style={styles.unbuiltWeekIcon}><Ionicons color={SLColors.textMuted} name="construct-outline" size={25} /></View>
            <View style={styles.unbuiltWeekCopy}>
              <Text style={styles.unbuiltWeekTitle}>Unbuilt Week</Text>
              <Text style={styles.unbuiltWeekBody}>No Sessions are programmed in this Week.</Text>
            </View>
          </View>
        )}
        <Text style={styles.swipeHint}>Swipe sideways or use the arrows to inspect adjacent Weeks</Text>
      </View>
    </GestureDetector>
  );
}

function chunkWeeks(weeks: ProgramTimelineWeek[]) {
  const rows: ProgramTimelineWeek[][] = [];
  for (let index = 0; index < weeks.length; index += MAP_COLUMNS) rows.push(weeks.slice(index, index + MAP_COLUMNS));
  return rows;
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
  onInspect: (week: ProgramTimelineWeek, source: 'tap' | 'scrub') => void;
  onOpenSession: (session: ProgramTimelineSession) => void;
  onTraverse: (direction: -1 | 1) => void;
}) {
  const rows = useMemo(() => chunkWeeks(block.weeks), [block.weeks]);
  const [mapWidth, setMapWidth] = useState(0);
  const lastScrubKey = useRef<string | null>(null);
  const expandedWeek = block.weeks.find((week) => week.key === expandedWeekKey) || null;
  const expandedIndex = expandedWeek ? orderedWeeks.findIndex((week) => week.key === expandedWeek.key) : -1;

  const scrubAtPoint = useCallback((x: number, y: number) => {
    if (!mapWidth) return;
    const row = Math.max(0, Math.min(rows.length - 1, Math.floor(y / MAP_ROW_HEIGHT)));
    const visualColumn = Math.max(0, Math.min(MAP_COLUMNS - 1, Math.floor((x / mapWidth) * MAP_COLUMNS)));
    const chronologicalColumn = row % 2 === 1 ? MAP_COLUMNS - 1 - visualColumn : visualColumn;
    const week = block.weeks[row * MAP_COLUMNS + chronologicalColumn];
    if (!week || lastScrubKey.current === week.key) return;
    lastScrubKey.current = week.key;
    onInspect(week, 'scrub');
  }, [block.weeks, mapWidth, onInspect, rows.length]);

  const scrubGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-16, 16])
    .runOnJS(true)
    .onStart((event) => scrubAtPoint(event.x, event.y))
    .onUpdate((event) => scrubAtPoint(event.x, event.y))
    .onFinalize(() => { lastScrubKey.current = null; }), [scrubAtPoint]);

  return (
    <View style={styles.blockTerritory}>
      <ImageBackground imageStyle={styles.blockArtwork} resizeMode="cover" source={blockArtwork(block)} style={styles.blockHeading}>
        <View style={styles.blockArtworkScrim} />
        <View style={[styles.blockTerritoryRail, { backgroundColor: blockTone(block.status) }]} />
        <View style={styles.blockHeadingCopy}>
          <Text style={[styles.blockTitle, { color: blockTone(block.status) }]}>{block.name.toUpperCase()}</Text>
          <Text style={styles.blockMeta}>{block.dateRangeLabel} · {block.totalWeeks} Weeks</Text>
        </View>
        <Text style={[styles.blockState, { color: blockTone(block.status) }]}>{block.status.toUpperCase()}</Text>
      </ImageBackground>

      <GestureDetector gesture={scrubGesture}>
        <View onLayout={(event) => setMapWidth(event.nativeEvent.layout.width)} style={styles.weekMap}>
          {rows.map((row, rowIndex) => (
            <View key={`${block.id}-row-${rowIndex}`} style={styles.mapRowWrap}>
              <View style={styles.mapHorizontalPath} />
              {rowIndex < rows.length - 1 ? <View style={[styles.mapTurn, rowIndex % 2 === 0 ? styles.mapTurnRight : styles.mapTurnLeft]} /> : null}
              <View style={[styles.mapRow, rowIndex % 2 === 1 && styles.mapRowReverse]}>
                {row.map((week) => (
                  <WeekNode
                    expanded={expandedWeekKey === week.key}
                    key={week.key}
                    onPress={(value) => onInspect(value, 'tap')}
                    selected={selectedWeekKey === week.key}
                    week={week}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      </GestureDetector>

      {expandedWeek ? (
        <WeekExpansion
          canGoNext={expandedIndex >= 0 && expandedIndex < orderedWeeks.length - 1}
          canGoPrevious={expandedIndex > 0}
          onNext={() => onTraverse(1)}
          onOpenSession={onOpenSession}
          onPrevious={() => onTraverse(-1)}
          week={expandedWeek}
        />
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
          <Text style={styles.programMeta}>{payload.program.dateRangeLabel} · {payload.program.blockCount} Blocks · {payload.program.totalWeeks} Weeks · {payload.program.totalSessions} Sessions</Text>
        </View>
      </ImageBackground>
      <View style={styles.blockRailLabels}>
        {payload.blocks.map((block) => (
          <View key={block.id} style={[styles.blockRailLabelWrap, { flex: block.totalWeeks }]}>
            <Text numberOfLines={1} style={[styles.blockRailLabel, { color: blockTone(block.status) }]}>{block.name}</Text>
          </View>
        ))}
      </View>
      <View style={styles.blockRail}>
        {payload.blocks.map((block) => <View key={block.id} style={[styles.blockRailSegment, { flex: block.totalWeeks, backgroundColor: blockTone(block.status) }]} />)}
        <View style={[styles.positionMarker, { left: `${payload.program.positionPercent * 100}%` }]}><View style={styles.positionMarkerCore} /></View>
      </View>
      <View style={[styles.youAreHere, { left: `${Math.max(6, Math.min(76, payload.program.positionPercent * 100 - 10))}%` }]}><Text style={styles.youAreHereText}>YOU ARE HERE</Text></View>
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
  const reduceMotion = useSLReducedMotion();
  const listRef = useRef<FlatList<ProgramTimelineBlock>>(null);
  const orderedWeeks = useMemo(() => payload.blocks.flatMap((block) => block.weeks), [payload.blocks]);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(payload.program.currentWeekKey);
  const [expandedWeekKey, setExpandedWeekKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedWeekKey((current) => orderedWeeks.some((week) => week.key === current) ? current : payload.program.currentWeekKey);
    setExpandedWeekKey((current) => orderedWeeks.some((week) => week.key === current) ? current : null);
  }, [orderedWeeks, payload.program.currentWeekKey]);

  const scrollToWeek = useCallback((week: ProgramTimelineWeek) => {
    const blockIndex = payload.blocks.findIndex((block) => block.weeks.some((candidate) => candidate.key === week.key));
    if (blockIndex >= 0) listRef.current?.scrollToIndex({ animated: !reduceMotion, index: blockIndex, viewPosition: 0.06 });
  }, [payload.blocks, reduceMotion]);

  const inspectWeek = useCallback((week: ProgramTimelineWeek, source: 'tap' | 'scrub') => {
    const changed = selectedWeekKey !== week.key;
    if (source === 'scrub') {
      if (!changed) return;
      setSelectedWeekKey(week.key);
      if (expandedWeekKey) {
        configureMapLayout(reduceMotion);
        setExpandedWeekKey(week.key);
      }
      void Haptics.selectionAsync().catch(() => undefined);
      return;
    }
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
      <View style={[styles.pageHeader, { paddingTop: insets.top + 6 }]}>
        <SLMotionPressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={styles.headerButton}>
          <Ionicons color={SLColors.textStrong} name="chevron-back" size={25} />
        </SLMotionPressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Program Timeline</Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>{payload.program.name}</Text>
        </View>
        {!selectedIsCurrent ? (
          <SLMotionPressable accessibilityLabel="Return to current Week" accessibilityRole="button" onPress={returnToCurrent} style={styles.currentHeaderButton}>
            <Ionicons color={SLColors.warning} name="locate" size={17} />
            <Text style={styles.currentHeaderText}>Current</Text>
          </SLMotionPressable>
        ) : <View style={styles.headerButtonPlaceholder} />}
      </View>
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
  pageHeader: { minHeight: 88, paddingHorizontal: 14, paddingBottom: 12, borderBottomColor: SLColors.borderHairline, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center', flexDirection: 'row' },
  headerButton: { width: 48, height: 48, borderRadius: 15, backgroundColor: SLColors.surfaceInset, borderColor: SLColors.borderStandard, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerButtonPlaceholder: { width: 60 },
  headerCopy: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { ...SLTypography.screenTitle, color: SLColors.textStrong, fontSize: 22 },
  headerSubtitle: { ...SLTypography.body, color: SLColors.textMuted, marginTop: 1 },
  currentHeaderButton: { minWidth: 68, minHeight: 44, borderRadius: 14, borderColor: 'rgba(200,171,114,0.38)', borderWidth: 1, backgroundColor: 'rgba(200,171,114,0.08)', alignItems: 'center', justifyContent: 'center', gap: 1, paddingHorizontal: 8 },
  currentHeaderText: { ...SLTypography.utilityLabel, color: SLColors.warning, fontSize: 9 },
  contextCard: { marginHorizontal: 12, marginTop: 12, marginBottom: 18, borderRadius: SLRadius.radiusCard, borderColor: SLColors.borderStandard, borderWidth: 1, backgroundColor: SLColors.surfaceInset, overflow: 'hidden', paddingBottom: 27 },
  programHero: { minHeight: 118, justifyContent: 'flex-end' },
  programImage: { opacity: 0.68 },
  programScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.48)' },
  programCopy: { padding: 16, gap: 3 },
  contextKicker: { ...SLTypography.utilityLabel, color: SLColors.warning, letterSpacing: 1 },
  programName: { ...SLTypography.screenTitle, color: SLColors.textStrong, fontSize: 24 },
  programMeta: { ...SLTypography.note, color: SLColors.textSecondary, lineHeight: 20 },
  blockRailLabels: { flexDirection: 'row', paddingHorizontal: 16, gap: 3, marginTop: 11 },
  blockRailLabelWrap: { minWidth: 0, alignItems: 'center' },
  blockRailLabel: { ...SLTypography.utilityLabel, fontSize: 10 },
  blockRail: { height: 5, flexDirection: 'row', marginHorizontal: 18, marginTop: 8, borderRadius: 3, overflow: 'visible', gap: 2 },
  blockRailSegment: { height: 5, borderRadius: 3 },
  positionMarker: { position: 'absolute', top: -7, width: 19, height: 19, borderRadius: 10, borderWidth: 2, borderColor: SLColors.warning, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginLeft: -9 },
  positionMarkerCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: SLColors.warning },
  youAreHere: { position: 'absolute', bottom: 6 },
  youAreHereText: { ...SLTypography.utilityLabel, color: SLColors.warning, fontSize: 9 },
  blockTerritory: { marginBottom: 22 },
  blockHeading: { minHeight: 72, marginHorizontal: 12, borderRadius: 16, overflow: 'hidden', justifyContent: 'center', flexDirection: 'row', alignItems: 'center' },
  blockArtwork: { opacity: 0.28 },
  blockArtworkScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.66)' },
  blockTerritoryRail: { width: 4, alignSelf: 'stretch' },
  blockHeadingCopy: { flex: 1, paddingHorizontal: 14 },
  blockTitle: { ...SLTypography.sectionTitle, letterSpacing: 1.1 },
  blockMeta: { ...SLTypography.note, color: SLColors.textMuted, marginTop: 2 },
  blockState: { ...SLTypography.utilityLabel, marginRight: 14 },
  weekMap: { marginHorizontal: 14, paddingTop: 14 },
  mapRowWrap: { height: MAP_ROW_HEIGHT, justifyContent: 'center' },
  mapHorizontalPath: { position: 'absolute', left: '15%', right: '15%', top: 52, height: 2, backgroundColor: 'rgba(167,139,250,0.24)' },
  mapTurn: { position: 'absolute', top: 52, bottom: -60, width: 2, backgroundColor: 'rgba(167,139,250,0.24)' },
  mapTurnRight: { right: '15%' },
  mapTurnLeft: { left: '15%' },
  mapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mapRowReverse: { flexDirection: 'row-reverse' },
  weekNode: { width: '30.5%', minHeight: 96, borderRadius: 18, borderColor: SLColors.borderStandard, borderWidth: 1, backgroundColor: 'rgba(8,7,12,0.97)', padding: 10, justifyContent: 'space-between', overflow: 'visible' },
  weekNodeUnbuilt: { borderStyle: 'dashed', backgroundColor: 'rgba(5,5,9,0.94)' },
  weekNodeSelected: { borderColor: SLColors.accentViolet, backgroundColor: 'rgba(35,18,45,0.96)', transform: [{ scale: 1.025 }] },
  weekNodeCurrent: { borderColor: SLColors.warning, backgroundColor: 'rgba(40,30,17,0.96)' },
  currentPulse: { position: 'absolute', inset: -7, borderRadius: 24, borderColor: SLColors.warning, borderWidth: 2 },
  weekNodeStatus: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 3, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 },
  weekNodeTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3 },
  weekNodeNumber: { ...SLTypography.cardTitle, fontSize: 19 },
  currentPill: { borderRadius: 6, backgroundColor: SLColors.warning, paddingHorizontal: 5, paddingVertical: 2 },
  currentPillText: { ...SLTypography.utilityLabel, color: '#090704', fontSize: 7 },
  weekNodeFingerprint: { ...SLTypography.utilityLabel, color: SLColors.textSecondary, fontSize: 9 },
  weekNodeFingerprintUnbuilt: { color: SLColors.textSubtle },
  densityMarks: { flexDirection: 'row', gap: 4, minHeight: 8, alignItems: 'center' },
  densityMark: { width: 7, height: 7, borderRadius: 4 },
  densityEmpty: { width: 7, height: 7, borderRadius: 4, borderColor: SLColors.textSubtle, borderWidth: 1 },
  weekNodeSets: { ...SLTypography.note, color: SLColors.textMuted, fontSize: 10 },
  weekExpansion: { marginHorizontal: 12, marginTop: 10, borderRadius: 20, borderColor: SLColors.borderFocus, borderWidth: 1, backgroundColor: 'rgba(14,8,18,0.98)', padding: 12, overflow: 'visible' },
  expansionStem: { position: 'absolute', width: 2, height: 16, top: -17, left: '50%', backgroundColor: SLColors.accentViolet },
  expansionHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomColor: SLColors.borderHairline, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 10 },
  traverseButton: { width: 44, height: 44, borderRadius: 14, borderColor: SLColors.borderStandard, borderWidth: 1, backgroundColor: SLColors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  expansionIdentity: { flex: 1, minWidth: 0, alignItems: 'center' },
  expansionKicker: { ...SLTypography.utilityLabel, color: SLColors.accentViolet, textAlign: 'center' },
  expansionTitle: { ...SLTypography.cardTitle, color: SLColors.textStrong, fontSize: 18, textAlign: 'center' },
  expansionSummary: { ...SLTypography.note, color: SLColors.textMuted, textAlign: 'center', marginTop: 2 },
  sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingTop: 12 },
  sessionEntrance: { width: '48.5%' },
  sessionNode: { minHeight: 144, borderRadius: 16, borderColor: SLColors.borderStandard, borderWidth: 1, backgroundColor: SLColors.surfaceInset, padding: 10, justifyContent: 'space-between' },
  sessionNodeTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionDay: { ...SLTypography.utilityLabel, color: SLColors.textMuted, fontSize: 9 },
  sessionLifecycleDot: { width: 8, height: 8, borderRadius: 4 },
  sessionNodeBody: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 7 },
  sessionArt: { width: 50, height: 50, flexShrink: 0, borderRadius: 12, overflow: 'hidden', backgroundColor: SLColors.surfaceFlat, borderColor: SLColors.borderSubtle, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sessionCopy: { flex: 1, minWidth: 0, gap: 3 },
  sessionTitle: { ...SLTypography.cardTitle, color: SLColors.textStrong, fontSize: 14, lineHeight: 17 },
  sessionMeta: { ...SLTypography.note, color: SLColors.textMuted, fontSize: 10, lineHeight: 13 },
  sessionNodeFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopColor: SLColors.borderHairline, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 7 },
  sessionStateText: { ...SLTypography.utilityLabel, fontSize: 9 },
  unbuiltWeek: { minHeight: 90, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, borderRadius: 15, borderColor: SLColors.borderSubtle, borderWidth: 1, borderStyle: 'dashed', padding: 13 },
  unbuiltWeekIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: SLColors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  unbuiltWeekCopy: { flex: 1, gap: 3 },
  unbuiltWeekTitle: { ...SLTypography.cardTitle, color: SLColors.textStrong },
  unbuiltWeekBody: { ...SLTypography.note, color: SLColors.textMuted },
  swipeHint: { ...SLTypography.note, color: SLColors.textSubtle, textAlign: 'center', fontSize: 10, marginTop: 10 },
});
