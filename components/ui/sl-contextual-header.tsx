import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SLColors, SLFontFamilies, SLLayout, SLRadius } from '@/constants/theme';
import { Text } from './sl-text';

export type SLContextualHeaderAction = Readonly<{
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}>;

export type SLCompactTab = Readonly<{
  key: string;
  label: string;
  accessibilityLabel?: string;
  testID?: string;
}>;

type HeaderProps = Readonly<{
  title: string;
  breadcrumb?: string;
  subtitle?: string;
  onBack?: () => void;
  backAccessibilityLabel?: string;
  action?: SLContextualHeaderAction;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

/** Canonical compact in-page navigation chrome. */
export function SLContextualHeader({
  title,
  breadcrumb,
  subtitle,
  onBack,
  backAccessibilityLabel = 'Back',
  action,
  style,
  testID,
}: HeaderProps) {
  return (
    <View style={[styles.header, style]} testID={testID}>
      <View style={styles.identityRow}>
        {onBack ? (
          <Pressable
            accessibilityLabel={backAccessibilityLabel}
            accessibilityRole="button"
            hitSlop={4}
            onPress={onBack}
            style={({ pressed }) => [styles.controlTarget, pressed && styles.pressed]}
          >
            <View style={styles.controlVisual}>
              <Ionicons color={SLColors.textStrong} name="chevron-back" size={22} />
            </View>
          </Pressable>
        ) : null}
        <View style={styles.copy}>
          {breadcrumb ? <Text style={styles.breadcrumb}>{breadcrumb}</Text> : null}
          <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.title}>{title}</Text>
        </View>
        {action ? (
          <Pressable
            accessibilityLabel={action.accessibilityLabel}
            accessibilityRole="button"
            hitSlop={4}
            onPress={action.onPress}
            style={({ pressed }) => [styles.controlTarget, pressed && styles.pressed]}
          >
            <View style={styles.controlVisual}>
              <Ionicons color={SLColors.textStrong} name={action.icon} size={21} />
            </View>
          </Pressable>
        ) : null}
      </View>
      {subtitle ? <Text style={[styles.subtitle, !onBack && styles.subtitleFlush]}>{subtitle}</Text> : null}
    </View>
  );
}

export function SLCompactTabRail({
  items,
  selectedKey,
  onSelect,
  style,
  testID,
}: Readonly<{
  items: readonly SLCompactTab[];
  selectedKey: string;
  onSelect: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>) {
  return (
    <ScrollView
      accessibilityRole="tablist"
      contentContainerStyle={styles.tabRail}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      testID={testID}
    >
      {items.map((item) => {
        const selected = item.key === selectedKey;
        return (
          <Pressable
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.key}
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [styles.tabTarget, selected && styles.tabTargetSelected, pressed && styles.pressed]}
            testID={item.testID}
          >
            <Text numberOfLines={1} style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2, paddingHorizontal: SLLayout.screenGutter, paddingTop: 4 },
  identityRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9 },
  controlTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  controlVisual: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  copy: { minWidth: 0, flex: 1, justifyContent: 'center' },
  breadcrumb: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodySemiBold, fontSize: 9, lineHeight: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: SLColors.textStrong, fontFamily: SLFontFamilies.bodyBold, fontSize: 24, lineHeight: 29, letterSpacing: -0.45 },
  subtitle: { color: SLColors.textMuted, fontSize: 12, lineHeight: 17, paddingLeft: 53, paddingRight: 8 },
  subtitleFlush: { paddingLeft: 0 },
  tabRail: { minWidth: '100%', gap: 6, paddingHorizontal: SLLayout.screenGutter, paddingVertical: 4 },
  tabTarget: { minWidth: 82, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: SLRadius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat },
  tabTargetSelected: { borderColor: SLColors.accent, backgroundColor: SLColors.surfaceSelected },
  tabLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodySemiBold, fontSize: 12, lineHeight: 16 },
  tabLabelSelected: { color: SLColors.textStrong },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
