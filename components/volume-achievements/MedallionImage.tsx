import React, { useState } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MajorVolumeMedallionImageSource } from '@/lib/major-volume-medallion-assets';

/** Draw one exact tile from the lossless medallion package, at contain size. */
export function MedallionImage({ source, style, accessibilityLabel }: {
  source: MajorVolumeMedallionImageSource;
  style: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const [size, setSize] = useState(0);
  return <View
    accessibilityRole="image"
    accessibilityLabel={accessibilityLabel}
    style={[style, { alignItems: 'center', justifyContent: 'center' }]}
    onLayout={({ nativeEvent: { layout } }) => setSize(Math.min(layout.width, layout.height))}
  >
    {size > 0 && <View style={{ width: size, height: size, overflow: 'hidden' }}>
      <Image
        accessible={false}
        source={source.source}
        resizeMode="stretch"
        style={{ position: 'absolute', width: size * source.columns, height: size * source.rows,
          left: -size * source.column, top: -size * source.row }}
      />
    </View>}
  </View>;
}
