import React, { memo, useMemo } from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SLColors } from '@/constants/theme';

import { accessoryRegionalArtworkAsset } from '@/lib/accessory-muscle-region-assets';
import {
  resolveProgrammingRegionArtwork,
} from '@/lib/programming-visual-semantics';

type Props = Readonly<{
  primary?: readonly string[] | null;
  secondary?: readonly string[] | null;
  level: 'week' | 'session';
  style?: StyleProp<ViewStyle>;
}>;

function ProgrammingMuscleRegionArtComponent({ primary, secondary, level, style }: Props) {
  const keys = useMemo(() => resolveProgrammingRegionArtwork(primary || [], level), [level, primary]);
  const assets = keys.map((key) => accessoryRegionalArtworkAsset(key));
  if (!assets.length) {
    return (
      <View accessibilityLabel="Session muscle focus unavailable" accessible style={[styles.root, styles.neutral, style]}>
        <Ionicons color={SLColors.textMuted} name="barbell-outline" size={26} />
      </View>
    );
  }
  return (
    <View
      accessibilityLabel={`${level === 'week' ? 'Week' : 'Session'} focus: ${[
        ...assets.map((asset) => asset.label),
        ...(secondary || []).map((value) => String(value).replaceAll('_', ' ')),
      ].join(', ')}`}
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
  neutral: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(140,134,153,0.30)', borderRadius: 12, backgroundColor: 'rgba(12,13,18,0.72)' },
  aggregate: { flexDirection: 'row' },
  image: { width: '100%', height: '100%' },
  aggregateImage: { width: '58%', marginHorizontal: '-4%' },
});
