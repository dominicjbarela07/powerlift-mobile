import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

import { SL_TROPHY_ASSETS, isLegacyTrophyGlyph, type SLTrophyTier } from '@/lib/trophy-assets';

export function SLTrophy({
  size,
  tier = 'gold',
  muted = false,
  style,
}: {
  size: number;
  tier?: SLTrophyTier;
  muted?: boolean;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={SL_TROPHY_ASSETS[tier]}
      resizeMode="contain"
      style={[{ width: size, height: size, opacity: muted ? 0.46 : 1 }, style]}
    />
  );
}

/**
 * Preserves existing icon layouts while ensuring legacy trophy/ribbon glyph
 * requests render the canonical Strength Ledger object instead.
 */
export function SLCanonicalIcon({
  name,
  size,
  color,
  trophyTier = 'gold',
}: {
  name: keyof typeof Ionicons.glyphMap;
  size: number;
  color: string;
  trophyTier?: SLTrophyTier;
}) {
  if (isLegacyTrophyGlyph(name)) return <SLTrophy size={size} tier={trophyTier} />;
  return <Ionicons name={name} size={size} color={color} />;
}
