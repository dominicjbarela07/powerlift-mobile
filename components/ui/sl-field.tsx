import React, { useState } from 'react';
import { StyleSheet, View, type TextInputProps, type ViewStyle, type StyleProp } from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';

import { SLColors, SLRadius, SLShadows, SLSpacing, SLTypography } from '@/constants/theme';
import { SLMaterialOverlay } from './sl-workspace';

type Props = TextInputProps & {
  label?: string;
  helperText?: string;
  errorText?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function SLField({ label, helperText, errorText, containerStyle, multiline, style, onBlur, onFocus, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text typographyRole="bodyStrong" style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputShell, focused && styles.inputFocused, multiline && styles.multiline, errorText && styles.inputError]}>
        <SLMaterialOverlay compact level={2} />
        <TextInput
          placeholderTextColor={SLColors.textSubtle}
          style={[styles.input, style]}
          multiline={multiline}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          {...props}
        />
      </View>
      {errorText ? <Text typographyRole="errorText" style={styles.error}>{errorText}</Text> : helperText ? <Text typographyRole="caption" style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SLSpacing.xs },
  label: { ...SLTypography.utilityLabel, color: SLColors.textMuted, textTransform: 'uppercase' },
  inputShell: {
    backgroundColor: SLColors.object,
    borderColor: SLColors.borderStandard,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    minHeight: 50,
    overflow: 'hidden',
    position: 'relative',
    ...SLShadows.level2,
  },
  input: {
    ...SLTypography.body,
    backgroundColor: 'transparent',
    color: SLColors.textStrong,
    flex: 1,
    paddingHorizontal: SLSpacing.lg,
    paddingVertical: SLSpacing.md,
  },
  inputFocused: { backgroundColor: SLColors.objectRaised, borderColor: SLColors.borderFocus },
  multiline: { minHeight: 104, textAlignVertical: 'top' },
  inputError: { borderColor: SLColors.danger },
  helper: { ...SLTypography.caption, color: SLColors.textSubtle },
  error: { ...SLTypography.caption, color: SLColors.danger },
});
