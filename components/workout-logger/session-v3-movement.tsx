import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/sl-text';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { LoggerPlateStackVisual } from './logger-primitives';
import type { ActiveMovementVisualContext, MovementLoggerFocusModel } from './core-loggers';
import type { AccessoryLastBestCue } from '@/lib/accessory-last-best';
import { SLColors, SLFontFamilies } from '@/constants/theme';

/** Lifecycle composition only; prescription, identity and write callbacks stay canonical. */
export function SessionV3Movement({ title, index, expanded, complete, prescription, focus,
  visual, note, prior, equipment, actions, warmup, history, timeline, onOpen,
}: {
  title: string; index: number; expanded: boolean; complete: boolean;
  prescription?: string | null; focus?: MovementLoggerFocusModel | null;
  visual?: ActiveMovementVisualContext | null; note?: string | null;
  prior?: AccessoryLastBestCue | null;
  equipment?: React.ReactNode; actions?: React.ReactNode; warmup?: React.ReactNode;
  history?: React.ReactNode; timeline?: React.ReactNode; onOpen: () => void;
}) {
  if (!expanded) return <Pressable accessibilityRole="button" accessibilityLabel={`Expand ${title}`} onPress={onOpen} style={({ pressed }) => [s.row, pressed && s.pressed]}>
    <Text style={[s.index, complete && s.success]}>{complete ? '✓' : String(index).padStart(2, '0')}</Text>
    <CanonicalMovementArtwork movement={visual?.movementArtworkInput} size={52} />
    <View style={s.copy}><Text numberOfLines={0} style={s.rowTitle}>{title}</Text><Text style={s.detail}>{prescription}</Text></View>
    <Ionicons name="chevron-forward" color={SLColors.textMuted} size={17} />
  </Pressable>;

  const stacks = visual?.plateStack?.endpoints || [];
  const load = focus?.currentSetLoadLabel || '';
  const loadParts = load.match(/^(.*?)\s*(kg|lb)$/i);
  const progress = prior || visual?.progress;
  return <View style={s.workspace}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Collapse ${title}`} onPress={onOpen} style={s.heading}>
      <CanonicalMovementArtwork movement={visual?.movementArtworkInput} size={48} />
      <View style={s.copy}><Text numberOfLines={0} style={s.title}>{title}</Text><Text style={s.eyebrow}>{complete ? 'MOVEMENT COMPLETE' : focus?.currentSetPositionLabel || prescription}</Text></View>
    </Pressable>
    {!complete && focus ? <>
      <View style={[s.instrument, stacks.length > 1 && s.rangeInstrument]}>
        <View style={s.loadCopy}>
          <Text style={s.eyebrow}>{load ? 'TARGET LOAD' : 'PRESCRIBED'}</Text>
          <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[s.load, (stacks.length > 1 || load.length > 10) && s.rangeLoad]}>{loadParts ? loadParts[1] : load || focus.currentSetRepsLabel || '—'}{loadParts ? <Text style={s.loadUnit}> {loadParts[2]}</Text> : null}</Text>
          <Text style={s.target}>{[load ? focus.currentSetRepsLabel : null, focus.currentSetEffortLabel].filter(Boolean).join(' · ')}</Text>
        </View>
        {stacks.length ? <View style={[s.stackStage, stacks.length > 1 && s.rangeStage]}>
          {stacks.map((endpoint, i) => <View key={i} style={stacks.length > 1 ? s.rangeEndpoint : s.singleEndpoint}>
            {endpoint.plateStack ? <LoggerPlateStackVisual plateStack={endpoint.plateStack} style={[s.stack, stacks.length > 1 && s.rangeStack]} /> : <Text style={s.detail}>Stack unavailable</Text>}
            {stacks.length > 1 ? <Text style={s.stackLabel}>{endpoint.displayLabel}</Text> : null}
          </View>)}
        </View> : null}
      </View>
      {visual?.physicalSetup ? <Text style={s.setup}>{visual.physicalSetup}</Text> : null}
    </> : null}
    {equipment}
    {note ? <Text style={s.note}>{note}</Text> : null}
    {history || (progress ? <Pressable accessibilityRole="button" accessibilityLabel={`View ${title} movement history`} onPress={focus?.onViewHistory} style={s.evidence}>
      <View style={s.evidenceHeader}><Text style={s.evidenceLabel}>{prior?.kind === 'last_best' ? 'LAST COMPARABLE' : progress.eyebrow}</Text><Text style={s.detail}>{progress.supporting}</Text></View>
      <Text style={s.evidenceValue}>{progress.primary}</Text>
      <Text style={s.historyLink}>Movement history ↗</Text>
    </Pressable> : focus?.onViewHistory ? <Pressable onPress={focus.onViewHistory} accessibilityRole="button" style={s.emptyHistory}><Text style={s.historyLink}>Movement history ↗</Text></Pressable> : null)}
    <View style={s.tools}>{actions}</View>
    {timeline}
    {warmup}
  </View>;
}

const s = StyleSheet.create({
  row: { minHeight: 68, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2b2632', flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { backgroundColor: '#17101f' }, index: { color: '#8e819f', fontSize: 12, width: 21 }, success: { color: '#88deb5' },
  copy: { flex: 1 }, rowTitle: { color: '#f8f6fb', fontFamily: SLFontFamilies.sansSemiBold, fontSize: 16 },
  detail: { color: '#b7b0c2', fontSize: 12, lineHeight: 17, marginTop: 3 },
  workspace: { paddingVertical: 8 }, heading: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 8 },
  title: { color: '#faf7ff', fontFamily: SLFontFamilies.sansBold, fontSize: 26, lineHeight: 31 },
  eyebrow: { color: '#b391ec', fontFamily: SLFontFamilies.sansBold, fontSize: 10, letterSpacing: 1.2, marginTop: 7 },
  instrument: { minHeight: 145, flexDirection: 'row', alignItems: 'center' },
  rangeInstrument: { minHeight: 125 },
  loadCopy: { width: '53%', zIndex: 1 }, load: { color: '#f7f4ff', fontFamily: SLFontFamilies.sansBold, fontSize: 53, letterSpacing: -1.5, marginVertical: 4 },
  loadUnit: { fontSize: 18, letterSpacing: 0 },
  rangeLoad: { fontSize: 34, letterSpacing: -0.8 }, target: { color: '#e6deee', fontSize: 17, fontFamily: SLFontFamilies.sansSemiBold },
  stackStage: { position: 'absolute', right: -8, top: -4, bottom: 0, width: '55%', justifyContent: 'center' },
  rangeStage: { width: '51%', flexDirection: 'row', alignItems: 'center', right: -6 },
  singleEndpoint: { width: '100%', height: 155 }, rangeEndpoint: { width: '54%', marginHorizontal: -3 },
  stack: { width: '100%', height: 155 }, rangeStack: { height: 122 }, stackLabel: { fontSize: 11, color: '#c4bbd3', textAlign: 'center' },
  setup: { color: '#c1b8cb', fontSize: 11, lineHeight: 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#302936' },
  note: { color: '#d6cfdf', borderLeftWidth: 2, borderLeftColor: '#a177e8', paddingLeft: 10, marginVertical: 12, fontSize: 13, lineHeight: 19 },
  evidence: { marginTop: 12, backgroundColor: '#0c141a', borderWidth: 1, borderColor: '#2b3b42', padding: 13, borderRadius: 14 },
  evidenceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, evidenceLabel: { fontSize: 10, color: '#b4dbe0' },
  evidenceValue: { color: '#f0edf7', fontFamily: SLFontFamilies.sansSemiBold, fontSize: 20, marginVertical: 8 },
  historyLink: { color: '#aadce5', fontSize: 13 }, emptyHistory: { paddingVertical: 14 }, tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginVertical: 4 },
});
