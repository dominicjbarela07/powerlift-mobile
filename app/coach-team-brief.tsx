import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import {
  CoachMaterialLayer,
  type CoachMaterialTone,
} from '@/components/coach-mobile/coach-material-layer';
import RefreshScreen from '@/components/refresh-screen';
import { SLErrorState, SLLoadingState, SLScreen } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLLayout, SLRadius, SLSpacing, SLTypography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import {
  openCoachDestination,
  type CoachTeamBriefResponse,
} from '@/lib/coach-mobile';

type BriefItem = CoachTeamBriefResponse['items'][number];
type BriefTone = 'critical' | 'orange' | 'violet' | 'cyan' | 'green' | 'neutral';
type DisplayBriefItem = BriefItem & {
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: BriefTone;
};

const TONE_COLOR: Record<BriefTone, string> = {
  critical: SLColors.accentHot,
  orange: SLColors.accentOrange,
  violet: SLColors.accentViolet,
  cyan: '#3BC9FF',
  green: '#48C987',
  neutral: SLColors.textMuted,
};

const MATERIAL_TONE: Record<BriefTone, CoachMaterialTone> = {
  critical: 'critical',
  orange: 'action',
  violet: 'violet',
  cyan: 'cyan',
  green: 'on_track',
  neutral: 'neutral',
};

function briefTone(key: string): BriefTone {
  if (/program/i.test(key)) return 'critical';
  if (/review|video/i.test(key)) return 'orange';
  if (/check/i.test(key)) return 'cyan';
  if (/health|track|complete/i.test(key)) return 'green';
  return 'violet';
}

function briefIcon(key: string): keyof typeof Ionicons.glyphMap {
  if (/review|video/i.test(key)) return 'videocam-outline';
  if (/check/i.test(key)) return 'pulse-outline';
  if (/message/i.test(key)) return 'chatbubble-outline';
  if (/health|track|complete/i.test(key)) return 'checkmark-circle-outline';
  if (/meet/i.test(key)) return 'trophy-outline';
  if (/blind|quiet|feedback/i.test(key)) return 'eye-off-outline';
  return 'calendar-outline';
}

function updatedLabel(value?: string) {
  if (!value) return 'Updated now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Updated now';
  return `Updated ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function sectionFor(item: BriefItem) {
  if (item.section) return item.section;
  if (/check/i.test(item.key)) return 'blind_spots';
  if (/meet|deload|block/i.test(item.key)) return 'coming_up';
  return 'needs_attention';
}

export default function CoachTeamBriefScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const accountKey = user?.email || (user?.athlete_id ? `athlete:${user.athlete_id}` : null);
  const [brief, setBrief] = useState<CoachTeamBriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accountKeyRef = useRef(accountKey);
  const requestSequenceRef = useRef(0);

  const loadBrief = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!accountKey) return;
    const requestAccountKey = accountKey;
    const requestSequence = ++requestSequenceRef.current;
    const isCurrentRequest = () => (
      accountKeyRef.current === requestAccountKey
      && requestSequenceRef.current === requestSequence
    );
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await fetchJson<CoachTeamBriefResponse>('/coach/mobile/team-brief', {
        method: 'GET',
      });
      if (!isCurrentRequest()) return;
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (!response.ok || !response.json?.ok) {
        throw new Error(response.json?.error || `Unable to load Team Brief (${response.status}).`);
      }
      setBrief(response.json);
    } catch (err: any) {
      if (!isCurrentRequest()) return;
      setError(err?.message || 'Unable to load Team Brief.');
    } finally {
      if (isCurrentRequest()) setLoading(false);
    }
  }, [accountKey, router]);

  useEffect(() => {
    accountKeyRef.current = accountKey;
    requestSequenceRef.current += 1;
    setBrief(null);
    setError(null);
    setLoading(true);
  }, [accountKey]);

  useFocusEffect(useCallback(() => {
    void loadBrief();
  }, [loadBrief]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadBrief({ silent: true });
    });
    return () => subscription.remove();
  }, [loadBrief]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadBrief({ silent: true });
    setRefreshing(false);
  }, [loadBrief]);

  const openRosterFilter = useCallback((filter: string) => {
    router.replace({
      pathname: '/(tabs)/coach-dashboard',
      params: { filter, roster: '1' },
    } as any);
  }, [router]);

  const closeTeamBrief = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    // A cold/deep-link launch has no underlying screen to reveal.
    router.replace('/(tabs)/coach-dashboard');
  }, [router]);

  return (
    <SLScreen contentStyle={styles.screenContent} edges="top" padded={false}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Close Team Brief"
          accessibilityRole="button"
          hitSlop={8}
          onPress={closeTeamBrief}
          style={styles.iconButton}
        >
          <Ionicons color={SLColors.iconPrimary} name="close" size={20} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text typographyRole="badge" style={styles.coachModeLabel}>COACH MODE</Text>
          <Text typographyRole="pageTitle" style={styles.headerTitle}>Team Brief</Text>
        </View>
        <Pressable
          accessibilityLabel="Invite athlete"
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/coach-invite-athlete' as any)}
          style={[styles.iconButton, styles.iconButtonEmphasized]}
        >
          <Ionicons color={SLColors.accentMuted} name="add" size={20} />
        </Pressable>
      </View>

      <RefreshScreen
        contentContainerStyle={styles.content}
        onRefresh={refresh}
        refreshing={refreshing}
      >
        {loading && !brief ? (
          <SLLoadingState message="Prioritizing the team..." title="Loading Team Brief" />
        ) : null}

        {error && !brief ? (
          <SLErrorState
            actionLabel="Try Again"
            message={error}
            onActionPress={() => loadBrief()}
            title="Could not load Team Brief"
          />
        ) : null}

        {brief ? (
          <>
            <View style={styles.updatedRow}>
              <Text typographyRole="caption" style={styles.updatedTime}>{updatedLabel(brief.generated_at)}</Text>
            </View>

            <BriefSection
              items={brief.items.filter((item) => sectionFor(item) === 'needs_attention')}
              onOpen={(item) => openCoachDestination(router, item.destination)}
              title="Needs Attention"
            />

            {brief.items.length === 0 ? (
              <BriefSection
                items={[{
                  key: 'team-clear',
                  headline: 'No urgent items',
                  supporting_line: 'The roster is clear today.',
                  action_label: 'Open',
                  destination: { route: '/(tabs)/coach-dashboard', params: { filter: 'all', roster: '1' } },
                  tone: 'green',
                  icon: 'checkmark-circle-outline',
                }]}
                onOpen={() => openRosterFilter('all')}
                title="Needs Attention"
              />
            ) : null}

            <BriefSection
              fullWidth
              items={brief.items.filter((item) => sectionFor(item) === 'coming_up')}
              onOpen={(item) => openCoachDestination(router, item.destination)}
              title="Coming Up"
            />

            <BriefSection
              items={[
                {
                  key: 'team-health-on-track',
                  headline: 'On track',
                  supporting_line: `${brief.team_health.on_track} of ${brief.team_health.athletes} athletes.`,
                  action_label: 'Open',
                  destination: { route: '/(tabs)/coach-dashboard', params: { filter: 'all', roster: '1' } },
                  tone: 'green',
                  icon: 'checkmark-circle-outline',
                },
                {
                  key: 'team-health-monitor',
                  headline: 'Monitor',
                  supporting_line: `${brief.team_health.monitor} athlete${brief.team_health.monitor === 1 ? '' : 's'} to watch.`,
                  action_label: 'Open',
                  destination: { route: '/(tabs)/coach-dashboard', params: { filter: 'needs_attention', roster: '1' } },
                  tone: 'orange',
                  icon: 'pulse-outline',
                },
                {
                  key: 'team-health-attention',
                  headline: 'Needs attention',
                  supporting_line: `${brief.team_health.needs_attention} athlete${brief.team_health.needs_attention === 1 ? '' : 's'}.`,
                  action_label: 'Open',
                  destination: { route: '/(tabs)/coach-dashboard', params: { filter: 'needs_attention', roster: '1' } },
                  tone: 'critical',
                  icon: 'alert-circle-outline',
                },
              ]}
              onOpen={(item) => openCoachDestination(router, item.destination)}
              title="Team Health"
            />

            <BriefSection
              fullWidth
              items={brief.items.filter((item) => sectionFor(item) === 'blind_spots')}
              onOpen={(item) => openCoachDestination(router, item.destination)}
              title="Blind Spots"
            />
          </>
        ) : null}
      </RefreshScreen>
    </SLScreen>
  );
}

function BriefSection({
  fullWidth = false,
  items,
  onOpen,
  title,
}: {
  fullWidth?: boolean;
  items: DisplayBriefItem[];
  onOpen: (item: DisplayBriefItem) => void;
  title: string;
}) {
  if (!items.length) return null;
  return (
    <View accessibilityRole="summary" style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text typographyRole="sectionTitle" style={styles.sectionLabel}>{title}</Text>
        <Text typographyRole="badge" style={styles.sectionCount}>{items.length}</Text>
      </View>
      <View style={styles.itemGrid}>
        {items.map((item) => {
          const tone = item.tone || briefTone(item.key);
          const color = TONE_COLOR[tone];
          return (
            <Pressable
              accessibilityLabel={`${item.headline}. ${item.supporting_line}. ${item.action_label}`}
              accessibilityRole="button"
              key={item.key}
              onPress={() => onOpen(item)}
              style={({ pressed }) => [
                styles.itemCard,
                fullWidth ? styles.itemCardFull : styles.itemCardHalf,
                pressed && styles.pressed,
              ]}
            >
              <CoachMaterialLayer
                borderRadius={SLRadius.radiusControl}
                emphasis="quiet"
                tone={MATERIAL_TONE[tone]}
              />
              <View style={styles.itemHeader}>
                <View style={[styles.itemIcon, { backgroundColor: `${color}18` }]}>
                  <Ionicons color={color} name={item.icon || briefIcon(item.key)} size={16} />
                </View>
                <View style={styles.actionLine}>
                  <Text typographyRole="button" style={[styles.actionText, { color }]}>
                    {item.action_label}
                  </Text>
                  <Ionicons color={color} name="arrow-forward" size={13} />
                </View>
              </View>
              <Text typographyRole="bodyStrong" style={styles.itemHeadline}>{item.headline}</Text>
              <Text typographyRole="caption" style={styles.supportingLine}>{item.supporting_line}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {},
  header: {
    alignItems: 'center',
    borderBottomColor: SLColors.borderHairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 62,
    paddingHorizontal: SLLayout.screenGutter,
  },
  headerTitleWrap: { flex: 1, minWidth: 0 },
  coachModeLabel: { color: SLColors.accentMuted, letterSpacing: 1.2 },
  headerTitle: { color: SLColors.textPrimary, fontSize: 24, lineHeight: 28, marginTop: 1 },
  iconButton: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceFlat,
    borderColor: SLColors.borderStandard,
    borderRadius: SLRadius.radiusControl,
    borderWidth: StyleSheet.hairlineWidth,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconButtonEmphasized: {
    backgroundColor: SLColors.accentSoft,
    borderColor: SLColors.borderFocus,
  },
  content: {
    gap: SLSpacing.lg,
    paddingBottom: 116,
  },
  updatedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
  },
  updatedTime: { color: SLColors.textMuted },
  section: { gap: 9 },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionLabel: {
    color: SLColors.textPrimary,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  sectionCount: { color: SLColors.textMuted },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemCard: {
    borderRadius: SLRadius.radiusControl,
    minHeight: 104,
    overflow: 'hidden',
    padding: 12,
  },
  itemCardHalf: { width: '48.7%' },
  itemCardFull: { minHeight: 92, width: '100%' },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemIcon: {
    alignItems: 'center',
    borderRadius: 9,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  actionLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  actionText: { fontSize: 10 },
  itemHeadline: {
    color: SLColors.textPrimary,
    fontSize: 14,
    lineHeight: 17,
    marginTop: 9,
  },
  supportingLine: {
    color: SLColors.textSecondary,
    lineHeight: 15,
    marginTop: 3,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
