import React from 'react';
import {
  Image,
  type ImageSourcePropType,
  StyleSheet,
  View,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

export type CoreVariantFamily = 'squat' | 'bench' | 'deadlift' | 'press';

type CoreVariantBadgeProps = {
  accentColor: string;
  family: CoreVariantFamily;
  liftArtworkSource: ImageSourcePropType;
  compact?: boolean;
};

function colorWithAlpha(color: string, alpha: number) {
  const match = String(color || '').trim().match(
    /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i,
  );
  if (!match) return color;
  return `rgba(${Number.parseInt(match[1], 16)}, ${Number.parseInt(match[2], 16)}, ${Number.parseInt(match[3], 16)}, ${alpha})`;
}

/**
 * Canonical Core Variant identity: the badge owns the silhouette while the
 * locked Core artwork identifies its Squat, Bench, Deadlift, or Press family.
 */
export function CoreVariantBadge({
  accentColor,
  family,
  liftArtworkSource,
  compact = false,
}: CoreVariantBadgeProps) {
  const highlight = colorWithAlpha(accentColor, 0.92);
  const quiet = colorWithAlpha(accentColor, 0.3);
  const wash = colorWithAlpha(accentColor, 0.16);

  return (
    <View
      accessibilityLabel={`${family} core variant`}
      style={[styles.root, compact && styles.rootCompact]}
      testID={`core-variant-badge-${family}`}
    >
      <Svg height="100%" viewBox="0 0 88 92" width="100%">
        <Defs>
          <SvgLinearGradient id="variant-face" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={wash} />
            <Stop offset="0.5" stopColor="rgba(12, 9, 17, 0.98)" />
            <Stop offset="1" stopColor="rgba(4, 4, 7, 0.99)" />
          </SvgLinearGradient>
          <SvgLinearGradient id="variant-edge" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={highlight} />
            <Stop offset="0.5" stopColor={quiet} />
            <Stop offset="1" stopColor={highlight} />
          </SvgLinearGradient>
        </Defs>
        <Path
          d="M44 2 L78 21 L78 61 L44 82 L10 61 L10 21 Z"
          fill="url(#variant-face)"
          stroke="url(#variant-edge)"
          strokeWidth="2"
        />
        <Path
          d="M44 7 L73 24 L73 58 L44 76 L15 58 L15 24 Z"
          fill="none"
          stroke={colorWithAlpha(accentColor, 0.34)}
          strokeWidth="1"
        />
        <Path
          d="M35 75 L44 90 L53 75 L49 70 L39 70 Z"
          fill="rgba(8, 6, 12, 0.98)"
          stroke={highlight}
          strokeWidth="1.5"
        />
        <Path
          d="M40 77 L44 84 L48 77"
          fill="none"
          stroke={highlight}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </Svg>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={liftArtworkSource}
        style={styles.artwork}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    height: 92,
    justifyContent: 'center',
    width: 88,
  },
  rootCompact: {
    height: 80,
    width: 76,
  },
  artwork: {
    height: '58%',
    left: '14%',
    position: 'absolute',
    top: '18%',
    width: '72%',
  },
});
