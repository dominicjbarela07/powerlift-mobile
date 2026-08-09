import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SLMovementCardMaterial } from '@/constants/theme';

export type CoachMaterialTone =
  | 'neutral'
  | 'critical'
  | 'action'
  | 'monitor'
  | 'on_track'
  | 'violet'
  | 'cyan';

export type CoachMaterialEmphasis = 'quiet' | 'standard' | 'priority';

const COACH_MATERIAL_TONES: Record<CoachMaterialTone, string> = {
  neutral: '#A8A9B4',
  critical: '#FF2C9D',
  action: '#FF762D',
  monitor: '#D0AE65',
  on_track: '#48C987',
  violet: '#A45CFF',
  cyan: '#3BC9FF',
};

const EMPHASIS = {
  quiet: { atmosphere: 0.025, reflection: 0.018 },
  standard: { atmosphere: 0.052, reflection: 0.03 },
  priority: { atmosphere: 0.095, reflection: 0.045 },
} as const;

function colorWithAlpha(color: string, alpha: number) {
  const match = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return color;
  return `rgba(${Number.parseInt(match[1], 16)}, ${Number.parseInt(match[2], 16)}, ${Number.parseInt(match[3], 16)}, ${alpha})`;
}

export function CoachMaterialLayer({
  borderRadius,
  emphasis = 'standard',
  pressed = false,
  selected = false,
  tone = 'neutral',
}: {
  borderRadius: number;
  emphasis?: CoachMaterialEmphasis;
  pressed?: boolean;
  selected?: boolean;
  tone?: CoachMaterialTone;
}) {
  const accent = COACH_MATERIAL_TONES[tone];
  const strength = EMPHASIS[emphasis];
  const atmosphere = strength.atmosphere * (pressed ? 1.12 : 1);
  const selectedAtmosphere = selected ? atmosphere * 1.35 : atmosphere;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, { borderRadius }]}>
      <LinearGradient
        colors={SLMovementCardMaterial.face}
        end={{ x: 0.78, y: 1 }}
        locations={SLMovementCardMaterial.faceLocations}
        start={{ x: 0.1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[
          colorWithAlpha(accent, selectedAtmosphere),
          colorWithAlpha(accent, selectedAtmosphere * 0.38),
          'rgba(0,0,0,0)',
        ]}
        end={{ x: 0.78, y: 0.78 }}
        locations={[0, 0.34, 1]}
        start={{ x: 0, y: 0.08 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[
          `rgba(255,255,255,${strength.reflection})`,
          'rgba(255,255,255,0.004)',
          'rgba(0,0,0,0.11)',
        ]}
        end={{ x: 0.62, y: 1 }}
        locations={[0, 0.38, 1]}
        start={{ x: 0.38, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', colorWithAlpha(accent, selectedAtmosphere * 0.18)]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0.46, y: 0.24 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.precisionBorder, { borderRadius }]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.innerBevel,
          { borderRadius: Math.max(0, borderRadius - 1) },
        ]}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.11)', 'rgba(255,255,255,0.025)', 'rgba(0,0,0,0)']}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.52, 1]}
        start={{ x: 0, y: 0 }}
        style={styles.topEdge}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(255,255,255,0.018)', 'rgba(255,255,255,0.055)']}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        style={styles.bottomEdge}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    backgroundColor: SLMovementCardMaterial.base,
    overflow: 'hidden',
  },
  precisionBorder: {
    borderColor: SLMovementCardMaterial.neutralBorder,
    borderWidth: 1,
  },
  innerBevel: {
    borderBottomColor: SLMovementCardMaterial.lowerBevel,
    borderBottomWidth: 1,
    borderLeftColor: SLMovementCardMaterial.innerBevel,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopColor: SLMovementCardMaterial.innerBevel,
    borderTopWidth: StyleSheet.hairlineWidth,
    margin: 1,
  },
  topEdge: {
    height: 1,
    left: 12,
    position: 'absolute',
    right: 48,
    top: 0,
  },
  bottomEdge: {
    bottom: 0,
    height: 1,
    left: 46,
    position: 'absolute',
    right: 12,
  },
});
