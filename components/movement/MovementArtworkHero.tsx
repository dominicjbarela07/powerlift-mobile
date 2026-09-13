import { approvedArtRuntimeEnabled } from '@/lib/approved-art-runtime';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { CANONICAL_ACCESSORY_MOVEMENT_ARTWORK } from '@/lib/canonical-movement-artwork-assets';
import type { CanonicalAccessoryArtworkKey } from '@/lib/canonical-movement-artwork';
import { movementHeroFocal, movementHeroGeometry, reportApprovedArtworkBypass, type MovementHeroFocal } from '@/lib/movement-artwork-hero';

type LayerProps = Readonly<{
  artworkKey: CanonicalAccessoryArtworkKey;
  receiptId: string;
  movementDefinitionId?: number;
  surface?: 'black' | 'superset';
  reduceMotion?: boolean;
  focal?: MovementHeroFocal;
}>;

/** Presentation primitive shared ONLY by the governed Logger and the clearly
 * labeled DEV focal-review lab. Eligibility is decided before mounting it.
 * Primitive props + memo isolate image decoding from elapsed/rest timer renders.
 */
export const MovementArtworkHero = memo(function MovementArtworkHero({
  artworkKey, receiptId, movementDefinitionId, surface = 'black', reduceMotion = false, focal,
}: LayerProps) {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBounds(previous => previous.width === width && previous.height === height ? previous : { width, height });
  }, []);
  const enabled = approvedArtRuntimeEnabled();
  const asset = enabled ? CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[artworkKey] : null;
  useEffect(() => {
    if (__DEV__ && movementDefinitionId && !asset) reportApprovedArtworkBypass(
      { identity_type: 'accessory', movement_definition_id: movementDefinitionId }, null, `movement-art-hero:${surface}`);
  }, [asset, movementDefinitionId, surface]);
  if (!enabled) return null;
  if (!asset) return null;
  const rgb = surface === 'superset' ? '13,11,18' : '0,0,0';
  const shade = (alpha: number) => `rgba(${rgb},${alpha})`;
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
    onLayout={onLayout} style={s.layer} testID="active-movement-art-hero">
    {bounds.width > 0 && bounds.height > 0 ? <Image
      source={asset.source} style={[s.image, movementHeroGeometry(bounds.width, bounds.height, focal || movementHeroFocal(artworkKey))]}
      contentFit="contain" cachePolicy="memory-disk" recyclingKey={receiptId}
      transition={reduceMotion ? 0 : 160} accessibilityIgnoresInvertColors /> : null}
    <LinearGradient pointerEvents="none" style={s.fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      colors={[shade(1), shade(1), shade(0.85), shade(0.08), shade(0), shade(0.9)]}
      locations={[0, 0.36, 0.52, 0.68, 0.86, 1]} />
    <LinearGradient pointerEvents="none" style={s.fill} colors={[shade(1), shade(0.96), shade(0), shade(0), shade(1)]}
      locations={[0, 0.26, 0.46, 0.78, 1]} />
  </View>;
});
const s = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFillObject },
  image: { position: 'absolute' },
});
