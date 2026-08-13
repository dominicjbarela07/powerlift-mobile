import React from 'react';
import {
  RefreshControl,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';

import { SLColors } from '@/constants/theme';

type RefreshScreenProps = Omit<ScrollViewProps, 'refreshControl'> & {
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

const RefreshScreen = React.forwardRef<ScrollView, RefreshScreenProps>(function RefreshScreen(
  {
    refreshing,
    onRefresh,
    children,
    contentContainerStyle,
    style,
    ...rest
  },
  ref
) {
  return (
    <ScrollView
      ref={ref}
      {...rest}
      style={[style, styles.scroll]}
      keyboardShouldPersistTaps={rest.keyboardShouldPersistTaps ?? 'handled'}
      contentContainerStyle={contentContainerStyle}
      refreshControl={
        <RefreshControl
          colors={[SLColors.accentViolet]}
          progressBackgroundColor={SLColors.objectRaised}
          refreshing={refreshing}
          tintColor={SLColors.accentViolet}
          titleColor={SLColors.textMuted}
          onRefresh={onRefresh}
        />
      }
    >
      {children}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: 'transparent',
  },
});

export default RefreshScreen;
