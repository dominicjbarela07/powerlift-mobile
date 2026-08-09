import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ImageStyle, type ViewStyle } from 'react-native';
import { Image as ExpoImage, type ImageSource } from 'expo-image';

import { Text } from '@/components/ui/sl-text';
import { useAuth } from '@/context/AuthContext';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
import { API_BASE } from '@/lib/api-base';
import {
  profilePhotoNeedsAuth,
  versionProfilePhotoUrl,
} from '@/lib/profile-photo';

type SLProfileAvatarProps = {
  name?: string | null;
  fallbackInitials?: string | null;
  profilePhotoUrl?: string | null;
  profilePhotoVersion?: string | null;
  size?: number;
  borderRadius?: number;
  statusColor?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
  /** DEV Mock Library only. */
  previewState?: 'normal' | 'loading' | 'failure';
  /** DEV Mock Library only. Runtime callers must use profilePhotoUrl. */
  previewSource?: ImageSource;
};

export function initialsForProfile(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function SLProfileAvatar({
  name,
  fallbackInitials,
  profilePhotoUrl,
  profilePhotoVersion,
  size = 44,
  borderRadius = size / 2,
  statusColor,
  style,
  imageStyle,
  accessibilityLabel,
  previewState = 'normal',
  previewSource,
}: SLProfileAvatarProps) {
  const { token } = useAuth();
  const uri = useMemo(
    () => versionProfilePhotoUrl(profilePhotoUrl, profilePhotoVersion, API_BASE),
    [profilePhotoUrl, profilePhotoVersion]
  );
  const [failed, setFailed] = useState(previewState === 'failure');
  const hasImage = Boolean(uri || previewSource);
  const [loading, setLoading] = useState(hasImage);

  useEffect(() => {
    setFailed(previewState === 'failure');
    setLoading(hasImage);
  }, [hasImage, previewState, uri]);

  const shouldLoadImage = hasImage && !failed && previewState !== 'loading';
  const source = useMemo<ImageSource | null>(() => {
    if (previewSource) return previewSource;
    if (!uri) return null;
    const headers =
      token && profilePhotoNeedsAuth(uri, API_BASE)
        ? { Authorization: `Bearer ${token}` }
        : undefined;
    return { uri, headers };
  }, [previewSource, token, uri]);

  const showInitials = !hasImage || failed;
  const showLoading = hasImage && !failed && (loading || previewState === 'loading');

  return (
    <View
      accessibilityLabel={accessibilityLabel || `${name || 'Profile'} photo`}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius,
        },
        style,
      ]}
    >
      {showInitials ? (
        <Text style={styles.initials}>{fallbackInitials || initialsForProfile(name)}</Text>
      ) : null}
      {showLoading ? <View style={[StyleSheet.absoluteFill, styles.loading]} /> : null}
      {shouldLoadImage && source ? (
        <ExpoImage
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => {
            setFailed(true);
            setLoading(false);
          }}
          onLoad={() => setLoading(false)}
          source={source}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius },
            imageStyle as any,
          ]}
          transition={0}
        />
      ) : null}
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
  loading: {
    backgroundColor: SLColors.surfaceMuted,
  },
  statusDot: {
    borderColor: SLColors.surface,
    borderRadius: SLRadius.pill,
    borderWidth: 2,
    bottom: -1,
    height: 12,
    position: 'absolute',
    right: -1,
    width: 12,
  },
});
