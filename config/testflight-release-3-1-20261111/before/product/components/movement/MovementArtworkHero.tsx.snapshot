import { approvedArtRuntimeEnabled } from '@/lib/approved-art-runtime';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { Image as NativeImage, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { CANONICAL_ACCESSORY_MOVEMENT_ARTWORK } from '@/lib/canonical-movement-artwork-assets';
import type { CanonicalMovementArtworkKey } from '@/lib/canonical-movement-artwork';
import { movementHeroFocal, movementHeroGeometry, approvedLoggerCrop, reportApprovedArtworkBypass, type MovementHeroFocal } from '@/lib/movement-artwork-hero';
import { movementHeroSourceFrame, type LoggerCrop } from '@/lib/movement-artwork-geometry.mjs';

type LayerProps = Readonly<{
  artworkKey: CanonicalMovementArtworkKey;
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
  const enabled = approvedArtRuntimeEnabled();
  const asset = enabled ? CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[artworkKey] : null;
  useEffect(() => {
    if (__DEV__ && movementDefinitionId && !asset) reportApprovedArtworkBypass(
      { identity_type: 'accessory', movement_definition_id: movementDefinitionId }, null, `movement-art-hero:${surface}`);
  }, [asset, movementDefinitionId, surface]);
  if (!enabled) return null;
  if (!asset) return null;
  const sourceSize = NativeImage.resolveAssetSource(asset.source);
  return <MovementArtworkHeroLayer source={asset.source} sourceWidth={sourceSize?.width} sourceHeight={sourceSize?.height}
    receiptId={receiptId} surface={surface} reduceMotion={reduceMotion} focal={focal || movementHeroFocal(artworkKey)}
    crop={approvedLoggerCrop(artworkKey)} />;
});

/** Identical raster placement and scrims for the Logger and owner crop review. */
export const MovementArtworkHeroLayer = memo(function MovementArtworkHeroLayer({
  source, sourceWidth, sourceHeight, receiptId, surface = 'black', reduceMotion = false, focal,
  crop, onLoad, onError,
}: { source: ImageProps['source']; sourceWidth?: number; sourceHeight?: number; receiptId: string;
  surface?: 'black' | 'superset'; reduceMotion?: boolean; focal: MovementHeroFocal; crop?: LoggerCrop;
  onLoad?: () => void; onError?: () => void }) {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBounds(previous => previous.width === width && previous.height === height ? previous : { width, height });
  }, []);
  const rgb = surface === 'superset' ? '13,11,18' : '0,0,0';
  const shade = (alpha: number) => `rgba(${rgb},${alpha})`;
  const composition = crop?.fit && crop.fit !== 'original' ? { ...focal, cropMode: crop.fit } : focal;
  const imageBox = movementHeroSourceFrame(
    movementHeroGeometry(bounds.width, bounds.height, composition, crop), sourceWidth, sourceHeight);
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
    onLayout={onLayout} style={s.layer} testID="active-movement-art-hero">
    {bounds.width > 0 && bounds.height > 0 ? <Image
      source={source} onLoad={onLoad} onError={onError} style={[s.image, s.atmosphere, imageBox]}
      contentFit="contain" cachePolicy="memory-disk" recyclingKey={receiptId}
      transition={reduceMotion ? 0 : 160} accessibilityIgnoresInvertColors /> : null}
    {/* Feather the raster itself as well as the canvas, including landscape
        exports and images moved by the reviewer. No visible photograph edge. */}
    <>
      <LinearGradient pointerEvents="none" style={[s.image, imageBox]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        colors={[shade(1), shade(0), shade(0), shade(1)]} locations={[0, 0.10, 0.90, 1]} />
      <LinearGradient pointerEvents="none" style={[s.image, imageBox]}
        colors={[shade(1), shade(0), shade(0), shade(1)]} locations={[0, 0.08, 0.88, 1]} />
    </>
    <LinearGradient pointerEvents="none" style={s.fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      colors={[shade(0.8), shade(0.64), shade(0.40), shade(0.12), shade(0.14), shade(0.7)]}
      locations={[0, 0.16, 0.36, 0.58, 0.84, 1]} />
    <LinearGradient pointerEvents="none" style={s.fill} colors={[shade(1), shade(0.48), shade(0.12), shade(0.10), shade(1)]}
      locations={[0, 0.18, 0.38, 0.76, 1]} />
  </View>;
});
const s = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFillObject },
  image: { position: 'absolute' },
  atmosphere: { opacity: 0.72 },
});
