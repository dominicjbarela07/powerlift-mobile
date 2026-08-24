import React, { memo, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Image as SvgImage } from 'react-native-svg';

import {
  ANATOMY_COLORS,
  MUSCLE_META,
  anatomyRenderKey,
  normalizeMuscleRoles,
  resolveAnatomyPresentation,
  resolveAnatomyRegion,
  resolveAnatomyView,
  type AnatomyPresentation,
  type AnatomyPresentationPreference,
  type AnatomyRegion,
  type AnatomyRegionPreference,
  type AnatomyResolvedView,
  type AnatomySemanticLevel,
  type AnatomySize,
  type AnatomyViewPreference,
  type GovernedMuscleId,
} from '@/lib/anatomy-system';
import { AnatomyMaskPaths, mountedMasksForView } from './anatomy-mask-registry';
import {
  resolveAnatomyFraming,
  type AnatomyFramingSurface,
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
  style?: StyleProp<ViewStyle>;
  surface?: AnatomyFramingSurface;
  showFrame?: boolean;
  testID?: string;
}>;

export function resolveMuscleMapRenderState(props: Pick<MuscleMapProps, 'anatomy' | 'athlete' | 'primary' | 'secondary' | 'view' | 'region' | 'semanticLevel' | 'size'>): MuscleMapRenderState {
  const size = props.size || 'card';
  const roles = normalizeMuscleRoles(props.primary, props.secondary);
  const presentation = resolveAnatomyPresentation({
    preference: props.anatomy === 'automatic'
      ? props.athlete?.anatomy_display_preference
      : props.anatomy || props.athlete?.anatomy_display_preference,
    sex: props.athlete?.sex,
  });
  const view = resolveAnatomyView(roles.primary, roles.secondary, props.view || 'auto', size);
  const region = resolveAnatomyRegion(roles.primary, roles.secondary, props.semanticLevel || 'movement', props.region || 'auto');
  const mountedMasks = mountedMasksForView([...roles.secondary, ...roles.primary], view);
  return {
    presentation,
    view,
    region,
    ...roles,
    mountedMasks,
    cacheKey: anatomyRenderKey({ presentation, view, region, ...roles, size }),
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
  surface,
}: {
  presentation: AnatomyPresentation;
  view: Exclude<AnatomyResolvedView, 'dual'>;
  primary: readonly GovernedMuscleId[];
  secondary: readonly GovernedMuscleId[];
  size: AnatomySize;
  width: number;
  height: number;
  surface: AnatomyFramingSurface;
}) {
  const framing = resolveAnatomyFraming({
    primary,
    secondary,
    view: view as AnatomyFigureView,
    destinationAspectRatio: width / Math.max(1, height),
    size,
    surface,
  });
  const { x: viewX, y: viewY, width: viewWidth, height: viewHeight } = framing.viewBox;
  const primarySet = new Set(primary);
  const visibleSecondary = secondary.filter((muscle) => !primarySet.has(muscle));
  const primaryOpacity = size === 'thumbnail' ? 0.93 : 0.82;
  const secondaryOpacity = size === 'thumbnail' ? 0.78 : 0.68;
  return (
    <View style={styles.figure}>
      <Svg
        accessible={false}
        pointerEvents="none"
        preserveAspectRatio="xMidYMid meet"
        style={StyleSheet.absoluteFill}
        viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
      >
        <SvgImage
          height={941}
          href={BASES[presentation][view]}
          preserveAspectRatio="xMidYMid meet"
          width={418}
          x={0}
          y={0}
        />
        {visibleSecondary.map((muscle) => (
          <AnatomyMaskPaths
            key={`secondary-${muscle}`}
            muscle={muscle}
            presentation={presentation}
            view={view}
            fill={ANATOMY_COLORS.secondary}
            stroke={ANATOMY_COLORS.secondaryEdge}
            opacity={secondaryOpacity}
          />
        ))}
        {primary.map((muscle) => (
          <AnatomyMaskPaths
            key={`primary-${muscle}`}
            muscle={muscle}
            presentation={presentation}
            view={view}
            fill={ANATOMY_COLORS.primary}
            stroke={ANATOMY_COLORS.primaryEdge}
            opacity={primaryOpacity}
          />
        ))}
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
  style,
  surface = 'auto',
  showFrame = false,
  testID,
}: MuscleMapProps) {
  const [layout, setLayout] = useState(() => ({ width: SIZE_WIDTH[size], height: SIZE_HEIGHT[size] }));
  const state = useMemo(
    () => resolveMuscleMapRenderState({ anatomy, athlete, primary, secondary, view, region, semanticLevel, size }),
    [anatomy, athlete, primary, secondary, view, region, semanticLevel, size],
  );
  const primaryLabels = state.primary.map((muscle) => MUSCLE_META[muscle].label);
  const secondaryLabels = state.secondary.map((muscle) => MUSCLE_META[muscle].label);
  const accessibilityLabel = [
    `${state.presentation} anatomy, ${state.region} region, ${state.view} view`,
    primaryLabels.length ? `Primary: ${primaryLabels.join(', ')}` : 'No primary muscles',
    secondaryLabels.length ? `Secondary: ${secondaryLabels.join(', ')}` : 'No secondary muscles',
  ].join('. ');
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
        <Figure presentation={state.presentation} view="front" primary={state.primary} secondary={state.secondary} size={size} surface={surface} width={figureWidth} height={layout.height} />
      ) : null}
      {state.view === 'rear' || state.view === 'dual' ? (
        <Figure presentation={state.presentation} view="rear" primary={state.primary} secondary={state.secondary} size={size} surface={surface} width={figureWidth} height={layout.height} />
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
    overflow: 'hidden',
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
