import React from 'react';
import {
  RefreshControl,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

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
    ...rest
  },
  ref
) {
  return (
    <ScrollView
      ref={ref}
      {...rest}
      keyboardShouldPersistTaps={rest.keyboardShouldPersistTaps ?? 'handled'}
      contentContainerStyle={contentContainerStyle}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {children}
    </ScrollView>
  );
});

export default RefreshScreen;