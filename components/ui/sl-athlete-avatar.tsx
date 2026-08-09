import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

import { SLRadius } from '@/constants/theme';
import { SLProfileAvatar } from '@/components/ui/sl-profile-avatar';

type SLAthleteAvatarProps = {
  name?: string | null;
  imageUrl?: string | null;
  imageVersion?: string | null;
  size?: number;
  statusColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function SLAthleteAvatar({
  name,
  imageUrl,
  imageVersion,
  size = 44,
  statusColor,
  style,
}: SLAthleteAvatarProps) {
  const radius = size >= 48 ? SLRadius.lg : SLRadius.md;

  return (
    <SLProfileAvatar
      borderRadius={radius}
      name={name}
      profilePhotoUrl={imageUrl}
      profilePhotoVersion={imageVersion}
      size={size}
      statusColor={statusColor}
      style={style}
    />
  );
}
