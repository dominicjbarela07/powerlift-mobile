import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polyline,
  Rect,
} from 'react-native-svg';

import { SLColors, SLRadius } from '@/constants/theme';
import type { SLAccessoryIconName } from '@/lib/accessory-icon-resolver';

function AccessoryGlyph({
  name,
  primary,
  secondary,
}: {
  name: SLAccessoryIconName;
  primary: string;
  secondary: string;
}) {
  const shared = {
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 3.2,
  };

  if (name === 'dumbbell-press') {
    return (
      <>
        <Path d="M18 45 L43 45 L51 51" stroke={secondary} {...shared} />
        <Path d="M25 43 L31 29 L39 22" stroke={primary} {...shared} />
        <Path d="M41 43 L37 30 L32 23" stroke={primary} {...shared} />
        <Line x1="18" y1="20" x2="27" y2="27" stroke={primary} {...shared} />
        <Line x1="46" y1="20" x2="37" y2="27" stroke={primary} {...shared} />
        <Rect x="14" y="16" width="4" height="10" rx="2" fill={secondary} />
        <Rect x="46" y="16" width="4" height="10" rx="2" fill={secondary} />
      </>
    );
  }

  if (name === 'dumbbell-row') {
    return (
      <>
        <Path d="M18 21 L38 26 L47 42" stroke={secondary} {...shared} />
        <Path d="M29 28 L22 43" stroke={primary} {...shared} />
        <Path d="M37 28 L35 45" stroke={primary} {...shared} />
        <Line x1="43" y1="41" x2="52" y2="48" stroke={primary} {...shared} />
        <Rect x="39" y="37" width="4" height="10" rx="2" transform="rotate(-45 41 42)" fill={secondary} />
        <Rect x="51" y="45" width="4" height="10" rx="2" transform="rotate(-45 53 50)" fill={secondary} />
        <Circle cx="17" cy="18" r="4" fill={primary} />
      </>
    );
  }

  if (name === 'barbell-row') {
    return (
      <>
        <Path d="M16 20 L36 27 L45 40" stroke={secondary} {...shared} />
        <Path d="M27 28 L21 44 M36 29 L35 46" stroke={primary} {...shared} />
        <Line x1="13" y1="43" x2="54" y2="43" stroke={primary} {...shared} />
        <Rect x="9" y="36" width="5" height="14" rx="2" fill={secondary} />
        <Rect x="54" y="36" width="5" height="14" rx="2" fill={secondary} />
        <Circle cx="15" cy="17" r="4" fill={primary} />
      </>
    );
  }

  if (name === 'ez-curl') {
    return (
      <>
        <Polyline points="14,32 23,32 28,27 36,37 41,32 50,32" stroke={primary} {...shared} />
        <Rect x="9" y="25" width="5" height="14" rx="2" fill={secondary} />
        <Rect x="50" y="25" width="5" height="14" rx="2" fill={secondary} />
        <Path d="M25 46 C25 39 28 36 32 36 C36 36 39 39 39 46" stroke={secondary} {...shared} />
      </>
    );
  }

  if (name === 'machine-chest-press') {
    return (
      <>
        <Path d="M20 47 L20 24 L31 24 L36 35 L36 49" stroke={secondary} {...shared} />
        <Circle cx="30" cy="18" r="4" fill={primary} />
        <Path d="M30 24 L30 36 M30 28 L43 25 L50 31" stroke={primary} {...shared} />
        <Line x1="48" y1="27" x2="53" y2="35" stroke={secondary} {...shared} />
        <Line x1="17" y1="49" x2="42" y2="49" stroke={primary} {...shared} />
      </>
    );
  }

  if (name === 'cable-row') {
    return (
      <>
        <Rect x="12" y="12" width="8" height="40" rx="3" stroke={secondary} {...shared} />
        <Circle cx="16" cy="18" r="2.5" fill={primary} />
        <Path d="M18 18 C31 18 34 26 42 33" stroke={primary} {...shared} />
        <Line x1="39" y1="31" x2="47" y2="37" stroke={primary} {...shared} />
        <Circle cx="36" cy="36" r="4" fill={secondary} />
        <Path d="M36 40 L31 49 M37 40 L45 48 M33 42 L24 39" stroke={secondary} {...shared} />
        <Line x1="23" y1="50" x2="51" y2="50" stroke={primary} {...shared} />
      </>
    );
  }

  if (name === 'pulldown') {
    return (
      <>
        <Rect x="12" y="11" width="8" height="42" rx="3" stroke={secondary} {...shared} />
        <Circle cx="16" cy="17" r="2.5" fill={primary} />
        <Path d="M18 17 L32 17 L32 25" stroke={primary} {...shared} />
        <Path d="M22 26 L32 22 L42 26" stroke={primary} {...shared} />
        <Circle cx="32" cy="34" r="4" fill={secondary} />
        <Path d="M32 38 L32 49 M32 40 L24 30 M32 40 L40 30" stroke={secondary} {...shared} />
        <Line x1="25" y1="51" x2="43" y2="51" stroke={primary} {...shared} />
      </>
    );
  }

  if (name === 'leg-extension') {
    return (
      <>
        <Path d="M18 45 L18 23 L32 23 L38 36" stroke={secondary} {...shared} />
        <Circle cx="31" cy="17" r="4" fill={primary} />
        <Path d="M31 23 L34 36 L48 43" stroke={primary} {...shared} />
        <Circle cx="50" cy="44" r="4" stroke={secondary} {...shared} />
        <Line x1="15" y1="49" x2="37" y2="49" stroke={primary} {...shared} />
      </>
    );
  }

  if (name === 'leg-curl') {
    return (
      <>
        <Line x1="14" y1="34" x2="42" y2="34" stroke={secondary} {...shared} />
        <Circle cx="20" cy="26" r="4" fill={primary} />
        <Path d="M24 28 L35 34 L45 34 L51 26" stroke={primary} {...shared} />
        <Circle cx="52" cy="24" r="4" stroke={secondary} {...shared} />
        <Path d="M17 37 L14 49 M39 37 L42 49" stroke={secondary} {...shared} />
      </>
    );
  }

  if (name === 'pec-deck') {
    return (
      <>
        <Path d="M22 50 L22 30 L42 30 L42 50" stroke={secondary} {...shared} />
        <Circle cx="32" cy="20" r="4" fill={primary} />
        <Path d="M32 24 L32 41 M31 29 L20 22 L14 31 M33 29 L44 22 L50 31" stroke={primary} {...shared} />
        <Circle cx="14" cy="33" r="3" fill={secondary} />
        <Circle cx="50" cy="33" r="3" fill={secondary} />
      </>
    );
  }

  return (
    <>
      <Circle cx="32" cy="23" r="4" fill={primary} />
      <Path d="M32 27 L32 45 M31 31 L17 24 M33 31 L47 24 M27 45 L22 53 M37 45 L42 53" stroke={secondary} {...shared} />
      <Rect x="11" y="18" width="5" height="11" rx="2" transform="rotate(-25 13.5 23.5)" fill={primary} />
      <Rect x="48" y="18" width="5" height="11" rx="2" transform="rotate(25 50.5 23.5)" fill={primary} />
    </>
  );
}

export function SLAccessoryIcon({
  name,
  size = 58,
  accessibilityLabel,
}: {
  name: SLAccessoryIconName;
  size?: number;
  accessibilityLabel?: string;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel || `${name.replace(/-/g, ' ')} accessory`}
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: Math.max(SLRadius.md, Math.round(size * 0.28)),
        },
      ]}
    >
      <Svg width={size * 0.82} height={size * 0.82} viewBox="0 0 64 64">
        <G>
          <AccessoryGlyph
            name={name}
            primary={SLColors.accentViolet}
            secondary={SLColors.accentSteel}
          />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceEmbedded,
    borderWidth: 1,
    borderColor: SLColors.borderStandard,
    shadowColor: SLColors.accentViolet,
    shadowOpacity: 0.13,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
  },
});
