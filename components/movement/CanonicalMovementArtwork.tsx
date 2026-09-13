import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import {
  Image,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { movementThumbnailGeometry, reportApprovedArtworkBypass, resolveApprovedExactMovementArtwork } from '@/lib/movement-artwork-hero';
import { CoreVariantBadge } from '@/components/workout-logger/core-variant-badge';
import { SLColors, SLRadius } from '@/constants/theme';
import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';
import { CANONICAL_ACCESSORY_MOVEMENT_ARTWORK, CANONICAL_CORE_MOVEMENT_ARTWORK } from '@/lib/canonical-movement-artwork-assets';
import {
  resolveCanonicalMovementArtwork,
  normalizeCanonicalMovementArtSubject,
  type CanonicalMovementArtworkInput,
} from '@/lib/canonical-movement-artwork';

type Props = Readonly<{
  movement?: CanonicalMovementArtworkInput | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  surface?: string;
  requireHumanApproval?: boolean;
  /** Keep governed accessory muscle context visible beside an exact movement hero. */
  accessoryPresentation?: 'movement' | 'muscle-focus';
}>;

const warned = new Set<string>();

export function CanonicalMovementArtwork({ movement, size = 72, style, testID, surface, accessoryPresentation = 'movement' }: Props) {
  const subject = normalizeCanonicalMovementArtSubject(movement);
  const resolution = resolveCanonicalMovementArtwork(subject);
  const approved = accessoryPresentation === 'movement' ? resolveApprovedExactMovementArtwork(subject) : null;
  const exactAsset = approved ? CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[approved.key] : null;

  useEffect(() => {
    if (accessoryPresentation === 'movement') reportApprovedArtworkBypass(subject, exactAsset && approved ? approved.key : null, surface || testID || 'canonical-movement-artwork');
  }, [subject, approved, exactAsset, accessoryPresentation, surface, testID]);

  useEffect(() => {
    if (!__DEV__ || resolution.kind !== 'neutral') return;
    const consumer = surface || testID || 'canonical-movement-artwork';
    const key = `${consumer}:${resolution.reason}:${subject.canonicalIdentityId}:${subject.canonicalKey}:${subject.sessionItemId}`;
    if (warned.has(key)) return;
    if (warned.size >= 200) warned.clear();
    warned.add(key);
    console.warn('[movement-artwork] unresolved governed subject', {
      surface: consumer, reason: resolution.reason, sessionItemId: subject.sessionItemId, evidenceId: subject.evidenceId,
      canonicalId: subject.canonicalIdentityId, effectiveId: subject.effectiveMovementDefinitionId,
      performedId: subject.performedMovementDefinitionId, movementKey: subject.canonicalKey, source: subject.source,
    });
  }, [subject, resolution, surface, testID]);

  if (resolution.kind === 'accessory') {
    if (exactAsset && approved) {
      return (
        <View accessibilityLabel={exactAsset.label} accessibilityRole="image" style={[styles.frame, { width: size, height: size, borderRadius: Math.min(SLRadius.lg, size * 0.16) }, style]} testID={testID}>
          <Image accessibilityIgnoresInvertColors resizeMode="contain" source={size <= 48 ? exactAsset.thumbnail : exactAsset.source} style={[styles.exactImage, size <= 80 ? movementThumbnailGeometry(size, approved.key) : { width: size, height: size }]} />
        </View>
      );
    }
    const asset = accessoryMuscleRegionAsset(resolution.regionKey);
    return (
      <View accessibilityLabel={`${asset.label} targeted muscle-group artwork`} accessibilityRole="image" style={[styles.frame, { width: size, height: size }, style]} testID={testID}>
        <Image accessibilityIgnoresInvertColors resizeMode="contain" source={asset.source} style={styles.image} />
      </View>
    );
  }

  if (resolution.kind === 'core_variant') {
    return (
      <View style={[styles.frame, { width: size, height: size }, style]} testID={testID}>
        <View style={{ transform: [{ scale: size / 92 }] }}>
          <CoreVariantBadge accentColor={SLColors.accentViolet} family={resolution.family} liftArtworkSource={CANONICAL_CORE_MOVEMENT_ARTWORK[resolution.family]} />
        </View>
      </View>
    );
  }

  if (resolution.kind === 'core') {
    return (
      <View accessibilityLabel={`${resolution.family} canonical Core artwork`} accessibilityRole="image" style={[styles.frame, { width: size, height: size }, style]} testID={testID}>
        <Image accessibilityIgnoresInvertColors resizeMode="contain" source={CANONICAL_CORE_MOVEMENT_ARTWORK[resolution.family]} style={styles.image} />
      </View>
    );
  }

  return (
    <View accessibilityLabel="Movement artwork unavailable" accessibilityRole="image" style={[styles.frame, styles.neutral, { width: size, height: size }, style]} testID={testID}>
      <Ionicons name="help-outline" size={Math.max(18, Math.round(size * 0.38))} color={SLColors.accentMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    borderRadius: SLRadius.lg,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { height: '100%', width: '100%' },
  exactImage: { position: 'absolute' },
  neutral: {
    backgroundColor: SLColors.surfaceFloating,
    borderColor: SLColors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
