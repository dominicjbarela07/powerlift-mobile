import { approvedArtRuntimeEnabled } from '@/lib/approved-art-runtime';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/sl-text';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { MovementArtworkHero } from '@/components/movement/MovementArtworkHero';
import { movementAtmosphereFraming, resolveMovementArtworkPresentation } from '@/lib/movement-artwork-hero';
import { LoggerPlateStackVisual } from './logger-primitives';
import type { ActiveMovementVisualContext, MovementLoggerFocusModel } from './core-loggers';
import type { AccessoryLastBestCue } from '@/lib/accessory-last-best';
import { SLColors, SLFontFamilies } from '@/constants/theme';
import { movementAtmosphereHeaderHeight, type MovementAtmosphereFraming } from '@/lib/movement-artwork-geometry.mjs';

/** Lifecycle composition only; prescription, identity and write callbacks stay canonical. */
type SessionMovementProps = {
  title: string; index: number; expanded: boolean; complete: boolean; active?: boolean; reduceMotion?: boolean;
  prescription?: string | null; focus?: MovementLoggerFocusModel | null;
  visual?: ActiveMovementVisualContext | null; note?: string | null;
  prior?: AccessoryLastBestCue | null;
  equipment?: React.ReactNode; actions?: React.ReactNode; warmup?: React.ReactNode;
  movementAction?: React.ReactNode; onEditPrescription?: () => void;
  history?: React.ReactNode; timeline?: React.ReactNode; onOpen: () => void;
};

export function SessionV3Movement(props: SessionMovementProps) {
  const { visual, expanded, complete } = props;
  const { hero } = resolveMovementArtworkPresentation(visual?.movementArtworkInput, expanded, complete, 'session-v3-movement');
  return <SessionV3MovementLayout {...props} framing={hero ? movementAtmosphereFraming(hero.key) : undefined} artwork={hero ?
    <MovementArtworkHero artworkKey={hero.key} receiptId={hero.candidate_id} movementDefinitionId={hero.movement_definition_id} reduceMotion={props.reduceMotion} /> : null} />;
}

/** Shared measured layout. The product wrapper above owns artwork eligibility;
 * the private DEV reviewer supplies a clearly labelled candidate layer. */
export function SessionV3MovementLayout({ title, index, expanded, complete, prescription, focus,
  visual, note, prior, equipment, actions, warmup, history, timeline, onOpen, reduceMotion = false,
  artwork, framing, movementAction, onEditPrescription,
}: SessionMovementProps & { artwork?: React.ReactNode; framing?: MovementAtmosphereFraming }) {
  const thumbnailPresentation = expanded ? 'muscle-focus' : 'movement';
  const { width: screenWidth } = useWindowDimensions();
  const [headerWidth, setHeaderWidth] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [captionHeight, setCaptionHeight] = useState(0);
  const onCaptionLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setCaptionHeight(previous => Math.abs(previous - height) < .5 ? previous : height);
  }, []);
  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setHeaderWidth(previous => Math.abs(previous - width) < .5 ? previous : width);
    setHeaderHeight(previous => Math.abs(previous - height) < .5 ? previous : height);
  }, []);
  if (!expanded) return <Pressable accessibilityRole="button" accessibilityLabel={`Expand ${title}`} onPress={onOpen} style={({ pressed }) => [s.row, pressed && s.pressed]}>
    <Text style={[s.index, complete && s.success]}>{complete ? '✓' : String(index).padStart(2, '0')}</Text>
    <CanonicalMovementArtwork surface="session-v3-movement" requireHumanApproval movement={visual?.movementArtworkInput} accessoryPresentation={thumbnailPresentation} size={approvedArtRuntimeEnabled() ? 64 : 42} />
    <View style={s.copy}><Text numberOfLines={0} style={s.rowTitle}>{title}</Text><Text style={s.detail}>{prescription}</Text></View>
    <Ionicons name="chevron-forward" color={SLColors.textMuted} size={17} />
  </Pressable>;

  const stacks = visual?.plateStack?.endpoints || [];
  const load = focus?.currentSetLoadLabel || '';
  const setPosition = focus?.currentSetPositionLabel?.replace(/^Set (\d+) · SET \1 OF (\d+)$/, 'Set $1 of $2');
  const loadParts = load.match(/^(.*?)\s*(kg|lb)$/i);
  const progress = prior || visual?.progress;
  const hasTarget = Boolean(load || focus?.currentSetRepsLabel || focus?.currentSetEffortLabel);
  const inlineAction = React.isValidElement<{ onPress?: () => void; accessibilityLabel?: string }>(movementAction)
    ? movementAction.props : null;
  return <View style={s.workspace}>
    {artwork ? <View pointerEvents="none" style={[s.artworkStage, {
      top: 0, height: headerHeight,
    }]}>
      {artwork}
    </View> : null}
    <View onLayout={onHeaderLayout} style={[s.activeHeader, Boolean(artwork) && {
      minHeight: movementAtmosphereHeaderHeight(headerWidth ? headerWidth + 40 : screenWidth, framing, captionHeight || undefined),
      justifyContent: 'flex-end', paddingBottom: captionHeight + 24,
    }]}>
    <View onLayout={artwork ? onCaptionLayout : undefined} style={[s.heading, Boolean(artwork) && s.atmosphericHeading]}>
      <CanonicalMovementArtwork surface="session-v3-movement" requireHumanApproval movement={visual?.movementArtworkInput} accessoryPresentation="muscle-focus" size={artwork ? 42 : approvedArtRuntimeEnabled() ? 68 : 48} />
      <View style={s.copy}>
        <Text numberOfLines={0} style={[s.title, Boolean(artwork) && s.atmosphericTitle]} accessibilityRole="header" accessibilityLabel={title}
          accessibilityActions={[{ name: 'activate', label: `Collapse ${title}` },
            ...(inlineAction?.onPress ? [{ name: 'swap', label: inlineAction.accessibilityLabel || 'Swap movement' }] : [])]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === 'swap') inlineAction?.onPress?.();
            else if (nativeEvent.actionName === 'activate') onOpen();
          }}>
          <Text style={s.title} accessible accessibilityRole="button" accessibilityLabel={`Collapse ${title}`} onPress={onOpen}>{title}</Text>
          {movementAction ? '\u00a0 ' : null}{movementAction}
        </Text>
        <View style={s.positionRow}>
          <Text style={[s.eyebrow, s.positionLabel, complete && s.success]}>{complete ? 'MOVEMENT COMPLETE' : setPosition || prescription}</Text>
          {complete && onEditPrescription ? <PrescriptionEditIcon title={title} label="Adjust sets" onPress={onEditPrescription} /> : null}
        </View>
      </View>
    </View>
    {!complete && focus ? <>
      <View style={[s.instrument, stacks.length > 1 && s.rangeInstrument, !hasTarget && s.unprescribed]}>
        <View style={s.loadCopy}>
          <View style={s.prescriptionHeading}>
            <Text style={[s.eyebrow, s.prescriptionLabel]}>{load ? 'TARGET LOAD' : hasTarget ? 'TARGET' : 'NO TARGET SET'}</Text>
            {onEditPrescription ? <PrescriptionEditIcon title={title} onPress={onEditPrescription} /> : null}
          </View>
          {hasTarget ? <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[s.load, (stacks.length > 1 || load.length > 10) && s.rangeLoad]}>{loadParts ? loadParts[1] : load || focus.currentSetRepsLabel}{loadParts ? <Text style={s.loadUnit}> {loadParts[2]}</Text> : null}</Text> : null}
          <Text style={s.target}>{[load ? focus.currentSetRepsLabel : null, focus.currentSetEffortLabel].filter(Boolean).join(' · ')}</Text>
        {stacks.length ? <View style={[s.stackStage, stacks.length > 1 && s.rangeStage]}>
          {stacks.map((endpoint, i) => <View key={i} style={stacks.length > 1 ? s.rangeEndpoint : s.singleEndpoint}>
            {endpoint.plateStack ? <LoggerPlateStackVisual plateStack={endpoint.plateStack} style={[s.stack, stacks.length > 1 && s.rangeStack]} /> : <Text style={s.detail}>Stack unavailable</Text>}
            {stacks.length > 1 ? <Text style={s.stackLabel}>{endpoint.displayLabel}</Text> : null}
          </View>)}
        </View> : null}
        </View>
      </View>
      {visual?.physicalSetup ? <Text style={s.setup}>{visual.physicalSetup}</Text> : null}
    </> : null}
    </View>
    {equipment}
    {note ? <Text style={s.note}>{note}</Text> : null}
    <View>
    {history || (progress ? <Pressable accessibilityRole="button" accessibilityLabel={`View ${title} movement history`} onPress={focus?.onViewHistory} style={s.evidence}>
      <View style={s.evidenceHeader}><Text style={s.evidenceLabel}>{prior?.kind === 'last_best' ? 'LAST COMPARABLE' : progress.eyebrow}</Text><Text style={s.detail}>{progress.supporting}</Text></View>
      <Text style={s.evidenceValue}>{progress.primary}</Text>
      <View style={s.historyAction}><Text style={s.historyLink}>Movement history</Text><Ionicons name="arrow-forward" size={15} color="#aadce5" /></View>
    </Pressable> : focus?.onViewHistory ? <Pressable onPress={focus.onViewHistory} accessibilityRole="button" style={s.emptyHistory}><View style={s.historyAction}><Text style={s.historyLink}>Movement history</Text><Ionicons name="arrow-forward" size={15} color="#aadce5" /></View></Pressable> : null)}
    </View>
    {actions ? <View style={s.tools}>{actions}</View> : null}
    {timeline}
    {warmup}
  </View>;
}

function PrescriptionEditIcon({ title, onPress, label }: { title: string; onPress: () => void; label?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Edit Prescription for ${title}`}
    accessibilityHint="Change this Session’s Sets, reps and effort target" hitSlop={8}
    onPress={onPress} style={({ pressed }) => [s.editPrescription, pressed && s.controlPressed]}>
    <Ionicons name="create-outline" size={20} color="#c8a6ff" />
    {label ? <Text style={s.editLabel}>{label}</Text> : null}
  </Pressable>;
}

const s = StyleSheet.create({
  row: { minHeight: 68, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2b2632', flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { backgroundColor: '#17101f' }, index: { color: '#8e819f', fontSize: 12, width: 21 }, success: { color: '#88deb5' },
  copy: { flex: 1, minWidth: 0 }, rowTitle: { color: '#f8f6fb', fontFamily: SLFontFamilies.sansSemiBold, fontSize: 16 },
  detail: { color: '#b7b0c2', fontSize: 12, lineHeight: 17, marginTop: 3 },
  activeHeader: { position: 'relative' },
  // One full-width atmosphere behind the heading and target, never a photo slot.
  artworkStage: { position: 'absolute', left: -20, right: -20 },
  workspace: { paddingVertical: 8 }, heading: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 },
  title: { color: '#faf7ff', fontFamily: SLFontFamilies.sansBold, fontSize: 26, lineHeight: 31 },
  atmosphericHeading: { position: 'absolute', left: 0, right: 0, bottom: 12 },
  atmosphericTitle: { textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  eyebrow: { color: '#b391ec', fontFamily: SLFontFamilies.sansBold, fontSize: 10, letterSpacing: 1.2, marginTop: 7 },
  positionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' },
  positionLabel: { marginTop: 0 },
  prescriptionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  prescriptionLabel: { marginTop: 0 },
  editPrescription: { minWidth: 36, minHeight: 44, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  editLabel: { color: '#c8a6ff', fontSize: 12 },
  controlPressed: { opacity: 0.6 },
  instrument: { minHeight: 145, flexDirection: 'row', alignItems: 'center' },
  rangeInstrument: { minHeight: 125 },
  unprescribed: { minHeight: 62, alignItems: 'flex-start', paddingTop: 12 },
  loadCopy: { width: '53%', zIndex: 1 }, load: { color: '#f7f4ff', fontFamily: SLFontFamilies.sansBold, fontSize: 53, letterSpacing: -1.5, marginVertical: 4 },
  loadUnit: { fontSize: 18, letterSpacing: 0 },
  rangeLoad: { fontSize: 34, letterSpacing: -0.8 }, target: { color: '#e6deee', fontSize: 17, fontFamily: SLFontFamilies.sansSemiBold },
  stackStage: { width: 130, marginTop: 4, justifyContent: 'center' },
  rangeStage: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  singleEndpoint: { width: '100%', height: 84 }, rangeEndpoint: { width: '50%' },
  stack: { width: '100%', height: 84 }, rangeStack: { height: 72 }, stackLabel: { fontSize: 11, color: '#c4bbd3', textAlign: 'center' },
  setup: { color: '#c1b8cb', fontSize: 11, lineHeight: 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#302936' },
  note: { color: '#d6cfdf', borderLeftWidth: 2, borderLeftColor: '#a177e8', paddingLeft: 10, marginVertical: 12, fontSize: 13, lineHeight: 19 },
  evidence: { marginTop: 12, backgroundColor: '#0c141a', borderWidth: 1, borderColor: '#2b3b42', padding: 13, borderRadius: 14 },
  evidenceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, evidenceLabel: { fontSize: 10, color: '#b4dbe0' },
  evidenceValue: { color: '#f0edf7', fontFamily: SLFontFamilies.sansSemiBold, fontSize: 20, marginVertical: 8 },
  historyAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyLink: { color: '#aadce5', fontSize: 13 }, emptyHistory: { paddingVertical: 14 }, tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginVertical: 4 },
});
