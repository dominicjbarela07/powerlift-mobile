import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  SLMovementCardMaterial,
  SLRadius,
} from '@/constants/theme';
import {
  resolveMovementCardMaterial,
  type MovementCardMaterialState,
} from '@/lib/movement-card-material';

type MovementCardMaterialProps = {
  state: MovementCardMaterialState;
  accentColor?: string;
  borderRadius?: number;
  disabled?: boolean;
  expanded?: boolean;
  pressed?: boolean;
};

function colorWithAlpha(color: string, alpha: number) {
  const normalized = String(color || '').trim();
  const match = normalized.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return normalized;
  return `rgba(${Number.parseInt(match[1], 16)}, ${Number.parseInt(match[2], 16)}, ${Number.parseInt(match[3], 16)}, ${alpha})`;
}

export function MovementCardMaterial({
  state,
  accentColor: accentColorOverride,
  borderRadius = SLRadius.lg,
  disabled = false,
  expanded = false,
  pressed = false,
}: MovementCardMaterialProps) {
  const material = resolveMovementCardMaterial({
    disabled,
    expanded,
    pressed,
    state,
  });
  const accentColor = accentColorOverride || material.accentColor;
  const edgeStrong = colorWithAlpha(accentColor, material.edgeStrength);
  const edgeMedium = colorWithAlpha(accentColor, material.edgeStrength * 0.5);
  const edgeQuiet = colorWithAlpha(accentColor, material.edgeStrength * 0.2);
  const tintStrong = colorWithAlpha(accentColor, material.tintStrength);
  const tintQuiet = colorWithAlpha(accentColor, material.tintStrength * 0.22);

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        { borderRadius, opacity: material.opacity },
      ]}
    >
      <LinearGradient
        colors={SLMovementCardMaterial.face}
        end={{ x: 0.76, y: 1 }}
        locations={SLMovementCardMaterial.faceLocations}
        start={{ x: 0.12, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={[tintStrong, tintQuiet, 'rgba(0,0,0,0)']}
        end={{ x: 0.82, y: 0.7 }}
        locations={[0, 0.42, 1]}
        start={{ x: 0, y: 0.18 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={[
          'rgba(255,255,255,0.045)',
          'rgba(255,255,255,0.008)',
          'rgba(0,0,0,0.13)',
        ]}
        end={{ x: 0.58, y: 1 }}
        locations={[0, 0.36, 1]}
        start={{ x: 0.42, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          StyleSheet.absoluteFill,
          styles.precisionBorder,
          {
            borderColor: edgeQuiet,
            borderRadius,
          },
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.innerBevel,
          { borderRadius: Math.max(0, borderRadius - 1) },
        ]}
      />

      <LinearGradient
        colors={[edgeStrong, edgeMedium, 'rgba(0,0,0,0)']}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.46, 1]}
        start={{ x: 0, y: 0 }}
        style={styles.topEdge}
      />
      <LinearGradient
        colors={[edgeStrong, edgeMedium, 'rgba(0,0,0,0)']}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0 }}
        style={styles.leftEdge}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', edgeQuiet, edgeMedium]}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.68, 1]}
        start={{ x: 0, y: 0 }}
        style={styles.bottomEdge}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', edgeQuiet]}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.rightEdge}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: SLMovementCardMaterial.base,
    overflow: 'hidden',
  },
  precisionBorder: {
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
    height: 1.5,
    left: 10,
    position: 'absolute',
    right: 54,
    top: 0,
  },
  leftEdge: {
    bottom: 32,
    left: 0,
    position: 'absolute',
    top: 9,
    width: 1.5,
  },
  bottomEdge: {
    bottom: 0,
    height: 1.5,
    left: 42,
    position: 'absolute',
    right: 10,
  },
  rightEdge: {
    bottom: 18,
    position: 'absolute',
    right: 0,
    top: 34,
    width: 1,
  },
});
