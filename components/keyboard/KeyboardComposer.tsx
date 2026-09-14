import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SL_TAB_ROW_CONTROL } from '@/components/navigation/sl-tab-row-control';
import { useKeyboardState } from './keyboard-state';

/** The floating dock owns resting clearance; composition owns the bottom edge while typing. */
export function KeyboardComposer({ style, ...props }: ViewProps) {
  const keyboard = useKeyboardState();
  const insets = useSafeAreaInsets();
  return <View {...props} style={[style, { flexShrink: 0,
    paddingBottom: keyboard.visible ? 8 : SL_TAB_ROW_CONTROL.dockFrameHeight + insets.bottom + 8,
  }]} />;
}
