import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
import { MANUFACTURER_LOGO_ASSETS } from '@/lib/manufacturer-logo-assets';
import { resolveManufacturerBrand } from '@/lib/manufacturer-registry';

type ManufacturerBrandMarkProps = Readonly<{
  manufacturerName: string | null | undefined;
  compact?: boolean;
  hero?: boolean;
}>;

export function ManufacturerBrandMark({
  manufacturerName,
  compact = false,
  hero = false,
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
        hero ? styles.frameHero : null,
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
  frameHero: {
    borderRadius: SLRadius.md,
    height: 68,
    paddingHorizontal: 10,
    width: 112,
  },
  logo: {
    height: '100%',
    width: '100%',
  },
  fallbackText: {
    color: SLColors.textSecondary,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    lineHeight: 12,
    textAlign: 'center',
  },
});
