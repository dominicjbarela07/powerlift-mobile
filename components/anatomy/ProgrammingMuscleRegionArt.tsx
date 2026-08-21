import React, { memo, useMemo } from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { accessoryRegionalArtworkAsset } from '@/lib/accessory-muscle-region-assets';
import {
  resolveProgrammingRegionArtwork,
} from '@/lib/programming-visual-semantics';

type Props = Readonly<{
  primary?: readonly string[] | null;
  level: 'week' | 'session';
  style?: StyleProp<ViewStyle>;
}>;

function ProgrammingMuscleRegionArtComponent({ primary, level, style }: Props) {
  const keys = useMemo(() => resolveProgrammingRegionArtwork(primary || [], level), [level, primary]);
  const assets = keys.map((key) => accessoryRegionalArtworkAsset(key));
  return (
    <View
      accessibilityLabel={`${level === 'week' ? 'Week' : 'Session'} focus: ${assets.map((asset) => asset.label).join(', ')}`}
      accessible
      style={[styles.root, assets.length > 1 && styles.aggregate, style]}
    >
      {assets.map((asset, index) => (
        <Image
          accessibilityIgnoresInvertColors
          key={`${keys[index]}-${index}`}
          resizeMode="contain"
          source={asset.source}
          style={[styles.image, assets.length > 1 && styles.aggregateImage]}
        />
      ))}
    </View>
  );
}

export const ProgrammingMuscleRegionArt = memo(ProgrammingMuscleRegionArtComponent);

const styles = StyleSheet.create({
  root: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  aggregate: { flexDirection: 'row' },
  image: { width: '100%', height: '100%' },
  aggregateImage: { width: '58%', marginHorizontal: '-4%' },
});
