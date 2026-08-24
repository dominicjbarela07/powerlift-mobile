import React, { memo, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SLColors } from '@/constants/theme';

import { normalizeMuscleRoles } from '@/lib/anatomy-system';
import { MuscleMap } from './MuscleMap';

type Props = Readonly<{
  primary?: readonly string[] | null;
  secondary?: readonly string[] | null;
  level: 'week' | 'session';
  style?: StyleProp<ViewStyle>;
}>;

function ProgrammingMuscleRegionArtComponent({ primary, secondary, level, style }: Props) {
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
        primary={roles.primary}
        secondary={roles.secondary}
        semanticLevel={level}
        size={level === 'week' ? 'thumbnail' : 'card'}
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
