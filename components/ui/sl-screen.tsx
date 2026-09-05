import React, { type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SLLayout } from '@/constants/theme';
import { SLMotionEntrance } from './sl-motion';

type ScreenEdges = 'top' | 'bottom' | 'both' | 'none';

type SLScreenProps = ViewProps & {
  children: ReactNode;
  disableEntranceMotion?: boolean;
  padded?: boolean;
  edges?: ScreenEdges;
  contentStyle?: StyleProp<ViewStyle>;
};

type SLScrollScreenProps = ScrollViewProps & {
  children: ReactNode;
  padded?: boolean;
  edges?: ScreenEdges;
  contentStyle?: StyleProp<ViewStyle>;
};

function safeEdges(edges: ScreenEdges) {
  if (edges === 'top') return ['top'] as const;
  if (edges === 'bottom') return ['bottom'] as const;
  if (edges === 'none') return [] as const;
  return ['top', 'bottom'] as const;
}

export function SLScreen({
  children,
  padded = true,
  edges = 'both',
  style,
  contentStyle,
  disableEntranceMotion = false,
  ...props
}: SLScreenProps) {
  return (
    <SafeAreaView edges={safeEdges(edges)} style={[style, styles.safe]} {...props}>
      <SLMotionEntrance disabled={disableEntranceMotion} style={[styles.content, padded ? styles.padded : null, contentStyle]}>{children}</SLMotionEntrance>
    </SafeAreaView>
  );
}

export function SLScrollScreen({
  children,
  padded = true,
  edges = 'both',
  style,
  contentContainerStyle,
  contentStyle,
  keyboardShouldPersistTaps = 'handled',
  ...props
}: SLScrollScreenProps) {
  return (
    <SafeAreaView edges={safeEdges(edges)} style={[style, styles.safe]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          padded ? styles.padded : null,
          contentStyle,
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        {...props}
      >
        <SLMotionEntrance style={styles.scrollMotion}>{children}</SLMotionEntrance>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  content: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  scroll: {
    backgroundColor: 'transparent',
  },
  scrollContent: {
    backgroundColor: 'transparent',
    flexGrow: 1,
  },
  scrollMotion: {
    backgroundColor: 'transparent',
    flexGrow: 1,
  },
  padded: {
    paddingBottom: SLLayout.screenBottom,
    paddingTop: SLLayout.screenTop,
  },
});
