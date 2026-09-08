import React, { memo, useId, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Defs, G, Image as SvgImage, Mask } from 'react-native-svg';

import {
  MUSCLE_META,
  anatomyRenderKey,
  normalizeMuscleIds,
  normalizeMuscleRoles,
  resolveAnatomyPresentation,
  resolveAnatomyRegion,
  resolveAnatomyView,
  type AnatomyPresentation,
  type AnatomyPresentationPreference,
  type AnatomyRenderMode,
  type AnatomyRegion,
  type AnatomyRegionPreference,
  type AnatomyResolvedView,
  type AnatomySemanticLevel,
  type AnatomySize,
  type AnatomyViewPreference,
  type GovernedMuscleId,
} from '@/lib/anatomy-system';
import {
  AnatomySegmentPaths,
  mountedMasksForView,
  type AnatomyLaterality,
} from './anatomy-mask-registry';
import {
  resolveAnatomyFraming,
  type AnatomyFramingPreset,
  type AnatomyFigureView,
} from '@/lib/anatomy-framing';

const BASES = {
  masculine: {
    front: require('@/assets/images/anatomy-v2/masters/masculine-front-v1.png'),
    rear: require('@/assets/images/anatomy-v2/masters/masculine-rear-v1.png'),
  },
  feminine: {
    front: require('@/assets/images/anatomy-v2/masters/feminine-front-v1.png'),
    rear: require('@/assets/images/anatomy-v2/masters/feminine-rear-v1.png'),
  },
} as const;

const MATERIALS = {
  masculine: {
    front: {
      primary: require('@/assets/images/anatomy-v2/materials/masculine-front-primary-material-v2.png'),
      secondary: require('@/assets/images/anatomy-v2/materials/masculine-front-secondary-material-v2.png'),
    },
    rear: {
      primary: require('@/assets/images/anatomy-v2/materials/masculine-rear-primary-material-v2.png'),
      secondary: require('@/assets/images/anatomy-v2/materials/masculine-rear-secondary-material-v2.png'),
    },
  },
  feminine: {
    front: {
      primary: require('@/assets/images/anatomy-v2/materials/feminine-front-primary-material-v2.png'),
      secondary: require('@/assets/images/anatomy-v2/materials/feminine-front-secondary-material-v2.png'),
    },
    rear: {
      primary: require('@/assets/images/anatomy-v2/materials/feminine-rear-primary-material-v2.png'),
      secondary: require('@/assets/images/anatomy-v2/materials/feminine-rear-secondary-material-v2.png'),
    },
  },
} as const;

const SIZE_HEIGHT: Readonly<Record<AnatomySize, number>> = {
  thumbnail: 76,
  card: 184,
  hero: 390,
};

const SIZE_WIDTH: Readonly<Record<AnatomySize, number>> = {
  thumbnail: 76,
  card: 156,
  hero: 320,
};

export type MuscleMapRenderState = Readonly<{
  presentation: AnatomyPresentation;
  view: AnatomyResolvedView;
  region: AnatomyRegion;
  mode: AnatomyRenderMode;
  primary: readonly GovernedMuscleId[];
  secondary: readonly GovernedMuscleId[];
  mountedMasks: readonly GovernedMuscleId[];
  cacheKey: string;
}>;

export type MuscleMapProps = Readonly<{
  anatomy?: AnatomyPresentationPreference;
  athlete?: Readonly<{
    anatomy_display_preference?: AnatomyPresentationPreference | string | null;
    sex?: string | null;
  }> | null;
  primary?: readonly (GovernedMuscleId | string)[] | null;
  secondary?: readonly (GovernedMuscleId | string)[] | null;
  view?: AnatomyViewPreference;
  region?: AnatomyRegionPreference;
  semanticLevel?: AnatomySemanticLevel;
  size?: AnatomySize;
  framingPreset?: AnatomyFramingPreset;
  style?: StyleProp<ViewStyle>;
  showFrame?: boolean;
  testID?: string;
  laterality?: AnatomyLaterality;
  mode?: AnatomyRenderMode;
  exposure?: Readonly<Partial<Record<GovernedMuscleId, number>>>;
}>;

export function resolveMuscleMapRenderState(props: Pick<MuscleMapProps, 'anatomy' | 'athlete' | 'primary' | 'secondary' | 'view' | 'region' | 'semanticLevel' | 'size' | 'laterality' | 'mode' | 'exposure'>): MuscleMapRenderState {
  const size = props.size || 'card';
  const mode = props.mode || 'semantic';
  const semanticRoles = normalizeMuscleRoles(props.primary, props.secondary);
  const exposureMuscles = normalizeMuscleIds(
    Object.entries(props.exposure || {})
      .filter(([, value]) => Number.isFinite(value) && Number(value) > 0)
      .map(([muscle]) => muscle),
  );
  const roles = mode === 'exposure'
    ? { primary: exposureMuscles, secondary: [] }
    : semanticRoles;
  const presentation = resolveAnatomyPresentation({
    preference: props.anatomy === 'automatic'
      ? props.athlete?.anatomy_display_preference
      : props.anatomy || props.athlete?.anatomy_display_preference,
    sex: props.athlete?.sex,
  });
  const view = resolveAnatomyView(roles.primary, roles.secondary, props.view || 'auto', size);
  const region = resolveAnatomyRegion(roles.primary, roles.secondary, props.semanticLevel || 'movement', props.region || 'auto');
  const mountedMasks = mountedMasksForView([...roles.secondary, ...roles.primary], view, presentation);
  return {
    presentation,
    view,
    region,
    mode,
    ...roles,
    mountedMasks,
    cacheKey: anatomyRenderKey({ presentation, view, region, ...roles, size, laterality: props.laterality, mode, exposure: props.exposure }),
  };
}

function Figure({
  presentation,
  view,
  primary,
  secondary,
  size,
  width,
  height,
  framingPreset,
  laterality,
  mode,
  exposure,
}: {
  presentation: AnatomyPresentation;
  view: Exclude<AnatomyResolvedView, 'dual'>;
  primary: readonly GovernedMuscleId[];
  secondary: readonly GovernedMuscleId[];
  size: AnatomySize;
  width: number;
  height: number;
  framingPreset: AnatomyFramingPreset;
  laterality: AnatomyLaterality;
  mode: AnatomyRenderMode;
  exposure?: Readonly<Partial<Record<GovernedMuscleId, number>>>;
}) {
  const scopeId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const framing = resolveAnatomyFraming({
    primary,
    secondary,
    view: view as AnatomyFigureView,
    destinationAspectRatio: width / Math.max(1, height),
    size,
    preset: framingPreset,
    preserveAll: mode === 'exposure',
  });
  const { x: viewX, y: viewY, width: viewWidth, height: viewHeight } = framing.viewBox;
  const primarySet = new Set(primary);
  const visibleSecondary = secondary.filter((muscle) => !primarySet.has(muscle));
  const activeMuscles = [...visibleSecondary, ...primary];
  const heatmapMuscles = [...primary].sort((left, right) => Number(exposure?.[left] || 0) - Number(exposure?.[right] || 0));
  const bodyMaskId = `${scopeId}-registered-body-${presentation}-${view}`;
  const heatmapOpacity = (muscle: GovernedMuscleId, layer: 'violet' | 'magenta') => {
    const value = Math.max(0, Math.min(1, Number(exposure?.[muscle] || 0)));
    if (layer === 'violet') return value > 0 ? 0.16 + 0.82 * Math.sqrt(value) : 0;
    if (value <= 0.68) return 0;
    return 0.78 * Math.pow((value - 0.68) / 0.32, 1.12);
  };
  const segmentId = (muscle: GovernedMuscleId) => `${scopeId}-${presentation}-${view}-${muscle}-${laterality}`;
  return (
    <View style={styles.figure}>
      <Svg
        accessible={false}
        pointerEvents="none"
        preserveAspectRatio="xMidYMid meet"
        style={StyleSheet.absoluteFill}
        viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
      >
        <Defs>
          <Mask
            id={bodyMaskId}
            height={941}
            maskContentUnits="userSpaceOnUse"
            maskType="alpha"
            maskUnits="userSpaceOnUse"
            width={418}
            x={0}
            y={0}
          >
            <SvgImage
              height={941}
              href={BASES[presentation][view]}
              preserveAspectRatio="xMidYMid meet"
              width={418}
              x={0}
              y={0}
            />
          </Mask>
          {activeMuscles.map((muscle) => (
            <Mask
              height={941}
              id={segmentId(muscle)}
              key={`segment-${muscle}`}
              maskContentUnits="userSpaceOnUse"
              maskType="alpha"
              maskUnits="userSpaceOnUse"
              width={418}
              x={0}
              y={0}
            >
              <AnatomySegmentPaths
                laterality={laterality}
                muscle={muscle}
                presentation={presentation}
                view={view}
              />
            </Mask>
          ))}
        </Defs>
        <SvgImage
          height={941}
          href={BASES[presentation][view]}
          preserveAspectRatio="xMidYMid meet"
          width={418}
          x={0}
          y={0}
        />
        <G mask={`url(#${bodyMaskId})`}>
          {mode === 'exposure' ? heatmapMuscles.map((muscle) => (
            <G key={`exposure-${muscle}`} mask={`url(#${segmentId(muscle)})`}>
              <SvgImage height={941} href={MATERIALS[presentation][view].primary} opacity={heatmapOpacity(muscle, 'violet')} preserveAspectRatio="xMidYMid meet" width={418} x={0} y={0} />
              <SvgImage height={941} href={MATERIALS[presentation][view].secondary} opacity={heatmapOpacity(muscle, 'magenta')} preserveAspectRatio="xMidYMid meet" width={418} x={0} y={0} />
            </G>
          )) : <>
            {visibleSecondary.map((muscle) => (
              <G key={`secondary-${muscle}`} mask={`url(#${segmentId(muscle)})`}>
                <SvgImage height={941} href={MATERIALS[presentation][view].secondary} opacity={0.92} preserveAspectRatio="xMidYMid meet" width={418} x={0} y={0} />
              </G>
            ))}
            {primary.map((muscle) => (
              <G key={`primary-${muscle}`} mask={`url(#${segmentId(muscle)})`}>
                <SvgImage height={941} href={MATERIALS[presentation][view].primary} opacity={0.98} preserveAspectRatio="xMidYMid meet" width={418} x={0} y={0} />
              </G>
            ))}
          </>}
        </G>
        <SvgImage
          height={941}
          href={BASES[presentation][view]}
          opacity={size === 'thumbnail' ? 0.08 : 0.12}
          preserveAspectRatio="xMidYMid meet"
          width={418}
          x={0}
          y={0}
        />
      </Svg>
    </View>
  );
}

function MuscleMapComponent({
  anatomy = 'automatic',
  athlete,
  primary,
  secondary,
  view = 'auto',
  region = 'auto',
  semanticLevel = 'movement',
  size = 'card',
  framingPreset,
  style,
  showFrame = false,
  testID,
  laterality = 'bilateral',
  mode = 'semantic',
  exposure,
}: MuscleMapProps) {
  const effectiveFramingPreset: AnatomyFramingPreset = framingPreset || (size === 'thumbnail' ? 'thumbnail' : size === 'hero' ? 'hero' : 'card');
  const [layout, setLayout] = useState(() => ({ width: SIZE_WIDTH[size], height: SIZE_HEIGHT[size] }));
  const state = useMemo(
    () => resolveMuscleMapRenderState({ anatomy, athlete, primary, secondary, view, region, semanticLevel, size, laterality, mode, exposure }),
    [anatomy, athlete, primary, secondary, view, region, semanticLevel, size, laterality, mode, exposure],
  );
  const primaryLabels = state.primary.map((muscle) => MUSCLE_META[muscle].label);
  const secondaryLabels = state.secondary.map((muscle) => MUSCLE_META[muscle].label);
  const exposureLabels = state.primary.map((muscle) => `${MUSCLE_META[muscle].label} ${Math.round(Number(exposure?.[muscle] || 0) * 100)}%`);
  const accessibilityLabel = [
    `${state.presentation} anatomy, ${state.region} region, ${state.view} view`,
    state.mode === 'exposure'
      ? (exposureLabels.length ? `Relative exposure: ${exposureLabels.join(', ')}` : 'No performed exposure')
      : (primaryLabels.length ? `Primary: ${primaryLabels.join(', ')}` : 'No primary muscles'),
    state.mode === 'semantic' && secondaryLabels.length ? `Secondary: ${secondaryLabels.join(', ')}` : null,
  ].filter(Boolean).join('. ');
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setLayout((current) => Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
      ? current
      : { width, height });
  };
  const figureWidth = state.view === 'dual' ? Math.max(1, (layout.width - 2) / 2) : layout.width;
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessible
      testID={testID}
      onLayout={handleLayout}
      style={[
        styles.root,
        { width: SIZE_WIDTH[size], height: SIZE_HEIGHT[size] },
        state.view === 'dual' && styles.dual,
        showFrame && styles.frame,
        style,
      ]}
    >
      {state.view === 'front' || state.view === 'dual' ? (
        <Figure presentation={state.presentation} view="front" primary={state.primary} secondary={state.secondary} size={size} framingPreset={state.view === 'dual' ? 'dual' : effectiveFramingPreset} width={figureWidth} height={layout.height} laterality={laterality} mode={state.mode} exposure={exposure} />
      ) : null}
      {state.view === 'rear' || state.view === 'dual' ? (
        <Figure presentation={state.presentation} view="rear" primary={state.primary} secondary={state.secondary} size={size} framingPreset={state.view === 'dual' ? 'dual' : effectiveFramingPreset} width={figureWidth} height={layout.height} laterality={laterality} mode={state.mode} exposure={exposure} />
      ) : null}
    </View>
  );
}

export const MuscleMap = memo(MuscleMapComponent);

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  dual: {
    flexDirection: 'row',
    gap: 2,
  },
  frame: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3A2A4A',
    backgroundColor: '#07080B',
  },
  figure: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
});
