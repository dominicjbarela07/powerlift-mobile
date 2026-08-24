import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import {
  Image,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { CoreVariantBadge } from '@/components/workout-logger/core-variant-badge';
import { SLColors, SLRadius } from '@/constants/theme';
import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';
import { CANONICAL_CORE_MOVEMENT_ARTWORK } from '@/lib/canonical-movement-artwork-assets';
import {
  resolveCanonicalMovementArtwork,
  type CanonicalMovementArtworkInput,
} from '@/lib/canonical-movement-artwork';

type Props = Readonly<{
  movement?: CanonicalMovementArtworkInput | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

const warned = new Set<string>();

export function CanonicalMovementArtwork({ movement, size = 72, style, testID }: Props) {
  const resolution = resolveCanonicalMovementArtwork(movement);

  useEffect(() => {
    if (!__DEV__ || resolution.kind !== 'neutral') return;
    const key = `${resolution.reason}:${movement?.id || movement?.movement_definition_id || movement?.core_movement_id || 'unknown'}`;
    if (warned.has(key)) return;
    warned.add(key);
    console.warn('[movement-artwork] neutral fail-closed result', { key, reason: resolution.reason });
  }, [movement?.core_movement_id, movement?.id, movement?.movement_definition_id, resolution]);

  if (resolution.kind === 'accessory') {
    const asset = accessoryMuscleRegionAsset(resolution.regionKey);
    return (
      <View accessibilityLabel={`${asset.label} targeted muscle-group artwork`} accessibilityRole="image" style={[styles.frame, { width: size, height: size }, style]} testID={testID}>
        <Image accessibilityIgnoresInvertColors resizeMode="contain" source={asset.source} style={styles.image} />
      </View>
    );
  }

  if (resolution.kind === 'core_variant') {
    return (
      <View style={[styles.frame, { width: size, height: size }, style]} testID={testID}>
        <View style={{ transform: [{ scale: size / 92 }] }}>
          <CoreVariantBadge accentColor={SLColors.accentViolet} family={resolution.family} liftArtworkSource={CANONICAL_CORE_MOVEMENT_ARTWORK[resolution.family]} />
        </View>
      </View>
    );
  }

  if (resolution.kind === 'core') {
    return (
      <View accessibilityLabel={`${resolution.family} canonical Core artwork`} accessibilityRole="image" style={[styles.frame, { width: size, height: size }, style]} testID={testID}>
        <Image accessibilityIgnoresInvertColors resizeMode="contain" source={CANONICAL_CORE_MOVEMENT_ARTWORK[resolution.family]} style={styles.image} />
      </View>
    );
  }

  return (
    <View accessibilityLabel="Movement artwork unavailable" accessibilityRole="image" style={[styles.frame, styles.neutral, { width: size, height: size }, style]} testID={testID}>
      <Ionicons name="help-outline" size={Math.max(18, Math.round(size * 0.38))} color={SLColors.accentMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    borderRadius: SLRadius.lg,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { height: '100%', width: '100%' },
  neutral: {
    backgroundColor: SLColors.surfaceFloating,
    borderColor: SLColors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
