import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import { FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { Text } from '@/components/ui/sl-text';
import { SLFontFamilies, SLSelfCoach as C } from '@/constants/theme';
import type { AthleteHomeV3Projection, HomeAction, HomeSessionEvidence } from '@/lib/athlete-home-v3';
import { formatCompactVolumeValueFromKg } from '@/lib/display-units';
import { trainingSessionTitle } from '@/lib/training-session-title';
import { useSurfaceWeightUnit } from '@/lib/surface-weight-unit';

type Props = {
  date: string;
  home: AthleteHomeV3Projection;
  preferredUnits?: string | null;
  creating: boolean;
  onAction: (action: HomeAction) => void;
};

export function SelfCoachTrain({ date, home, preferredUnits, creating, onAction }: Props) {
  const { unit, setUnit } = useSurfaceWeightUnit(preferredUnits);
  const current = home.hero?.session;
  const active = current?.status === 'in_progress';
  const finished = ['completed', 'logged', 'done'].includes(current?.status || '');
  const draft = ['draft', 'template'].includes(current?.status || '');
  const ready = current && ['assigned', 'planned'].includes(current.status || '');
  const next = home.next_up?.id !== current?.id ? home.next_up : null;
  const previous = home.last_session;
  const primaryLabel = active ? 'Resume session' : finished ? 'View session' : draft ? 'Continue planning' : 'Start session';
  const canStart = active || ready || Boolean(current) || home.can_create_today_session === true;
  const start = () => {
    if (draft) onAction({ route: 'edit_workout', workout_id: current?.id });
    else if (active || ready) onAction({ route: 'start_workout', workout_id: current?.id });
    else if (current) onAction({ route: 'new_workout', workout_id: current.id });
    else onAction({ route: 'create_today_session' });
  };

  return (
    <View style={s.page} testID="self-coach-train">
      {current?.performed_volume_kg || previous?.performed_volume_kg ? <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} testID="self-coach-train-units" /> : null}
      <Text style={s.title}>Train</Text>
      <Text style={s.date}>{new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })}</Text>
      <View style={s.hero}>
        <Image source={require('@/assets/images/onboarding/loaded-iron-welcome-v1.png')}
          resizeMode="cover" style={s.art} accessibilityIgnoresInvertColors />
        <LinearGradient colors={[C.canvas, 'rgba(16,14,22,0.93)', 'rgba(16,14,22,0)', C.canvas]}
          locations={[0, 0.24, 0.58, 1]} style={StyleSheet.absoluteFillObject} />
        <View style={s.heroCopy}>
          <View style={s.accentRule} />
          {current && (active || ready) ? (
            <>
              <Text style={s.eyebrow}>{active ? 'SESSION IN PROGRESS' : 'TODAY’S SESSION'}</Text>
              <Text style={s.workoutTitle}>{trainingSessionTitle(current.title || current.label)}</Text>
              <Text style={s.supporting}>{active
                ? `${current.performed_set_count || 0} ${current.performed_set_count === 1 ? 'set' : 'sets'} saved`
                : `${current.movement_count || 0} exercises`}</Text>
            </>
          ) : finished && current ? (
            <>
              <Text style={s.eyebrow}>COMPLETED TODAY</Text>
              <Text style={s.workoutTitle}>{trainingSessionTitle(current.title || current.label)}</Text>
              <Text style={s.supporting}>{current.performed_set_count || 0} sets saved</Text>
            </>
          ) : draft && current ? <><Text style={s.eyebrow}>DRAFT SESSION</Text><Text style={s.workoutTitle}>{trainingSessionTitle(current.title || current.label)}</Text><Text style={s.supporting}>Pick up your planning.</Text></> : <Text style={s.opening}>Start with any exercise.</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={primaryLabel}
            disabled={creating || (!canStart && !finished)}
            onPress={finished ? () => onAction({ route: 'workout', workout_id: current?.id }) : start}
            style={({ pressed }) => [s.primary, pressed && s.pressed, creating && s.disabled]}>
            {creating ? <ActivityIndicator color={C.accentInk} /> : <>
              <Text style={s.primaryText}>{primaryLabel}</Text>
              <Ionicons name="arrow-forward" color={C.accentInk} size={23} />
            </>}
          </Pressable>
          {active ? <Text style={s.saved}><Ionicons name="checkmark-circle" color={C.success} size={16} /> Pick up where you left off.</Text>
            : <Pressable accessibilityRole="button" onPress={() => onAction({ route: 'programming' })} style={s.secondary}>
              <Ionicons name="add" size={19} color={C.accent} />
              <Text style={s.secondaryText}>Plan your training</Text>
            </Pressable>}
        </View>
      </View>
      {finished && current ? <Pressable accessibilityRole="button" onPress={() => onAction({ route: 'new_workout', workout_id: current.id })} disabled={creating} style={s.secondary}>
        <Ionicons name="add" color={C.accent} size={19} /><Text style={s.secondaryText}>Start another session</Text>
      </Pressable> : null}
      {previous && previous.id !== current?.id ? <SessionRow label="LAST SESSION" session={previous} unit={unit}
        onPress={() => onAction({ route: 'workout', workout_id: previous.id })}
        onRepeat={() => onAction({ route: 'repeat_workout', workout_id: previous.id })} /> : null}
      {next ? <SessionRow label="NEXT" session={next} unit={unit}
        onPress={() => onAction({ route: 'workout', workout_id: next.id })} /> : null}
      {finished && current ? <Pressable accessibilityRole="button" style={s.repeat}
        onPress={() => onAction({ route: 'repeat_workout', workout_id: current.id })}>
        <Ionicons name="copy-outline" size={19} color={C.accent} />
        <Text style={s.secondaryText}>Repeat this session</Text>
        <Ionicons name="arrow-forward" size={18} color={C.accent} />
      </Pressable> : null}
      <View style={s.tools}>
        <Pressable accessibilityRole="button" onPress={() => onAction({ route: 'daily_readiness' })} style={s.tool}>
          <Ionicons name="pulse-outline" size={18} color={C.muted} /><Text style={s.toolText}>Check in</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => onAction({ route: 'programming' })} style={s.tool}>
          <Ionicons name="calendar-outline" size={18} color={C.muted} /><Text style={s.toolText}>Your week</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SessionRow({ label, session, unit, onPress, onRepeat }: {
  label: string; session: HomeSessionEvidence; unit: 'kg' | 'lb'; onPress: () => void; onRepeat?: () => void;
}) {
  const day = session.date ? new Date(`${session.date.slice(0, 10)}T12:00:00`) : null;
  return (
    <View style={s.sessionRow}>
      <Pressable accessibilityRole="button" onPress={onPress} style={s.sessionOpen}>
        <View style={s.dateGutter}>
          <Text style={s.day}>{day?.getDate() || '—'}</Text>
          <Text style={s.month}>{day?.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</Text>
        </View>
        <View style={s.sessionCopy}>
          <Text style={s.eyebrow}>{label}</Text>
          <Text style={s.sessionTitle}>{trainingSessionTitle(session.title || session.label)}</Text>
          <Text style={s.meta}>{session.performed_set_count ? `${session.performed_set_count} sets saved` : `${session.movement_count || 0} exercises`}
            {session.performed_volume_kg ? ` · ${formatCompactVolumeValueFromKg(session.performed_volume_kg, unit)} volume` : ''}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={C.secondary} />
      </Pressable>
      {onRepeat ? <Pressable accessibilityRole="button" accessibilityLabel="Repeat last session" onPress={onRepeat} style={s.repeatSmall}>
        <Ionicons name="copy-outline" size={16} color={C.accent} /><Text style={s.link}>Repeat</Text>
      </Pressable> : null}
    </View>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingTop: 15, paddingBottom: 110 },
  title: { color: C.text, fontFamily: SLFontFamilies.sansBold, fontSize: 34, lineHeight: 42 },
  date: { color: C.secondary, fontSize: 15, marginTop: 2 },
  hero: { minHeight: 390, marginHorizontal: -18, position: 'relative', overflow: 'hidden' },
  art: { position: 'absolute', width: '100%', height: 440, top: 45 },
  heroCopy: { paddingHorizontal: 18, paddingTop: 20, zIndex: 1 },
  accentRule: { width: 31, height: 2, backgroundColor: C.accent, marginBottom: 20 },
  opening: { color: C.secondary, fontSize: 18, lineHeight: 26, marginBottom: 22 },
  eyebrow: { color: C.muted, fontSize: 10, letterSpacing: 1, fontFamily: SLFontFamilies.sansSemiBold },
  workoutTitle: { color: C.text, fontFamily: SLFontFamilies.sansBold, fontSize: 29, lineHeight: 35, marginTop: 8 },
  supporting: { color: C.secondary, fontSize: 14, marginTop: 7, marginBottom: 20 },
  primary: { minHeight: 52, borderRadius: 27, backgroundColor: C.accent, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  primaryText: { color: C.accentInk, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 18 },
  pressed: { opacity: 0.8 }, disabled: { opacity: 0.6 },
  secondary: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryText: { color: C.text, fontSize: 15, fontFamily: SLFontFamilies.sansMedium },
  saved: { color: C.success, fontSize: 13, marginTop: 14 },
  sessionRow: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingVertical: 12 },
  sessionOpen: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58 },
  dateGutter: { width: 35, borderRightWidth: 1, borderRightColor: C.line },
  day: { color: C.text, fontSize: 23, fontFamily: SLFontFamilies.sansMedium },
  month: { color: C.secondary, fontSize: 10, marginTop: 2 },
  sessionCopy: { flex: 1, gap: 4 }, sessionTitle: { color: C.text, fontSize: 17, fontFamily: SLFontFamilies.sansSemiBold },
  meta: { color: C.secondary, fontSize: 12, lineHeight: 18 },
  repeatSmall: { flexDirection: 'row', gap: 7, alignItems: 'center', paddingLeft: 47, minHeight: 38 },
  link: { color: C.accent, fontSize: 14 },
  repeat: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  tools: { flexDirection: 'row', gap: 24, paddingTop: 7 },
  tool: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 },
  toolText: { color: C.muted, fontSize: 13 },
});
