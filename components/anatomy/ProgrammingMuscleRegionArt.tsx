import React, { memo, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SLColors } from '@/constants/theme';

import {
  normalizeMuscleRoles,
  type AnatomyPresentationPreference,
} from '@/lib/anatomy-system';
import type { AnatomyFramingPreset } from '@/lib/anatomy-framing';
import { MuscleMap } from './MuscleMap';

export type ProgrammingAthleteAnatomy = Readonly<{
  anatomy_display_preference?: AnatomyPresentationPreference | string | null;
  sex?: string | null;
}>;

type Props = Readonly<{
  athlete?: ProgrammingAthleteAnatomy | null;
  primary?: readonly string[] | null;
  secondary?: readonly string[] | null;
  level: 'week' | 'session';
  framingPreset?: AnatomyFramingPreset;
  style?: StyleProp<ViewStyle>;
}>;

function ProgrammingMuscleRegionArtComponent({ athlete, primary, secondary, level, framingPreset = 'card', style }: Props) {
  const roles = useMemo(() => normalizeMuscleRoles(primary, secondary), [primary, secondary]);
  if (!roles.primary.length && !roles.secondary.length) {
    return (
      <View accessibilityLabel="Session muscle focus unavailable" accessible style={[styles.root, styles.neutral, style]}>
        <Ionicons color={SLColors.textMuted} name="barbell-outline" size={26} />
      </View>
    );
  }
  return (
    <View
      accessibilityLabel={`${level === 'week' ? 'Week' : 'Session'} focus: ${[
        ...roles.primary,
        ...roles.secondary,
      ].join(', ')}`}
      accessible
      style={[styles.root, style]}
    >
      <MuscleMap
        athlete={athlete}
        framingPreset={framingPreset}
        primary={roles.primary}
        secondary={roles.secondary}
        semanticLevel={level}
        size={framingPreset === 'thumbnail' ? 'thumbnail' : framingPreset === 'hero' ? 'hero' : level === 'week' ? 'thumbnail' : 'card'}
        style={styles.map}
      />
    </View>
  );
}

export const ProgrammingMuscleRegionArt = memo(ProgrammingMuscleRegionArtComponent);

const styles = StyleSheet.create({
  root: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  neutral: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(140,134,153,0.30)', borderRadius: 12, backgroundColor: 'rgba(12,13,18,0.72)' },
  map: { width: '100%', height: '100%' },
});
