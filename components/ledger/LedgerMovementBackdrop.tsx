import React, { memo, useEffect, useState } from 'react';
import { Image as NativeImage, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { LEDGER as T } from '@/constants/ledger';
import type { CanonicalMovementArtworkInput } from '@/lib/canonical-movement-artwork';
import { canonicalMovementArtworkSource } from '@/lib/canonical-movement-artwork-assets';
import { reportApprovedArtworkBypass, resolveApprovedExactMovementArtwork } from '@/lib/movement-artwork-hero';

/** The original approved pixels dissolve into the actual material. No image
 * frame, thumbnail crop, tint, or replacement asset. Both masks only feather
 * alpha; contain preserves source proportions without inventing a new crop. */
export const LedgerMovementBackdrop = memo(function LedgerMovementBackdrop({ movement, width = 210, align = 'right', opacity = 1, testID = 'ledger-movement-backdrop' }: {
  movement?: CanonicalMovementArtworkInput | null; width?: number;
  align?: 'left' | 'right'; opacity?: number; testID?: string;
}) {
  const [bounds,setBounds] = useState({width:0,height:0});
  const approved = resolveApprovedExactMovementArtwork(movement);
  const source = approved ? canonicalMovementArtworkSource(movement) : null;
  useEffect(() => { reportApprovedArtworkBypass(movement, source ? approved?.key ?? null : null, 'LedgerMovementBackdrop'); }, [movement, approved, source]);
  if (!source || !approved) return null;
  const dimensions=NativeImage.resolveAssetSource(source),aspect=(dimensions?.width??1)/(dimensions?.height??1);
  const imageWidth=Math.min(bounds.width,bounds.height*aspect),imageHeight=imageWidth/aspect;
  const imageBox={position:'absolute' as const,width:imageWidth,height:imageHeight,left:(bounds.width-imageWidth)/2,top:(bounds.height-imageHeight)/2};
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" testID={testID}
    style={[s.layer, { width, [align]: 0, opacity }]} onLayout={event=>{const {width,height}=event.nativeEvent.layout;setBounds(previous=>previous.width===width&&previous.height===height?previous:{width,height});}}>
    {imageWidth>0&&imageHeight>0?<MaskedView style={imageBox} maskElement={<LinearGradient style={s.fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      colors={align === 'left' ? [T.material.maskClear, T.material.maskOpaque, T.material.maskOpaque, T.material.maskClear, T.material.maskClear] : [T.material.maskClear, T.material.maskClear, T.material.maskOpaque, T.material.maskOpaque, T.material.maskClear]} locations={align === 'left' ? [0, 0.10, 0.48, 0.72, 1] : [0, 0.14, 0.30, 0.94, 1]}/> }>
      <MaskedView style={s.fill} maskElement={<LinearGradient style={s.fill}
        colors={[T.material.maskClear, T.material.maskOpaque, T.material.maskOpaque, T.material.maskClear]} locations={[0, 0.05, 0.96, 1]}/> }>
        <Image source={source} contentFit="contain" cachePolicy="memory-disk" transition={0}
          recyclingKey={approved.candidate_id} accessibilityIgnoresInvertColors style={s.fill}/>
      </MaskedView>
    </MaskedView>:null}
  </View>;
});
const s = StyleSheet.create({ layer: { position: 'absolute', top: 0, bottom: 0 }, fill: { ...StyleSheet.absoluteFillObject } });
