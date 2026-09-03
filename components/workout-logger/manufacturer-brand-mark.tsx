import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
import { MANUFACTURER_LOGO_ASSETS } from '@/lib/manufacturer-logo-assets';
import { resolveManufacturerBrand } from '@/lib/manufacturer-registry';

type ManufacturerBrandMarkProps = Readonly<{
  manufacturerName: string | null | undefined;
  compact?: boolean;
}>;

/**
 * Runtime-2.0.2-compatible projection of the canonical manufacturer mark.
 * Manufacturer availability still comes exclusively from the backend catalog;
 * this component only resolves the static presentation asset for a returned row.
 */
export function ManufacturerBrandMark({
  manufacturerName,
  compact = false,
}: ManufacturerBrandMarkProps) {
  const brand = resolveManufacturerBrand(manufacturerName);
  const source = brand.logoAssetKey
    ? MANUFACTURER_LOGO_ASSETS[brand.logoAssetKey]
    : null;

  return (
    <View
      accessibilityLabel={`${brand.displayName} manufacturer`}
      style={[
        styles.frame,
        source && brand.logoSurface === 'light' ? styles.frameLight : null,
        compact ? styles.frameCompact : null,
      ]}
    >
      {source ? (
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={source}
          style={[
            styles.logo,
            { transform: [{ scale: brand.opticalScale }] },
          ]}
        />
      ) : (
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={2}
          style={styles.fallbackText}
        >
          {brand.displayName}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 9, 15, 0.88)',
    borderColor: 'rgba(167, 139, 250, 0.24)',
    borderRadius: SLRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 7,
    width: 78,
  },
  frameCompact: {
    height: 40,
    paddingHorizontal: 6,
    width: 68,
  },
  frameLight: {
    backgroundColor: '#E9E6EC',
    borderColor: 'rgba(255, 255, 255, 0.52)',
  },
  logo: {
    height: '100%',
    width: '100%',
  },
  fallbackText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    lineHeight: 12,
    textAlign: 'center',
  },
});
