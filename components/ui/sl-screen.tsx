import React, { type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SLSpacing } from '@/constants/theme';

type ScreenEdges = 'top' | 'bottom' | 'both' | 'none';

type SLScreenProps = ViewProps & {
  children: ReactNode;
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
  ...props
}: SLScreenProps) {
  return (
    <SafeAreaView edges={safeEdges(edges)} style={[styles.safe, style]} {...props}>
      <View style={[styles.content, padded ? styles.padded : null, contentStyle]}>{children}</View>
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
    <SafeAreaView edges={safeEdges(edges)} style={[styles.safe, style]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          padded ? styles.padded : null,
          contentStyle,
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        {...props}
      >
        {children}
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
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  padded: {
    paddingVertical: SLSpacing.lg,
  },
});
