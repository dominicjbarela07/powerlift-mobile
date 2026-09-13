import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLControlSize, SLFontFamilies, SLSpacing, SLTypography } from '@/constants/theme';
import { resolveMovementHistoryLaunchForItem, type MovementHistoryLaunchItem } from '@/lib/movement-history-launch';
import type { SessionExposureContext } from '@/lib/session-exposure-cache';
import { presentSessionExposure, type HydratedExposureHistory } from '@/lib/session-exposure-snapshot';
import { useSessionExposure } from '@/lib/use-session-exposure';

/** The authorized workspace owns the athlete. Prescriptions never identify history. */
export function ProgrammingLastExposure({ context, item, displayUnit, onOpenHistory }: {
  context?: SessionExposureContext;
  item: MovementHistoryLaunchItem & { movement_history?: HydratedExposureHistory | null };
  displayUnit: 'kg' | 'lb'; onOpenHistory?: () => void;
}) {
  const resolution = resolveMovementHistoryLaunchForItem({ athleteId: context?.athleteId, item });
  const target = resolution.ok ? resolution.target : null;
  const read = useSessionExposure({ context, target, history: item.movement_history });
  const content = presentSessionExposure(read.exposure, displayUnit, target?.coreMovementId ? 'core' : 'accessory');
  const message = read.status === 'empty' ? 'No previous exact exposure.'
    : read.status === 'loading' ? 'Loading previous exposure…'
    : read.status === 'unresolved' ? 'Exact movement history is unavailable.' : 'History unavailable right now.';
  return <View style={s.section} testID="programming-last-exposure">
    <View style={s.heading}>
      <Text style={s.label}>LAST EXPOSURE</Text>
      <View style={s.actions}>
        {read.retry && read.status === 'error' ? <Pressable accessibilityRole="button" accessibilityLabel="Retry previous exposure" onPress={read.retry} style={s.action}><Text style={s.link}>Retry</Text></Pressable> : null}
        {target && onOpenHistory ? <Pressable accessibilityRole="button" accessibilityLabel="Open exact movement history" onPress={onOpenHistory} style={s.action}><Text style={s.link}>History</Text></Pressable> : null}
      </View>
    </View>
    {content ? <>
      <View style={s.result}><Text style={s.value}>{content.performance}{content.effort ? ` ${content.effort}` : ''}</Text><Text style={s.date}>{content.date}</Text></View>
      <Text style={s.detail}>{content.context}</Text>
    </> : <Text accessibilityLiveRegion="polite" style={s.detail}>{message}</Text>}
  </View>;
}
const s = StyleSheet.create({
  section: { gap: SLSpacing.xs, paddingVertical: SLSpacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline },
  heading: { minHeight: SLControlSize.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SLSpacing.sm },
  label: { color: SLColors.textMuted, fontFamily: SLFontFamilies.technical, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { minWidth: SLControlSize.minimumTouchTarget, minHeight: SLControlSize.minimumTouchTarget, alignItems: 'flex-end', justifyContent: 'center' },
  link: { color: SLColors.accentViolet, fontFamily: SLTypography.buttonLabel.fontFamily, fontSize: SLTypography.buttonLabel.fontSize, lineHeight: SLTypography.buttonLabel.lineHeight },
  result: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  value: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodySemiBold, fontSize: 13, lineHeight: 19 },
  date: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 18 },
  detail: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 18 },
});
