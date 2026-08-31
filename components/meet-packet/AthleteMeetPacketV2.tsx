import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { StrengthLedgerBottomSheet } from '@/components/sheets/StrengthLedgerBottomSheet';
import { SLMotionPressable } from '@/components/ui/sl-motion';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLShadows } from '@/constants/theme';
import { resolvePlateStackRender } from '@/lib/barbell/plate-stack-render-resolver';
import { convertDisplayWeightValue, formatWeightFromKg, type DisplayWeightUnit } from '@/lib/display-units';

export type MeetLift = 'SQ' | 'BN' | 'DL';
export type MeetPacketTab = 'overview' | 'warmups' | 'attempts' | 'bag' | 'more';

export type MeetPacketAttempt = Readonly<{
  id: number;
  lift?: string | null;
  attempt_number: number;
  weight_kg: number | null;
  min_weight_kg?: number | null;
  target_weight_kg?: number | null;
  max_weight_kg?: number | null;
  pct_tm?: number | null;
  strategy_tag?: string | null;
  strategy_note?: string | null;
  notes?: string | null;
  result?: Readonly<{ result: string; actual_weight_kg?: number | null; notes?: string | null }> | null;
}>;

export type MeetPacketWarmup = Readonly<{
  id: number;
  order_idx: number;
  weight_kg: number | null;
  reps: number | null;
  minutes_until_opener?: number | null;
  label?: string | null;
  is_completed?: boolean;
  completed_at?: string | null;
}>;

export type MeetPacketPayload = Readonly<{
  meet: Readonly<{
    id: number;
    name: string | null;
    date?: string | null;
    date_display: string | null;
    federation: string | null;
    weight_class: string | null;
    location: string | null;
    flight_platform: string | null;
    weigh_in_day_label: string | null;
    weigh_in_time_display: string | null;
    weigh_in_bodyweight_kg?: number | null;
    start_time_display: string | null;
    start_time?: string | null;
    status: string | null;
    status_label?: string | null;
    coach_notes?: string | null;
    can_start_meet?: boolean;
    can_start_meet_blockers?: string[];
    can_finish_meet?: boolean;
    rack_heights: Readonly<{ squat: string | null; bench: string | null; bench_safety: string | null }>;
  }>;
  lift_order?: MeetLift[];
  lift_labels?: Partial<Record<MeetLift, string>>;
  attempts?: Partial<Record<MeetLift, MeetPacketAttempt[]>>;
  warmups?: Partial<Record<MeetLift, MeetPacketWarmup[]>>;
  meet_bag?: Readonly<{ items: string[]; checked_items: string[]; packed_count: number; total_count: number; is_complete: boolean }>;
  notes?: readonly Readonly<{ id: number; category?: string | null; body?: string | null }>[];
  result_summary?: Readonly<{
    total_kg: number | null;
    attempts_made: number;
    attempts_taken: number;
    best_squat_kg: number | null;
    best_bench_kg: number | null;
    best_deadlift_kg: number | null;
  }> | null;
}>;

type DetailDraft = {
  location: string;
  flight_platform: string;
  weight_class: string;
  weigh_in_bodyweight: string;
  squat_rack_height: string;
  bench_rack_height: string;
  bench_safety_height: string;
};

type Props = Readonly<{
  payload: MeetPacketPayload;
  unit: DisplayWeightUnit;
  onUnitChange: (unit: DisplayWeightUnit) => void;
  onStartMeet: () => Promise<void> | void;
  onFinishMeet: () => Promise<void> | void;
  onOpenAttempt: (attempt: MeetPacketAttempt) => void;
  onSaveDetails: (draft: DetailDraft) => Promise<boolean>;
  onSaveMeetBag: (items: string[], checkedItems: string[]) => Promise<boolean>;
  onToggleWarmup: (warmup: MeetPacketWarmup, completed: boolean) => Promise<boolean>;
}>;

const LIFT_LABELS: Record<MeetLift, string> = { SQ: 'Squat', BN: 'Bench', DL: 'Deadlift' };
const BAG_GROUPS = [
  { title: 'Competition', items: ['Singlet', 'Belt', 'Knee sleeves / wraps', 'Wrist wraps'] },
  { title: 'Footwear', items: ['Squat shoes', 'Bench shoes', 'Deadlift shoes'] },
  { title: 'Essentials', items: ['Deadlift socks', 'ID / membership card', 'Food + electrolytes'] },
] as const;
const DEFAULT_BAG_ITEMS = BAG_GROUPS.flatMap((group) => [...group.items]);
const MEET_BAG_ASSET = require('@/assets/images/meet-packet-v2/meet-bag-v1.png');

function displayWeight(value: number | null | undefined, unit: DisplayWeightUnit) {
  return formatWeightFromKg(value, unit) || '—';
}

function displayNumber(value: number | null | undefined, unit: DisplayWeightUnit) {
  if (value == null || !Number.isFinite(value)) return null;
  return convertDisplayWeightValue(value, 'kg', unit).toFixed(1).replace(/\.0$/, '');
}

function attemptLoad(attempt: MeetPacketAttempt, unit: DisplayWeightUnit) {
  if (attempt.result?.actual_weight_kg != null) return displayWeight(attempt.result.actual_weight_kg, unit);
  const low = displayNumber(attempt.min_weight_kg, unit);
  const high = displayNumber(attempt.max_weight_kg, unit);
  if (attempt.attempt_number > 1 && low && high) return `${low}–${high} ${unit}`;
  return displayWeight(attempt.target_weight_kg ?? attempt.weight_kg, unit);
}

function attemptName(number: number) {
  if (number === 1) return 'Opener';
  if (number === 2) return 'Second';
  return number === 3 ? 'Third' : `Attempt ${number}`;
}

function warmupPercentage(warmup: MeetPacketWarmup, opener?: MeetPacketAttempt) {
  const openerKg = opener?.target_weight_kg ?? opener?.weight_kg;
  if (!warmup.weight_kg || !openerKg) return null;
  return Math.round((warmup.weight_kg / openerKg) * 100);
}

function plateRender(weightKg: number | null | undefined, unit: DisplayWeightUnit) {
  if (!weightKg) return null;
  const weight = convertDisplayWeightValue(weightKg, 'kg', unit);
  return resolvePlateStackRender({ weight, unit });
}

function feedback(kind: 'selection' | 'success' = 'selection') {
  if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  else void Haptics.selectionAsync().catch(() => undefined);
}

function useMeetCountdown(meet: MeetPacketPayload['meet'], warmup: MeetPacketWarmup | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!meet.date || !meet.start_time || warmup?.minutes_until_opener == null) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [meet.date, meet.start_time, warmup?.minutes_until_opener]);
  if (!meet.date || !meet.start_time || warmup?.minutes_until_opener == null) return null;
  const openerAt = new Date(`${meet.date}T${meet.start_time}:00`).getTime();
  if (!Number.isFinite(openerAt)) return null;
  const targetAt = openerAt - (warmup.minutes_until_opener * 60_000);
  const remaining = Math.max(0, targetAt - now);
  const totalSeconds = Math.floor(remaining / 1000);
  return { due: remaining <= 0, label: `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}` };
}

function ActionButton({ disabled, label, loading, onPress, tone = 'gold' }: { disabled?: boolean; label: string; loading?: boolean; onPress: () => void; tone?: 'gold' | 'violet' | 'quiet' }) {
  return (
    <SLMotionPressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => { feedback(); onPress(); }}
      style={[styles.actionButton, tone === 'gold' ? styles.actionGold : tone === 'violet' ? styles.actionViolet : styles.actionQuiet, (disabled || loading) && styles.disabled]}
    >
      {loading ? <ActivityIndicator color={tone === 'quiet' ? SLColors.textPrimary : SLColors.textInverted} size="small" /> : null}
      <Text style={[styles.actionLabel, tone === 'quiet' && styles.actionQuietLabel]}>{loading ? 'Working…' : label}</Text>
      {!loading ? <Ionicons color={tone === 'quiet' ? SLColors.textSecondary : SLColors.textInverted} name="chevron-forward" size={17} /> : null}
    </SLMotionPressable>
  );
}

export function AthleteMeetPacketV2({ payload, unit, onUnitChange, onStartMeet, onFinishMeet, onOpenAttempt, onSaveDetails, onSaveMeetBag, onToggleWarmup }: Props) {
  const { meet } = payload;
  const liftOrder = useMemo(
    () => payload.lift_order?.length ? payload.lift_order : (['SQ', 'BN', 'DL'] as MeetLift[]),
    [payload.lift_order],
  );
  const labels = { ...LIFT_LABELS, ...(payload.lift_labels || {}) };
  const lifecycle = meet.status === 'active' ? 'live' : meet.status === 'completed' || meet.status === 'archived' ? 'complete' : 'pre';
  const [tab, setTab] = useState<MeetPacketTab>('overview');
  const [activeLift, setActiveLift] = useState<MeetLift>(liftOrder[0] || 'SQ');
  const [sheet, setSheet] = useState<'menu' | 'details' | 'platform' | 'attempts' | 'warmups' | 'focus' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [checkedBag, setCheckedBag] = useState<Record<string, boolean>>(() => Object.fromEntries((payload.meet_bag?.checked_items || []).map((item) => [item, true])));
  const [customBagItems, setCustomBagItems] = useState<string[]>(() => (payload.meet_bag?.items || []).filter((item) => !DEFAULT_BAG_ITEMS.includes(item as never)));
  const [newBagItem, setNewBagItem] = useState('');
  const [localWarmups, setLocalWarmups] = useState<Record<number, boolean>>(() => {
    const next: Record<number, boolean> = {};
    Object.values(payload.warmups || {}).flat().forEach((warmup) => { next[warmup.id] = !!warmup.is_completed; });
    return next;
  });
  const [draft, setDraft] = useState<DetailDraft>({
    location: meet.location || '', flight_platform: meet.flight_platform || '', weight_class: meet.weight_class || '',
    weigh_in_bodyweight: displayNumber(meet.weigh_in_bodyweight_kg, unit) || '', squat_rack_height: meet.rack_heights.squat || '',
    bench_rack_height: meet.rack_heights.bench || '', bench_safety_height: meet.rack_heights.bench_safety || '',
  });

  useEffect(() => {
    const nextWarmups: Record<number, boolean> = {};
    Object.values(payload.warmups || {}).flat().forEach((warmup) => { nextWarmups[warmup.id] = !!warmup.is_completed; });
    setLocalWarmups(nextWarmups);
    setCheckedBag(Object.fromEntries((payload.meet_bag?.checked_items || []).map((item) => [item, true])));
    setCustomBagItems((payload.meet_bag?.items || []).filter((item) => !DEFAULT_BAG_ITEMS.includes(item as never)));
  }, [payload.meet.id, payload.meet_bag, payload.warmups]);

  const warmups = payload.warmups?.[activeLift] || [];
  const completedWarmups = warmups.filter((item) => localWarmups[item.id]);
  const activeWarmup = warmups.find((item) => !localWarmups[item.id]) || null;
  const allBagItems = [...DEFAULT_BAG_ITEMS, ...customBagItems];
  const packedCount = allBagItems.filter((item) => checkedBag[item]).length;
  const attemptsReady = liftOrder.every((lift) => (payload.attempts?.[lift] || []).length >= 3);
  const warmupsReady = liftOrder.every((lift) => (payload.warmups?.[lift] || []).length > 0);
  const logisticsReady = !!meet.location && !!meet.flight_platform;
  const racksReady = !!meet.rack_heights.squat && !!meet.rack_heights.bench && !!meet.rack_heights.bench_safety;
  const bagReady = packedCount === allBagItems.length && allBagItems.length > 0;
  const readiness = [
    { label: 'Attempts loaded', ready: attemptsReady, target: 'attempts' as const },
    { label: 'Warmups ready', ready: warmupsReady, target: 'warmups' as const },
    { label: 'Meet bag complete', ready: bagReady, target: 'bag' as const },
    { label: 'Logistics set', ready: logisticsReady, target: 'details' as const },
    { label: 'Rack heights set', ready: racksReady, target: 'platform' as const },
  ];
  const readyCount = readiness.filter((item) => item.ready).length;
  const nextAttempt = useMemo(() => {
    for (const lift of liftOrder) {
      const pending = (payload.attempts?.[lift] || []).find((attempt) => !attempt.result);
      if (pending) return { lift, attempt: pending };
    }
    return null;
  }, [liftOrder, payload.attempts]);

  const switchTab = (value: MeetPacketTab) => {
    feedback();
    if (value === 'more') setSheet('menu');
    else setTab(value);
  };
  const toggleWarmup = async (warmup: MeetPacketWarmup) => {
    const next = !localWarmups[warmup.id];
    setBusy(`warmup-${warmup.id}`);
    const ok = await onToggleWarmup(warmup, next);
    if (ok) { setLocalWarmups((current) => ({ ...current, [warmup.id]: next })); feedback('success'); }
    setBusy(null);
  };
  const saveDetails = async () => {
    setBusy('details');
    const ok = await onSaveDetails(draft);
    setBusy(null);
    if (ok) { feedback('success'); setSheet(null); }
  };
  const persistBag = async (items: string[], checked: Record<string, boolean>) => {
    setBusy('bag');
    const ok = await onSaveMeetBag(items, items.filter((item) => checked[item]));
    setBusy(null);
    if (ok) feedback('success');
    return ok;
  };

  const tabBody = tab === 'warmups'
    ? <WarmupSurface activeLift={activeLift} busy={busy} labels={labels} liftOrder={liftOrder} localWarmups={localWarmups} onLift={setActiveLift} onToggle={toggleWarmup} payload={payload} unit={unit} />
    : tab === 'attempts'
      ? <AttemptsSurface activeLift={activeLift} labels={labels} liftOrder={liftOrder} onLift={setActiveLift} onOpenAttempt={onOpenAttempt} payload={payload} unit={unit} />
      : tab === 'bag'
        ? <BagSurface busy={busy === 'bag'} checked={checkedBag} customItems={customBagItems} newItem={newBagItem} onAdd={() => { const value = newBagItem.trim(); if (!value) return; feedback(); const nextCustom = [...customBagItems, value]; setCustomBagItems(nextCustom); setNewBagItem(''); void persistBag([...DEFAULT_BAG_ITEMS, ...nextCustom], checkedBag); }} onChangeNewItem={setNewBagItem} onRemove={(item) => { const nextCustom = customBagItems.filter((value) => value !== item); const nextChecked = { ...checkedBag, [item]: false }; setCustomBagItems(nextCustom); setCheckedBag(nextChecked); void persistBag([...DEFAULT_BAG_ITEMS, ...nextCustom], nextChecked); }} onToggle={(item) => { feedback(); const nextChecked = { ...checkedBag, [item]: !checkedBag[item] }; setCheckedBag(nextChecked); void persistBag(allBagItems, nextChecked); }} />
        : lifecycle === 'live'
          ? <LiveOverview activeLift={activeLift} activeWarmup={activeWarmup} completedWarmups={completedWarmups.length} labels={labels} nextAttempt={nextAttempt} onLift={setActiveLift} onOpenAttempt={onOpenAttempt} onToggleWarmup={toggleWarmup} payload={payload} unit={unit} warmupBusy={busy} warmups={warmups} />
          : lifecycle === 'complete'
            ? <CompleteOverview labels={labels} payload={payload} unit={unit} />
            : <PreMeetOverview meet={meet} onOpen={(target) => target === 'bag' ? setTab('bag') : setSheet(target)} readiness={readiness} readyCount={readyCount} />;

  return (
    <View style={styles.screen} testID="athlete-meet-packet-v2">
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>{lifecycle === 'live' ? 'MEET DAY · LIVE' : lifecycle === 'complete' ? 'COMPETITION RECORD' : 'MEET PACKET'}</Text>
            <Text style={styles.headerTitle}>{meet.name || 'Meet'}</Text>
            <Text style={styles.headerMeta}>{[meet.federation, meet.weight_class, meet.date_display].filter(Boolean).join(' · ')}</Text>
          </View>
          <View style={[styles.lifecycleBadge, lifecycle === 'live' ? styles.lifecycleLive : lifecycle === 'complete' ? styles.lifecycleComplete : null]}>
            <View style={[styles.lifecycleDot, lifecycle === 'live' ? styles.lifecycleDotLive : lifecycle === 'complete' ? styles.lifecycleDotComplete : null]} />
            <Text style={styles.lifecycleText}>{lifecycle === 'live' ? 'LIVE' : lifecycle === 'complete' ? 'COMPLETE' : 'PRE-MEET'}</Text>
          </View>
        </View>
        {tabBody}
        {lifecycle === 'live' && meet.can_finish_meet && tab === 'overview' ? <ActionButton label="Finish Meet" onPress={() => void onFinishMeet()} tone="quiet" /> : null}
      </ScrollView>

      <View style={styles.unitControlWrap}>
        <SLMotionPressable accessibilityLabel={`Display unit ${unit}. Switch units`} onPress={() => { feedback(); onUnitChange(unit === 'lb' ? 'kg' : 'lb'); }} style={styles.unitControl}>
          <Text style={styles.unitControlText}>{unit}</Text>
        </SLMotionPressable>
      </View>

      <View style={styles.navigation}>
        {([
          ['overview', 'home-outline', 'Overview'], ['warmups', 'flame-outline', 'Warmups'], ['attempts', 'podium-outline', 'Attempts'], ['bag', 'bag-handle-outline', 'Bag'], ['more', 'grid-outline', 'More'],
        ] as const).map(([key, icon, label]) => {
          const active = tab === key;
          return <Pressable key={key} onPress={() => switchTab(key)} style={({ pressed }) => [styles.navItem, active && styles.navItemActive, pressed && styles.pressed]}><Ionicons color={active ? SLColors.warning : SLColors.textMuted} name={icon} size={19} /><Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text></Pressable>;
        })}
      </View>

      <MeetToolkitSheet onClose={() => setSheet(null)} onOpen={setSheet} visible={sheet === 'menu'} />
      <DetailsSheet busy={busy === 'details'} draft={draft} onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} onClose={() => setSheet(null)} onSave={saveDetails} unit={unit} visible={sheet === 'details'} />
      <PlatformSheet busy={busy === 'details'} draft={draft} onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} onClose={() => setSheet(null)} onSave={saveDetails} visible={sheet === 'platform'} />
      <ReferenceSheet activeLift={activeLift} kind={sheet === 'attempts' || sheet === 'warmups' || sheet === 'focus' ? sheet : null} labels={labels} onClose={() => setSheet(null)} onLift={setActiveLift} onOpenAttempt={(attempt) => { setSheet(null); onOpenAttempt(attempt); }} payload={payload} unit={unit} />

      {lifecycle === 'pre' ? <View style={styles.primaryDock}><ActionButton label={readyCount === 5 ? 'Start Meet Day' : `Complete ${5 - readyCount} Item${5 - readyCount === 1 ? '' : 's'}`} loading={busy === 'start'} onPress={async () => { const missing = readiness.find((item) => !item.ready); if (missing) { if (missing.target === 'bag') setTab('bag'); else setSheet(missing.target); return; } if (!meet.can_start_meet) { setSheet('details'); return; } setBusy('start'); try { await onStartMeet(); } finally { setBusy(null); } }} /></View> : null}
    </View>
  );
}

function PreMeetOverview({ meet, onOpen, readiness, readyCount }: { meet: MeetPacketPayload['meet']; onOpen: (target: 'attempts' | 'warmups' | 'bag' | 'details' | 'platform') => void; readiness: { label: string; ready: boolean; target: 'attempts' | 'warmups' | 'bag' | 'details' | 'platform' }[]; readyCount: number }) {
  return <View style={styles.stack}>
    <View style={[styles.readinessHero, readyCount === 5 && styles.readinessHeroReady]}>
      <View style={styles.readinessRing}><Text style={styles.readinessFraction}>{readyCount}/5</Text><Text style={styles.readinessRingLabel}>READY</Text></View>
      <View style={styles.readinessCopy}><Text style={styles.cardEyebrow}>{readyCount === 5 ? 'READY FOR MEET DAY' : `${5 - readyCount} ITEM${5 - readyCount === 1 ? '' : 'S'} BEFORE MEET DAY`}</Text><Text style={styles.cardBody}>{readyCount === 5 ? 'Your competition packet is prepared.' : 'Complete the highlighted preparation items.'}</Text></View>
    </View>
    <View style={styles.card}>{readiness.map((item) => <Pressable key={item.label} onPress={() => !item.ready && onOpen(item.target)} style={({ pressed }) => [styles.readinessRow, pressed && styles.pressed]}><Ionicons color={item.ready ? SLColors.success : SLColors.danger} name={item.ready ? 'checkmark-circle' : 'alert-circle-outline'} size={20} /><Text style={styles.readinessLabel}>{item.label}</Text><Text style={[styles.readinessState, !item.ready && styles.readinessNeeds] }>{item.ready ? 'Ready' : 'Needs info'}</Text>{!item.ready ? <Ionicons color={SLColors.textMuted} name="chevron-forward" size={16} /> : null}</Pressable>)}</View>
    <View style={styles.card}><Text style={styles.sectionTitle}>Meet Summary</Text><InfoRow icon="scale-outline" label="Weigh-in" value={[meet.weigh_in_day_label, meet.weigh_in_time_display].filter(Boolean).join(' · ') || 'TBD'} /><InfoRow icon="flag-outline" label="Flight / Platform" value={meet.flight_platform || 'TBD'} /><InfoRow icon="time-outline" label="Start Time" value={meet.start_time_display || 'TBD'} /><InfoRow icon="location-outline" label="Location" value={meet.location || 'TBD'} /></View>
    {meet.coach_notes ? <CoachFocus text={meet.coach_notes} /> : null}
  </View>;
}

function LiveOverview({ activeLift, activeWarmup, completedWarmups, labels, nextAttempt, onLift, onOpenAttempt, onToggleWarmup, payload, unit, warmupBusy, warmups }: { activeLift: MeetLift; activeWarmup: MeetPacketWarmup | null; completedWarmups: number; labels: Record<MeetLift, string>; nextAttempt: { lift: MeetLift; attempt: MeetPacketAttempt } | null; onLift: (lift: MeetLift) => void; onOpenAttempt: (attempt: MeetPacketAttempt) => void; onToggleWarmup: (warmup: MeetPacketWarmup) => void; payload: MeetPacketPayload; unit: DisplayWeightUnit; warmupBusy: string | null; warmups: MeetPacketWarmup[] }) {
  const opener = payload.attempts?.[activeLift]?.[0];
  const render = plateRender(activeWarmup?.weight_kg, unit);
  const countdown = useMeetCountdown(payload.meet, activeWarmup);
  return <View style={styles.stack}>
    <LiftSelector active={activeLift} labels={labels} lifts={payload.lift_order || ['SQ', 'BN', 'DL']} onChange={onLift} />
    <View style={styles.liveHero}>
      <View style={styles.liveHeroTop}><View><Text style={styles.cardEyebrow}>NOW</Text><Text style={styles.liveStep}>Warmup {activeWarmup ? completedWarmups + 1 : warmups.length} of {warmups.length}</Text></View><Text style={styles.livePlatform}>{payload.meet.flight_platform || 'Platform TBD'}</Text></View>
      {activeWarmup ? <><Text style={styles.liveLoad}>{displayWeight(activeWarmup.weight_kg, unit)} × {activeWarmup.reps ?? '—'}</Text><Text style={styles.liveContext}>{[warmupPercentage(activeWarmup, opener) ? `${warmupPercentage(activeWarmup, opener)}% of opener` : null, activeWarmup.minutes_until_opener != null ? `~${activeWarmup.minutes_until_opener} min before flight` : null].filter(Boolean).join(' · ')}</Text>{render ? <Image accessibilityLabel={`${displayWeight(activeWarmup.weight_kg, unit)} plate stack`} resizeMode="contain" source={render.imageSource} style={styles.livePlateRender} /> : <View style={styles.renderFallback}><Ionicons color={SLColors.warning} name="barbell-outline" size={58} /></View>}<ActionButton label="Complete Warmup" loading={warmupBusy === `warmup-${activeWarmup.id}`} onPress={() => onToggleWarmup(activeWarmup)} /></> : <><Text style={styles.liveLoad}>Warmups complete</Text><Text style={styles.liveContext}>Move to the platform when called.</Text></>}
    </View>
    <WarmupRail activeId={activeWarmup?.id || null} localWarmups={Object.fromEntries(warmups.map((item) => [item.id, item.id !== activeWarmup?.id && warmups.indexOf(item) < completedWarmups]))} opener={opener} unit={unit} warmups={warmups} />
    {countdown && activeWarmup ? <View style={styles.timerCard}><View><Text style={styles.cardEyebrow}>NEXT WARMUP {countdown.due ? 'DUE' : 'IN'}</Text><Text style={styles.timerValue}>{countdown.due ? 'NOW' : countdown.label}</Text></View><View style={styles.timerContext}><Text style={styles.nextTitle}>{displayWeight(activeWarmup.weight_kg, unit)} × {activeWarmup.reps ?? '—'}</Text><Text style={styles.nextMeta}>{warmupPercentage(activeWarmup, opener) ? `${warmupPercentage(activeWarmup, opener)}% opener` : 'Timing guidance'}</Text></View></View> : null}
    {nextAttempt ? <Pressable onPress={() => { onLift(nextAttempt.lift); onOpenAttempt(nextAttempt.attempt); }} style={({ pressed }) => [styles.nextCard, pressed && styles.pressed]}><View><Text style={styles.cardEyebrow}>NEXT ATTEMPT</Text><Text style={styles.nextTitle}>{labels[nextAttempt.lift]} · {attemptName(nextAttempt.attempt.attempt_number)}</Text><Text style={styles.nextMeta}>{attemptLoad(nextAttempt.attempt, unit)}</Text></View><Ionicons color={SLColors.warning} name="chevron-forward" size={22} /></Pressable> : null}
    {payload.meet.coach_notes ? <CoachFocus text={payload.meet.coach_notes} /> : null}
  </View>;
}

function CompleteOverview({ labels, payload, unit }: { labels: Record<MeetLift, string>; payload: MeetPacketPayload; unit: DisplayWeightUnit }) {
  const summary = payload.result_summary;
  return <View style={styles.stack}><View style={styles.completeHero}><Ionicons color={SLColors.success} name="checkmark-circle" size={48} /><Text style={styles.completeTitle}>Meet Complete</Text><Text style={styles.completeTotal}>{displayWeight(summary?.total_kg, unit)} Total</Text><Text style={styles.cardBody}>{summary ? `${summary.attempts_made} of ${summary.attempts_taken} attempts made` : 'Competition record preserved.'}</Text></View><View style={styles.threeColumn}>{(['SQ', 'BN', 'DL'] as MeetLift[]).map((lift) => <View key={lift} style={styles.metricCell}><Text style={styles.metricLabel}>{labels[lift]}</Text><Text style={styles.metricValue}>{displayWeight(lift === 'SQ' ? summary?.best_squat_kg : lift === 'BN' ? summary?.best_bench_kg : summary?.best_deadlift_kg, unit)}</Text></View>)}</View><AttemptsSurface activeLift="SQ" labels={labels} liftOrder={payload.lift_order || ['SQ', 'BN', 'DL']} onLift={() => undefined} onOpenAttempt={() => undefined} payload={payload} unit={unit} /></View>;
}

function WarmupSurface({ activeLift, busy, labels, liftOrder, localWarmups, onLift, onToggle, payload, unit }: { activeLift: MeetLift; busy: string | null; labels: Record<MeetLift, string>; liftOrder: MeetLift[]; localWarmups: Record<number, boolean>; onLift: (lift: MeetLift) => void; onToggle: (warmup: MeetPacketWarmup) => void; payload: MeetPacketPayload; unit: DisplayWeightUnit }) {
  const warmups = payload.warmups?.[activeLift] || []; const opener = payload.attempts?.[activeLift]?.[0];
  return <View style={styles.stack}><LiftSelector active={activeLift} labels={labels} lifts={liftOrder} onChange={onLift} /><View style={styles.card}><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>{labels[activeLift]} Warmups</Text><Text style={styles.sectionMeta}>{warmups.filter((item) => localWarmups[item.id]).length} / {warmups.length} complete</Text></View></View>{warmups.map((warmup, index) => { const complete = !!localWarmups[warmup.id]; const render = plateRender(warmup.weight_kg, unit); return <SLMotionPressable key={warmup.id} onPress={() => onToggle(warmup)} style={[styles.warmupRow, complete && styles.warmupRowComplete]}><View style={[styles.stepCircle, complete && styles.stepCircleComplete]}>{busy === `warmup-${warmup.id}` ? <ActivityIndicator color={SLColors.textPrimary} size="small" /> : complete ? <Ionicons color={SLColors.success} name="checkmark" size={17} /> : <Text style={styles.stepNumber}>{index + 1}</Text>}</View>{render ? <Image resizeMode="contain" source={render.imageSource} style={styles.warmupThumb} /> : null}<View style={styles.flex}><Text style={styles.warmupLoad}>{displayWeight(warmup.weight_kg, unit)} × {warmup.reps ?? '—'}</Text><Text style={styles.warmupMeta}>{[warmupPercentage(warmup, opener) ? `${warmupPercentage(warmup, opener)}% opener` : null, warmup.minutes_until_opener != null ? `~${warmup.minutes_until_opener} min before flight` : null].filter(Boolean).join(' · ')}</Text></View><Text style={complete ? styles.statusGood : styles.statusPending}>{complete ? 'DONE' : index === warmups.findIndex((item) => !localWarmups[item.id]) ? 'NOW' : 'NEXT'}</Text></SLMotionPressable>; })}</View></View>;
}

function AttemptsSurface({ activeLift, labels, liftOrder, onLift, onOpenAttempt, payload, unit }: { activeLift: MeetLift; labels: Record<MeetLift, string>; liftOrder: MeetLift[]; onLift: (lift: MeetLift) => void; onOpenAttempt: (attempt: MeetPacketAttempt) => void; payload: MeetPacketPayload; unit: DisplayWeightUnit }) {
  const attempts = payload.attempts?.[activeLift] || [];
  return <View style={styles.stack}><LiftSelector active={activeLift} labels={labels} lifts={liftOrder} onChange={onLift} /><View style={styles.card}><Text style={styles.sectionTitle}>{labels[activeLift]} Attempts</Text>{attempts.map((attempt) => { const result = attempt.result?.result; return <SLMotionPressable key={attempt.id} onPress={() => onOpenAttempt(attempt)} style={[styles.attemptRow, result === 'good' && styles.attemptGood, result === 'miss' && styles.attemptMiss]}><View style={[styles.attemptOrdinal, result === 'good' && styles.ordinalGood]}><Text style={styles.attemptOrdinalText}>{attempt.attempt_number}</Text></View><View style={styles.flex}><Text style={styles.attemptLoad}>{attemptLoad(attempt, unit)}</Text><Text style={styles.attemptMeta}>{attemptName(attempt.attempt_number)}{attempt.pct_tm ? ` · ${Math.round(attempt.pct_tm)}% TM` : ''}</Text></View><Text style={result === 'good' ? styles.statusGood : result === 'miss' ? styles.statusMiss : styles.statusPending}>{result === 'good' ? 'GOOD LIFT' : result === 'miss' ? 'NO LIFT' : 'UPCOMING'}</Text><Ionicons color={SLColors.textMuted} name="chevron-forward" size={18} /></SLMotionPressable>; })}</View></View>;
}

function BagSurface({ busy, checked, customItems, newItem, onAdd, onChangeNewItem, onRemove, onToggle }: { busy: boolean; checked: Record<string, boolean>; customItems: string[]; newItem: string; onAdd: () => void; onChangeNewItem: (value: string) => void; onRemove: (item: string) => void; onToggle: (item: string) => void }) {
  const total = BAG_GROUPS.flatMap((group) => group.items).length + customItems.length; const packed = [...BAG_GROUPS.flatMap((group) => group.items), ...customItems].filter((item) => checked[item]).length;
  return <View style={styles.stack}><View style={styles.bagHero}><View><Text style={styles.bagCount}>{packed}/{total}</Text><Text style={styles.cardEyebrow}>{busy ? 'SAVING…' : 'PACKED'}</Text></View><Image resizeMode="contain" source={MEET_BAG_ASSET} style={styles.bagImage} /></View>{BAG_GROUPS.map((group) => <View key={group.title} style={styles.card}><Text style={styles.sectionTitle}>{group.title}</Text>{group.items.map((item) => <BagRow checked={!!checked[item]} key={item} label={item} onPress={() => onToggle(item)} />)}</View>)}<View style={styles.card}><Text style={styles.sectionTitle}>Custom Items</Text>{customItems.map((item) => <View key={item} style={styles.customBagRow}><View style={styles.flex}><BagRow checked={!!checked[item]} label={item} onPress={() => onToggle(item)} /></View><Pressable hitSlop={8} onPress={() => onRemove(item)}><Ionicons color={SLColors.danger} name="trash-outline" size={18} /></Pressable></View>)}<View style={styles.addRow}><TextInput onChangeText={onChangeNewItem} onSubmitEditing={onAdd} placeholder="Add meet bag item" placeholderTextColor={SLColors.textSubtle} returnKeyType="done" style={styles.input} value={newItem} /><Pressable onPress={onAdd} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><Ionicons color={SLColors.warning} name="add" size={22} /></Pressable></View></View></View>;
}

function BagRow({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) { return <SLMotionPressable onPress={onPress} style={styles.bagRow}><Ionicons color={checked ? SLColors.success : SLColors.textMuted} name={checked ? 'checkmark-circle' : 'ellipse-outline'} size={22} /><Text style={[styles.bagLabel, checked && styles.bagLabelDone]}>{label}</Text></SLMotionPressable>; }
function LiftSelector({ active, labels, lifts, onChange }: { active: MeetLift; labels: Record<MeetLift, string>; lifts: MeetLift[]; onChange: (lift: MeetLift) => void }) { return <View style={styles.liftSelector}>{lifts.map((lift) => <Pressable key={lift} onPress={() => { feedback(); onChange(lift); }} style={({ pressed }) => [styles.liftChoice, active === lift && styles.liftChoiceActive, pressed && styles.pressed]}><Text style={[styles.liftChoiceText, active === lift && styles.liftChoiceTextActive]}>{labels[lift]}</Text></Pressable>)}</View>; }
function WarmupRail({ activeId, localWarmups, opener, unit, warmups }: { activeId: number | null; localWarmups: Record<number, boolean>; opener?: MeetPacketAttempt; unit: DisplayWeightUnit; warmups: MeetPacketWarmup[] }) { return <ScrollView contentContainerStyle={styles.warmupRail} horizontal showsHorizontalScrollIndicator={false}>{warmups.map((warmup, index) => <View key={warmup.id} style={[styles.railStep, warmup.id === activeId && styles.railStepActive]}><View style={[styles.railCircle, localWarmups[warmup.id] && styles.railCircleDone]}>{localWarmups[warmup.id] ? <Ionicons color={SLColors.success} name="checkmark" size={14} /> : <Text style={styles.railNumber}>{index + 1}</Text>}</View><Text style={styles.railLoad}>{displayWeight(warmup.weight_kg, unit)}</Text><Text style={styles.railMeta}>{warmupPercentage(warmup, opener) ? `${warmupPercentage(warmup, opener)}%` : 'Warmup'}</Text></View>)}</ScrollView>; }
function CoachFocus({ text }: { text: string }) { return <View style={styles.focusCard}><Text style={styles.cardEyebrow}>COACH’S MEET-DAY FOCUS</Text><Text style={styles.focusText}>{text}</Text></View>; }
function InfoRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) { return <View style={styles.infoRow}><Ionicons color={SLColors.warning} name={icon} size={18} /><Text style={styles.infoLabel}>{label}</Text><Text numberOfLines={2} style={styles.infoValue}>{value}</Text></View>; }

function MeetToolkitSheet({ onClose, onOpen, visible }: { onClose: () => void; onOpen: (sheet: 'details' | 'platform' | 'attempts' | 'warmups' | 'focus') => void; visible: boolean }) { return <StrengthLedgerBottomSheet accessibilityLabel="Meet toolkit" heightFraction={0.68} onDismiss={onClose} visible={visible}><ScrollView contentContainerStyle={styles.sheetBody}><Text style={styles.sheetEyebrow}>MEET TOOLKIT</Text><Text style={styles.sheetTitle}>Update Meet Packet</Text>{([{ key: 'details', icon: 'calendar-outline', label: 'Meet Details', meta: 'Meet, federation, weight class' }, { key: 'attempts', icon: 'podium-outline', label: 'Attempts', meta: 'Openers and planned ranges' }, { key: 'warmups', icon: 'flame-outline', label: 'Warmups', meta: 'Load, reps, and timing' }, { key: 'platform', icon: 'barbell-outline', label: 'Platform Setup', meta: 'Rack heights and safeties' }, { key: 'focus', icon: 'reader-outline', label: 'Meet-Day Focus', meta: 'Coach instructions and reminders' }] as const).map((item) => <SLMotionPressable key={item.key} onPress={() => { feedback(); onOpen(item.key); }} style={styles.toolRow}><View style={styles.toolIcon}><Ionicons color={SLColors.warning} name={item.icon} size={20} /></View><View style={styles.flex}><Text style={styles.toolLabel}>{item.label}</Text><Text style={styles.toolMeta}>{item.meta}</Text></View><Ionicons color={SLColors.textMuted} name="chevron-forward" size={18} /></SLMotionPressable>)}</ScrollView></StrengthLedgerBottomSheet>; }

function DetailsSheet({ busy, draft, onChange, onClose, onSave, unit, visible }: { busy: boolean; draft: DetailDraft; onChange: (key: keyof DetailDraft, value: string) => void; onClose: () => void; onSave: () => void; unit: DisplayWeightUnit; visible: boolean }) { return <StrengthLedgerBottomSheet accessibilityLabel="Meet details" onDismiss={onClose} visible={visible}><ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled"><Text style={styles.sheetEyebrow}>UPDATE MEET PACKET</Text><Text style={styles.sheetTitle}>Meet Details</Text><Field label="Location" onChange={(value) => onChange('location', value)} value={draft.location} /><Field label="Flight / Platform" onChange={(value) => onChange('flight_platform', value)} value={draft.flight_platform} /><Field label="Weight Class" onChange={(value) => onChange('weight_class', value)} value={draft.weight_class} /><Field keyboard="decimal-pad" label={`Actual Bodyweight (${unit})`} onChange={(value) => onChange('weigh_in_bodyweight', value)} value={draft.weigh_in_bodyweight} /><ActionButton label="Save Meet Details" loading={busy} onPress={onSave} tone="violet" /></ScrollView></StrengthLedgerBottomSheet>; }
function PlatformSheet({ busy, draft, onChange, onClose, onSave, visible }: { busy: boolean; draft: DetailDraft; onChange: (key: keyof DetailDraft, value: string) => void; onClose: () => void; onSave: () => void; visible: boolean }) { return <StrengthLedgerBottomSheet accessibilityLabel="Platform setup" onDismiss={onClose} visible={visible}><ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled"><Text style={styles.sheetEyebrow}>UPDATE MEET PACKET</Text><Text style={styles.sheetTitle}>Platform Setup</Text><Image resizeMode="contain" source={require('@/assets/images/journey-gym-rack.png')} style={styles.rackImage} /><Field label="Squat Rack / Position" onChange={(value) => onChange('squat_rack_height', value)} value={draft.squat_rack_height} /><View style={styles.fieldGrid}><View style={styles.flex}><Field label="Bench Rack" onChange={(value) => onChange('bench_rack_height', value)} value={draft.bench_rack_height} /></View><View style={styles.flex}><Field label="Safety" onChange={(value) => onChange('bench_safety_height', value)} value={draft.bench_safety_height} /></View></View><ActionButton label="Save Platform Setup" loading={busy} onPress={onSave} tone="violet" /></ScrollView></StrengthLedgerBottomSheet>; }
function ReferenceSheet({ activeLift, kind, labels, onClose, onLift, onOpenAttempt, payload, unit }: { activeLift: MeetLift; kind: 'attempts' | 'warmups' | 'focus' | null; labels: Record<MeetLift, string>; onClose: () => void; onLift: (lift: MeetLift) => void; onOpenAttempt: (attempt: MeetPacketAttempt) => void; payload: MeetPacketPayload; unit: DisplayWeightUnit }) { const visible = kind === 'attempts' || kind === 'warmups' || kind === 'focus'; return <StrengthLedgerBottomSheet accessibilityLabel={kind === 'attempts' ? 'Edit attempts' : kind === 'warmups' ? 'Edit warmups' : 'Meet-day focus'} onDismiss={onClose} visible={visible}><ScrollView contentContainerStyle={styles.sheetBody}><Text style={styles.sheetEyebrow}>UPDATE MEET PACKET</Text><Text style={styles.sheetTitle}>{kind === 'attempts' ? 'Attempts' : kind === 'warmups' ? 'Warmups' : 'Coach Focus'}</Text>{kind !== 'focus' ? <LiftSelector active={activeLift} labels={labels} lifts={payload.lift_order || ['SQ', 'BN', 'DL']} onChange={onLift} /> : null}{kind === 'attempts' ? (payload.attempts?.[activeLift] || []).map((attempt) => <SLMotionPressable key={attempt.id} onPress={() => onOpenAttempt(attempt)} style={styles.toolRow}><Text style={styles.attemptOrdinalText}>{attempt.attempt_number}</Text><View style={styles.flex}><Text style={styles.toolLabel}>{attemptName(attempt.attempt_number)}</Text><Text style={styles.toolMeta}>{attemptLoad(attempt, unit)}</Text></View><Ionicons color={SLColors.accentViolet} name="create-outline" size={19} /></SLMotionPressable>) : kind === 'warmups' ? (payload.warmups?.[activeLift] || []).map((warmup, index) => <View key={warmup.id} style={styles.toolRow}><Text style={styles.attemptOrdinalText}>{index + 1}</Text><View style={styles.flex}><Text style={styles.toolLabel}>{displayWeight(warmup.weight_kg, unit)} × {warmup.reps ?? '—'}</Text><Text style={styles.toolMeta}>{warmup.minutes_until_opener != null ? `~${warmup.minutes_until_opener} min before opener` : 'Timing guidance unavailable'}</Text></View></View>) : <CoachFocus text={payload.meet.coach_notes || payload.notes?.find((note) => note.body)?.body || 'No meet-day focus has been added.'} />}</ScrollView></StrengthLedgerBottomSheet>; }
function Field({ keyboard, label, onChange, value }: { keyboard?: 'decimal-pad'; label: string; onChange: (value: string) => void; value: string }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput keyboardType={keyboard} onChangeText={onChange} placeholder="TBD" placeholderTextColor={SLColors.textSubtle} style={styles.input} value={value} /></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SLColors.canvas }, scrollBody: { gap: 14, paddingBottom: 154 }, stack: { gap: 12 }, flex: { flex: 1 }, pressed: { opacity: 0.7 }, disabled: { opacity: 0.45 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingTop: 10, paddingBottom: 2 }, headerCopy: { flex: 1 }, headerEyebrow: { color: SLColors.warning, fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 1.2 }, headerTitle: { color: SLColors.textStrong, fontSize: 31, lineHeight: 36, fontWeight: '800', marginTop: 3 }, headerMeta: { color: SLColors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  lifecycleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: SLColors.warning, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7, marginTop: 2 }, lifecycleLive: { borderColor: SLColors.danger }, lifecycleComplete: { borderColor: SLColors.success }, lifecycleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: SLColors.warning }, lifecycleDotLive: { backgroundColor: SLColors.danger }, lifecycleDotComplete: { backgroundColor: SLColors.success }, lifecycleText: { color: SLColors.textPrimary, fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.7 },
  card: { backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: SLColors.borderStandard, borderRadius: SLRadius.lg, padding: 14, gap: 10 }, cardEyebrow: { color: SLColors.warning, fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 0.7 }, cardBody: { color: SLColors.textSecondary, fontSize: 14, lineHeight: 20 }, sectionTitle: { color: SLColors.textStrong, fontSize: 18, lineHeight: 23, fontWeight: '800' }, sectionMeta: { color: SLColors.textMuted, fontSize: 12, lineHeight: 17 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readinessHero: { backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: SLColors.warning, borderRadius: SLRadius.xl, padding: 16, flexDirection: 'row', gap: 16, alignItems: 'center' }, readinessHeroReady: { borderColor: SLColors.success }, readinessRing: { width: 78, height: 78, borderRadius: 39, borderWidth: 6, borderColor: SLColors.success, justifyContent: 'center', alignItems: 'center' }, readinessFraction: { color: SLColors.textStrong, fontSize: 22, lineHeight: 26, fontWeight: '800' }, readinessRingLabel: { color: SLColors.success, fontSize: 9, lineHeight: 12, fontWeight: '800' }, readinessCopy: { flex: 1, gap: 4 }, readinessRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.divider }, readinessLabel: { flex: 1, color: SLColors.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: '700' }, readinessState: { color: SLColors.success, fontSize: 11, lineHeight: 15, fontWeight: '800' }, readinessNeeds: { color: SLColors.danger },
  infoRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.divider }, infoLabel: { color: SLColors.textMuted, fontSize: 13, lineHeight: 18, width: 95 }, infoValue: { flex: 1, color: SLColors.textPrimary, fontSize: 13, lineHeight: 18, textAlign: 'right', fontWeight: '700' }, focusCard: { backgroundColor: SLColors.surfaceCommand, borderWidth: 1, borderColor: SLColors.warning, borderRadius: SLRadius.lg, padding: 16, gap: 8 }, focusText: { color: SLColors.textStrong, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  liftSelector: { flexDirection: 'row', backgroundColor: SLColors.surfaceInset, borderRadius: SLRadius.pill, borderWidth: 1, borderColor: SLColors.borderSubtle, padding: 3 }, liftChoice: { flex: 1, minHeight: 39, borderRadius: SLRadius.pill, justifyContent: 'center', alignItems: 'center' }, liftChoiceActive: { backgroundColor: SLColors.surfaceSelected, borderWidth: 1, borderColor: SLColors.borderSelected }, liftChoiceText: { color: SLColors.textMuted, fontSize: 13, lineHeight: 18, fontWeight: '700' }, liftChoiceTextActive: { color: SLColors.textStrong },
  liveHero: { backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: SLColors.warning, borderRadius: SLRadius.xl, padding: 16, gap: 7, ...(SLShadows.level2 as ViewStyle) }, liveHeroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, liveStep: { color: SLColors.textMuted, fontSize: 12, lineHeight: 16, marginTop: 2 }, livePlatform: { color: SLColors.warning, fontSize: 12, lineHeight: 16, fontWeight: '800' }, liveLoad: { color: SLColors.textStrong, fontSize: 34, lineHeight: 40, fontWeight: '800', marginTop: 2 }, liveContext: { color: SLColors.textSecondary, fontSize: 13, lineHeight: 18 }, livePlateRender: { width: '100%', height: 170, marginVertical: 2 }, renderFallback: { height: 150, justifyContent: 'center', alignItems: 'center' },
  actionButton: { minHeight: 55, borderRadius: SLRadius.md, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, actionGold: { backgroundColor: SLColors.warning }, actionViolet: { backgroundColor: SLColors.accentViolet }, actionQuiet: { backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: SLColors.borderStrong }, actionLabel: { color: SLColors.textInverted, fontSize: 16, lineHeight: 21, fontWeight: '900' }, actionQuietLabel: { color: SLColors.textPrimary },
  warmupRail: { gap: 8, paddingRight: 8 }, railStep: { width: 96, minHeight: 92, backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: SLColors.borderStandard, borderRadius: SLRadius.md, padding: 10, gap: 4 }, railStepActive: { borderColor: SLColors.warning, backgroundColor: SLColors.surfaceCommand }, railCircle: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: SLColors.borderStrong, justifyContent: 'center', alignItems: 'center' }, railCircleDone: { borderColor: SLColors.success }, railNumber: { color: SLColors.textPrimary, fontSize: 12, fontWeight: '800' }, railLoad: { color: SLColors.textStrong, fontSize: 13, lineHeight: 18, fontWeight: '800' }, railMeta: { color: SLColors.textMuted, fontSize: 10, lineHeight: 14 },
  nextCard: { backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: SLColors.borderStandard, borderRadius: SLRadius.lg, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, nextTitle: { color: SLColors.textStrong, fontSize: 17, lineHeight: 22, fontWeight: '800', marginTop: 3 }, nextMeta: { color: SLColors.textSecondary, fontSize: 14, lineHeight: 19, marginTop: 2 },
  timerCard: { backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: SLColors.warning, borderRadius: SLRadius.lg, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, timerValue: { color: SLColors.warning, fontSize: 30, lineHeight: 35, fontWeight: '800', marginTop: 3, fontVariant: ['tabular-nums'] }, timerContext: { flex: 1, alignItems: 'flex-end' },
  warmupRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.divider }, warmupRowComplete: { opacity: 0.72 }, stepCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: SLColors.borderStrong, justifyContent: 'center', alignItems: 'center' }, stepCircleComplete: { borderColor: SLColors.success }, stepNumber: { color: SLColors.textStrong, fontSize: 13, fontWeight: '800' }, warmupThumb: { width: 68, height: 54 }, warmupLoad: { color: SLColors.textStrong, fontSize: 16, lineHeight: 21, fontWeight: '800' }, warmupMeta: { color: SLColors.textMuted, fontSize: 11, lineHeight: 15 }, statusGood: { color: SLColors.success, fontSize: 10, lineHeight: 14, fontWeight: '900' }, statusMiss: { color: SLColors.danger, fontSize: 10, lineHeight: 14, fontWeight: '900' }, statusPending: { color: SLColors.warning, fontSize: 10, lineHeight: 14, fontWeight: '900' },
  attemptRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.divider }, attemptGood: { backgroundColor: 'rgba(85, 170, 100, 0.04)' }, attemptMiss: { backgroundColor: 'rgba(210, 80, 90, 0.04)' }, attemptOrdinal: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: SLColors.borderStrong, alignItems: 'center', justifyContent: 'center' }, ordinalGood: { borderColor: SLColors.success }, attemptOrdinalText: { color: SLColors.textPrimary, fontSize: 14, lineHeight: 18, fontWeight: '800' }, attemptLoad: { color: SLColors.textStrong, fontSize: 18, lineHeight: 23, fontWeight: '800' }, attemptMeta: { color: SLColors.textMuted, fontSize: 12, lineHeight: 16 },
  bagHero: { minHeight: 150, backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: SLColors.warning, borderRadius: SLRadius.xl, paddingLeft: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, bagCount: { color: SLColors.success, fontSize: 34, lineHeight: 39, fontWeight: '900' }, bagImage: { flex: 1, height: 150 }, bagRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }, bagLabel: { color: SLColors.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: '700' }, bagLabelDone: { color: SLColors.textMuted }, customBagRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, addRow: { flexDirection: 'row', gap: 8, marginTop: 4 }, addButton: { width: 48, minHeight: 48, borderWidth: 1, borderColor: SLColors.warning, borderRadius: SLRadius.md, justifyContent: 'center', alignItems: 'center' },
  completeHero: { backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: SLColors.success, borderRadius: SLRadius.xl, padding: 22, alignItems: 'center', gap: 7 }, completeTitle: { color: SLColors.success, fontSize: 21, lineHeight: 26, fontWeight: '900' }, completeTotal: { color: SLColors.textStrong, fontSize: 33, lineHeight: 39, fontWeight: '800' }, threeColumn: { flexDirection: 'row', backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: SLColors.borderStandard, borderRadius: SLRadius.lg }, metricCell: { flex: 1, paddingVertical: 15, alignItems: 'center' }, metricLabel: { color: SLColors.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '800' }, metricValue: { color: SLColors.textStrong, fontSize: 16, lineHeight: 21, fontWeight: '800', marginTop: 3 },
  navigation: { position: 'absolute', left: 10, right: 10, bottom: 10, minHeight: 64, borderRadius: SLRadius.pill, borderWidth: 1, borderColor: SLColors.borderStrong, backgroundColor: 'rgba(19, 16, 24, 0.97)', flexDirection: 'row', padding: 4, zIndex: 30, ...(SLShadows.level3 as ViewStyle) }, navItem: { flex: 1, minHeight: 54, borderRadius: SLRadius.pill, alignItems: 'center', justifyContent: 'center', gap: 2 }, navItemActive: { backgroundColor: SLColors.surfaceSelected }, navLabel: { color: SLColors.textMuted, fontSize: 9, lineHeight: 12, fontWeight: '700' }, navLabelActive: { color: SLColors.warning }, unitControlWrap: { position: 'absolute', right: 14, bottom: 83, zIndex: 35 }, unitControl: { minWidth: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: SLColors.borderSelected, backgroundColor: 'rgba(28, 14, 37, 0.97)', alignItems: 'center', justifyContent: 'center', ...(SLShadows.level2 as ViewStyle) }, unitControlText: { color: SLColors.textStrong, fontSize: 14, lineHeight: 18, fontWeight: '900', textTransform: 'lowercase' }, primaryDock: { position: 'absolute', left: 14, right: 76, bottom: 84, zIndex: 34 },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 28, gap: 12 }, sheetEyebrow: { color: SLColors.accentViolet, fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 0.8 }, sheetTitle: { color: SLColors.textStrong, fontSize: 27, lineHeight: 32, fontWeight: '800', marginBottom: 3 }, toolRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: SLColors.borderStandard, borderRadius: SLRadius.md, paddingHorizontal: 12, backgroundColor: SLColors.surfaceInset }, toolIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: SLColors.surfaceCommand, alignItems: 'center', justifyContent: 'center' }, toolLabel: { color: SLColors.textStrong, fontSize: 15, lineHeight: 20, fontWeight: '800' }, toolMeta: { color: SLColors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 2 }, field: { gap: 6 }, fieldLabel: { color: SLColors.textMuted, fontSize: 11, lineHeight: 15, fontWeight: '800', textTransform: 'uppercase' }, input: { minHeight: 48, flex: 1, borderWidth: 1, borderColor: SLColors.borderStandard, borderRadius: SLRadius.md, paddingHorizontal: 13, color: SLColors.textStrong, backgroundColor: SLColors.surfaceInset, fontSize: 14 }, fieldGrid: { flexDirection: 'row', gap: 10 }, rackImage: { width: '100%', height: 170 },
});
