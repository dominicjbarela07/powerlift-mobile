import React, { memo } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/sl-text';
import { canonicalMuscleGroupArtwork } from '@/lib/accessory-muscle-region-assets';

type Props = {
  group: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Navigation identifies a taxonomy entry; it is not anatomical evidence. */
export const CanonicalMuscleGroupArtwork = memo(function CanonicalMuscleGroupArtwork({ group, style, testID }: Props) {
  const asset = canonicalMuscleGroupArtwork(group);
  return (
    <View style={[styles.root, style]} testID={testID}>
      {asset ? (
        <Image accessibilityIgnoresInvertColors accessibilityLabel={`${asset.label} muscle-group artwork`}
          resizeMode="contain" source={asset.source} style={styles.image} />
      ) : (
        <View accessibilityLabel="Muscle-group artwork unavailable" style={styles.missing}>
          <Ionicons name="image-outline" size={19} color="#92899F" />
          <Text style={styles.missingLabel}>Art unavailable</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  missing: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  missingLabel: { color: '#92899F', fontSize: 9, lineHeight: 11, textAlign: 'center' },
});
