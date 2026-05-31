import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SLColors, SLRadius, SLTypography } from '@/constants/theme';

type SLAthleteAvatarProps = {
  name?: string | null;
  imageUrl?: string | null;
  size?: number;
  statusColor?: string;
  style?: StyleProp<ViewStyle>;
};

function initialsFor(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function SLAthleteAvatar({
  name,
  imageUrl,
  size = 44,
  statusColor,
  style,
}: SLAthleteAvatarProps) {
  const radius = size >= 48 ? SLRadius.lg : SLRadius.md;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
        style,
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
            },
          ]}
        />
      ) : (
        <Text style={styles.initials}>{initialsFor(name)}</Text>
      )}
      {statusColor ? <View style={[styles.statusDot, { backgroundColor: statusColor }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceMuted,
    borderColor: SLColors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.label.fontFamily,
    fontSize: SLTypography.label.fontSize,
    fontWeight: SLTypography.label.fontWeight,
  },
  statusDot: {
    borderColor: SLColors.surface,
    borderRadius: 999,
    borderWidth: 2,
    bottom: -1,
    height: 12,
    position: 'absolute',
    right: -1,
    width: 12,
  },
});
