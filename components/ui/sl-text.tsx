import React from 'react';
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  useWindowDimensions,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

import {
  getSLTypographyRoleStyle,
  SLFontFamilies,
  SLTypographyRoles,
  SLTypographyTextBehaviors,
  type SLTypographyRole,
} from '@/constants/theme';
import { guardedMobileLineHeight } from '@/lib/mobile-text-layout-core';
import { KeyboardFocusContext, useKeyboardViewportHeight } from '@/components/keyboard/KeyboardSurface';
import { multilineInputHeight } from '@/lib/keyboard-layout';

/** Default readable voice for unclassified legacy text during migration. */
export const SLAppTextStyle = {
  fontFamily: SLFontFamilies.body,
  fontWeight: '400',
} satisfies TextStyle;

export type SLTextProps = TextProps & {
  typographyRole?: SLTypographyRole;
};

export type SLTextInputProps = TextInputProps & {
  typographyRole?: SLTypographyRole;
};

export const Text = React.forwardRef<React.ComponentRef<typeof NativeText>, SLTextProps>(
  function SLText({ style, typographyRole, maxFontSizeMultiplier, numberOfLines, ellipsizeMode, ...props }, ref) {
    const { width } = useWindowDimensions();
    const roleDefinition = typographyRole ? SLTypographyRoles[typographyRole] : null;
    const textBehavior = typographyRole ? SLTypographyTextBehaviors[typographyRole] : null;
    const composedStyle = [SLAppTextStyle, style, typographyRole ? getSLTypographyRoleStyle(typographyRole, width) : null];
    const flattenedStyle = StyleSheet.flatten(composedStyle) as TextStyle | undefined;
    const guardedLineHeight = guardedMobileLineHeight(flattenedStyle?.fontSize, flattenedStyle?.lineHeight);
    return (
      <NativeText
        ref={ref}
        {...props}
        maxFontSizeMultiplier={maxFontSizeMultiplier ?? roleDefinition?.maximumFontSizeMultiplier}
        numberOfLines={numberOfLines ?? textBehavior?.maximumNumberOfLines ?? roleDefinition?.maximumNumberOfLines}
        ellipsizeMode={ellipsizeMode ?? textBehavior?.ellipsizeMode}
        style={[composedStyle, guardedLineHeight ? { lineHeight: guardedLineHeight } : null]}
      />
    );
  }
);

export const TextInput = React.forwardRef<React.ComponentRef<typeof NativeTextInput>, SLTextInputProps>(
  function SLTextInput({ style, typographyRole = 'input', maxFontSizeMultiplier, ...props }, ref) {
    const { width, height: windowHeight } = useWindowDimensions();
    const availableHeight = useKeyboardViewportHeight() ?? windowHeight;
    const owner = React.useContext(KeyboardFocusContext);
    const nativeRef = React.useRef<NativeTextInput>(null);
    const [contentHeight, setContentHeight] = React.useState(0);
    const composedStyle = [SLAppTextStyle, style, getSLTypographyRoleStyle(typographyRole, width)];
    const flattenedStyle = StyleSheet.flatten(composedStyle) as TextStyle | undefined;
    const guardedLineHeight = guardedMobileLineHeight(flattenedStyle?.fontSize, flattenedStyle?.lineHeight);
    return (
      <NativeTextInput
        ref={instance => {
          nativeRef.current = instance;
          if (typeof ref === 'function') ref(instance); else if (ref) ref.current = instance;
        }}
        {...props}
        onFocus={event => { owner?.focus(nativeRef.current); props.onFocus?.(event); }}
        onBlur={event => { owner?.blur(nativeRef.current); props.onBlur?.(event); }}
        onContentSizeChange={event => { setContentHeight(event.nativeEvent.contentSize.height); owner?.reveal(); props.onContentSizeChange?.(event); }}
        onSelectionChange={event => { owner?.reveal(); props.onSelectionChange?.(event); }}
        keyboardAppearance={props.keyboardAppearance ?? 'dark'}
        scrollEnabled={props.multiline ? true : props.scrollEnabled}
        maxFontSizeMultiplier={maxFontSizeMultiplier ?? SLTypographyRoles[typographyRole].maximumFontSizeMultiplier}
        style={[composedStyle, guardedLineHeight ? { lineHeight: guardedLineHeight } : null,
          props.multiline ? multilineInputHeight(contentHeight, availableHeight,
            typeof flattenedStyle?.minHeight === 'number' ? flattenedStyle.minHeight : 44,
            typeof flattenedStyle?.maxHeight === 'number' ? flattenedStyle.maxHeight : 160) : null]}
      />
    );
  }
);

Text.displayName = 'SLText';
TextInput.displayName = 'SLTextInput';
