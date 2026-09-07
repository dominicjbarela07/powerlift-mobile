import React from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import {
  strengthLiftDestinationAsset,
  type StrengthLiftVisualDestination,
  type StrengthLiftVisualKey,
} from '@/lib/strength-ledger-visual-assets';

export function StrengthSemanticArtwork({
  lift,
  destination,
  style,
  testID,
  muted = false,
}: Readonly<{
  lift: StrengthLiftVisualKey;
  destination: StrengthLiftVisualDestination;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  muted?: boolean;
}>) {
  const asset = strengthLiftDestinationAsset(lift, destination);
  return (
    <View pointerEvents="none" style={[styles.frame, destinationStyles[destination], style]} testID={testID}>
      <Image
        accessible={false}
        resizeMode={asset.fit}
        source={asset.source}
        style={[styles.image, imageStyles[destination], muted && styles.muted]}
      />
    </View>
  );
}

const destinationStyles: Record<StrengthLiftVisualDestination, ViewStyle> = {
  'context-header': { position: 'absolute', right: 0, top: 0, bottom: 0, width: '46%' },
  'overview-card': { width: '100%', height: 106 },
  'selector-card': { width: '46%', height: '100%' },
  'achievement-card': { width: '100%', height: 94 },
  'detail-hero': { width: '100%', height: 168 },
  'tier-progression': { width: 104, height: 76 },
  picker: { width: 64, height: 46 },
};

const imageStyles: Record<StrengthLiftVisualDestination, ImageStyle> = {
  'context-header': { width: '100%', height: '118%', opacity: 0.48, transform: [{ translateX: 8 }] },
  'overview-card': { width: '96%', height: '96%' },
  'selector-card': { width: '94%', height: '94%' },
  'achievement-card': { width: '96%', height: '96%' },
  'detail-hero': { width: '96%', height: '96%' },
  'tier-progression': { width: '96%', height: '96%' },
  picker: { width: '94%', height: '94%' },
};

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { flexShrink: 0 },
  muted: { opacity: 0.36 },
});
