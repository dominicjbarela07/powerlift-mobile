import React, { memo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import {
  normalizeMuscleIds,
  type AnatomyPresentationPreference,
} from '@/lib/anatomy-system';
import { MuscleMap } from './MuscleMap';

type AthleteAnatomy = Readonly<{
  anatomy_display_preference?: AnatomyPresentationPreference | string | null;
  sex?: string | null;
}>;

export type GovernedMuscleThumbnailProps = Readonly<{
  athlete?: AthleteAnatomy | null;
  primary: string;
  secondary?: readonly string[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

function GovernedMuscleThumbnailComponent({
  athlete,
  primary,
  secondary = [],
  style,
  testID,
}: GovernedMuscleThumbnailProps) {
  const primaryId = normalizeMuscleIds([primary])[0];
  const secondaryIds = normalizeMuscleIds(secondary).filter((muscle) => muscle !== primaryId);

  return (
    <View style={[styles.root, style]} testID={testID}>
      {primaryId ? (
        <MuscleMap
          athlete={athlete}
          primary={[primaryId]}
          secondary={secondaryIds}
          semanticLevel="session"
          size="thumbnail"
          style={styles.map}
          surface="square"
          view="auto"
        />
      ) : null}
    </View>
  );
}

export const GovernedMuscleThumbnail = memo(GovernedMuscleThumbnailComponent);

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    backgroundColor: '#15111D',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  map: {
    height: '100%',
    width: '100%',
  },
});
