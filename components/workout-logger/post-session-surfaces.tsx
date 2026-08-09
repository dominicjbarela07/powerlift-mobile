import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SLProfileAvatar } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import {
  SLColors,
  SLRadius,
  SLSpacing,
  SLTypography,
} from '@/constants/theme';

type PostSessionSurfaceTone = 'ceremony' | 'reflection' | 'coach';

const TONE_LIGHT: Record<PostSessionSurfaceTone, readonly [string, string, string]> = {
  ceremony: [
    'rgba(167, 139, 250, 0.18)',
    'rgba(104, 57, 155, 0.055)',
    'rgba(0, 0, 0, 0)',
  ],
  reflection: [
    'rgba(143, 178, 154, 0.085)',
    'rgba(98, 72, 128, 0.035)',
    'rgba(0, 0, 0, 0)',
  ],
  coach: [
    'rgba(167, 139, 250, 0.13)',
    'rgba(232, 61, 154, 0.025)',
    'rgba(0, 0, 0, 0)',
  ],
};

const TONE_BORDER: Record<PostSessionSurfaceTone, string> = {
  ceremony: 'rgba(185, 104, 255, 0.42)',
  reflection: 'rgba(225, 221, 240, 0.14)',
  coach: 'rgba(185, 104, 255, 0.30)',
};

export function PostSessionSurface({
  children,
  tone,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  tone: PostSessionSurfaceTone;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.surface, { borderColor: TONE_BORDER[tone] }, style]}>
      <LinearGradient
        colors={['#0C0A11', '#050508', '#020205']}
        end={{ x: 0.82, y: 1 }}
        locations={[0, 0.58, 1]}
        start={{ x: 0.08, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[...TONE_LIGHT[tone]]}
        end={{ x: 0.88, y: 0.72 }}
        locations={[0, 0.46, 1]}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.innerEdge} />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

export function PostSessionCoachFeedback({
  authorName,
  authorKind,
  feedback,
  previewSource,
  profilePhotoUrl,
  profilePhotoVersion,
}: {
  authorName: string;
  authorKind: 'coach' | 'self';
  feedback: string;
  previewSource?: React.ComponentProps<typeof SLProfileAvatar>['previewSource'];
  profilePhotoUrl?: string | null;
  profilePhotoVersion?: string | null;
}) {
  const roleLabel = authorKind === 'self'
    ? 'Self-coached reflection'
    : 'Coach feedback';

  return (
    <PostSessionSurface
      tone="coach"
      style={styles.feedbackSurface}
      contentStyle={styles.feedbackContent}
    >
      <View style={styles.authorRow}>
        <SLProfileAvatar
          accessibilityLabel={`${authorName} feedback author profile photo`}
          name={authorName}
          previewSource={previewSource}
          profilePhotoUrl={profilePhotoUrl}
          profilePhotoVersion={profilePhotoVersion}
          size={48}
          style={styles.avatar}
        />
        <View style={styles.authorCopy}>
          <Text maxFontSizeMultiplier={1.3} style={styles.authorName}>
            {authorName}
          </Text>
          <Text maxFontSizeMultiplier={1.3} style={styles.authorRole}>
            {roleLabel}
          </Text>
        </View>
      </View>

      <View style={styles.messageRow}>
        <View pointerEvents="none" style={styles.messageAccent} />
        <Text maxFontSizeMultiplier={1.4} style={styles.message}>
          {feedback}
        </Text>
      </View>
    </PostSessionSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: SLColors.black,
    borderRadius: SLRadius.radiusHero,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  innerEdge: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(255,255,255,0.045)',
    borderRadius: SLRadius.radiusHero - 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    margin: 1,
  },
  feedbackSurface: {
    marginBottom: SLSpacing.lg,
    marginHorizontal: 0,
    marginTop: SLSpacing.sm,
  },
  feedbackContent: {
    paddingHorizontal: SLSpacing.lg,
    paddingVertical: SLSpacing.lg,
  },
  authorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.md,
  },
  avatar: {
    borderColor: 'rgba(185, 104, 255, 0.42)',
    borderWidth: 1,
  },
  authorCopy: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    ...SLTypography.bodyStrong,
    color: SLColors.textStrong,
  },
  authorRole: {
    ...SLTypography.micro,
    color: SLColors.accentViolet,
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  messageRow: {
    flexDirection: 'row',
    gap: SLSpacing.md,
    marginTop: SLSpacing.lg,
    paddingRight: SLSpacing.xs,
  },
  messageAccent: {
    backgroundColor: SLColors.accentViolet,
    borderRadius: SLRadius.pill,
    opacity: 0.72,
    width: 2,
  },
  message: {
    ...SLTypography.rowTitle,
    color: SLColors.text,
    flex: 1,
    lineHeight: 24,
  },
});
