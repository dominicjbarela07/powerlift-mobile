import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { MovementCardMaterial } from '@/components/workout-logger/movement-card-material';
import { SLMovementCardMaterial, SLRadius } from '@/constants/theme';
import type { MovementCardMaterialState } from '@/lib/movement-card-material';

/**
 * Shared Training Hub material shell.
 *
 * Athlete-facing and programming-facing surfaces intentionally share this
 * primitive so their material, clipping, and localized atmosphere cannot
 * drift into separate visual systems.
 */
export function TrainingHubMaterialSurface({
  accentColor,
  children,
  expanded = false,
  state,
  style,
}: {
  accentColor?: string;
  children: ReactNode;
  expanded?: boolean;
  state: MovementCardMaterialState;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.materialSurface, style]}>
      <MovementCardMaterial accentColor={accentColor} expanded={expanded} state={state} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  materialSurface: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: SLRadius.lg,
    backgroundColor: SLMovementCardMaterial.base,
  },
});
