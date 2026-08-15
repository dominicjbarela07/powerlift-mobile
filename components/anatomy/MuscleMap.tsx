import React, { memo, useMemo } from 'react';
import {
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
  resolveAnatomyView,
  type AnatomyPresentation,
  type AnatomyPresentationPreference,
  type AnatomyResolvedView,
  type AnatomySize,
  type AnatomyViewPreference,
  type GovernedMuscleId,
} from '@/lib/anatomy-system';
import { AnatomyMaskPaths, mountedMasksForView } from './anatomy-mask-registry';

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

export type MuscleMapRenderState = Readonly<{
  presentation: AnatomyPresentation;
  view: AnatomyResolvedView;
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
  size?: AnatomySize;
  style?: StyleProp<ViewStyle>;
  showFrame?: boolean;
  testID?: string;
}>;

export function resolveMuscleMapRenderState(props: Pick<MuscleMapProps, 'anatomy' | 'athlete' | 'primary' | 'secondary' | 'view' | 'size'>): MuscleMapRenderState {
  const size = props.size || 'card';
  const roles = normalizeMuscleRoles(props.primary, props.secondary);
  const presentation = resolveAnatomyPresentation({
    preference: props.anatomy === 'automatic'
      ? props.athlete?.anatomy_display_preference
      : props.anatomy || props.athlete?.anatomy_display_preference,
    sex: props.athlete?.sex,
  });
  const view = resolveAnatomyView(roles.primary, roles.secondary, props.view || 'auto', size);
  const mountedMasks = mountedMasksForView([...roles.secondary, ...roles.primary], view);
  return {
    presentation,
    view,
    ...roles,
    mountedMasks,
    cacheKey: anatomyRenderKey({ presentation, view, ...roles, size }),
  };
}

function Figure({
  presentation,
  view,
  primary,
  secondary,
  size,
}: {
  presentation: AnatomyPresentation;
  view: Exclude<AnatomyResolvedView, 'dual'>;
  primary: readonly GovernedMuscleId[];
  secondary: readonly GovernedMuscleId[];
  size: AnatomySize;
}) {
  const height = SIZE_HEIGHT[size];
  const width = Math.round(height * 418 / 941);
  const primarySet = new Set(primary);
  const visibleSecondary = secondary.filter((muscle) => !primarySet.has(muscle));
  const primaryOpacity = size === 'thumbnail' ? 0.93 : 0.82;
  const secondaryOpacity = size === 'thumbnail' ? 0.78 : 0.68;
  return (
    <View style={{ width, height }}>
      <Svg
        accessible={false}
        pointerEvents="none"
        preserveAspectRatio="xMidYMid meet"
        style={StyleSheet.absoluteFill}
        viewBox="0 0 418 941"
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
  size = 'card',
  style,
  showFrame = false,
  testID,
}: MuscleMapProps) {
  const state = useMemo(
    () => resolveMuscleMapRenderState({ anatomy, athlete, primary, secondary, view, size }),
    [anatomy, athlete, primary, secondary, view, size],
  );
  const primaryLabels = state.primary.map((muscle) => MUSCLE_META[muscle].label);
  const secondaryLabels = state.secondary.map((muscle) => MUSCLE_META[muscle].label);
  const accessibilityLabel = [
    `${state.presentation} anatomy, ${state.view} view`,
    primaryLabels.length ? `Primary: ${primaryLabels.join(', ')}` : 'No primary muscles',
    secondaryLabels.length ? `Secondary: ${secondaryLabels.join(', ')}` : 'No secondary muscles',
  ].join('. ');
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessible
      testID={testID}
      style={[
        styles.root,
        state.view === 'dual' && styles.dual,
        showFrame && styles.frame,
        style,
      ]}
    >
      {state.view === 'front' || state.view === 'dual' ? (
        <Figure presentation={state.presentation} view="front" primary={state.primary} secondary={state.secondary} size={size} />
      ) : null}
      {state.view === 'rear' || state.view === 'dual' ? (
        <Figure presentation={state.presentation} view="rear" primary={state.primary} secondary={state.secondary} size={size} />
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
    gap: 4,
  },
  frame: {
    overflow: 'hidden',
    padding: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3A2A4A',
    backgroundColor: '#07080B',
  },
});
