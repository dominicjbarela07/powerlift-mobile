import React from 'react';
import {
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
    return (
      <NativeText
        ref={ref}
        {...props}
        maxFontSizeMultiplier={maxFontSizeMultiplier ?? roleDefinition?.maximumFontSizeMultiplier}
        numberOfLines={numberOfLines ?? textBehavior?.maximumNumberOfLines ?? roleDefinition?.maximumNumberOfLines}
        ellipsizeMode={ellipsizeMode ?? textBehavior?.ellipsizeMode}
        style={[SLAppTextStyle, style, typographyRole ? getSLTypographyRoleStyle(typographyRole, width) : null]}
      />
    );
  }
);

export const TextInput = React.forwardRef<React.ComponentRef<typeof NativeTextInput>, SLTextInputProps>(
  function SLTextInput({ style, typographyRole = 'input', maxFontSizeMultiplier, ...props }, ref) {
    const { width } = useWindowDimensions();
    return (
      <NativeTextInput
        ref={ref}
        {...props}
        maxFontSizeMultiplier={maxFontSizeMultiplier ?? SLTypographyRoles[typographyRole].maximumFontSizeMultiplier}
        style={[SLAppTextStyle, style, getSLTypographyRoleStyle(typographyRole, width)]}
      />
    );
  }
);

Text.displayName = 'SLText';
TextInput.displayName = 'SLTextInput';
