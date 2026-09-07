import { Ionicons } from '@expo/vector-icons';
import React, { type ReactNode } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SLColors, SLFontFamilies, SLLayout } from '@/constants/theme';
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

type AtmosphericHeaderProps = Readonly<{
  title: string;
  contextLabel: string;
  atmosphereSource: ImageSourcePropType;
  accent?: string;
  subtitle?: string;
  onBack: () => void;
  backAccessibilityLabel?: string;
  onTitlePress?: () => void;
  titleExpanded?: boolean;
  artwork?: ReactNode;
  children?: ReactNode;
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
            <Ionicons color={SLColors.textStrong} name="chevron-back" size={24} />
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
            <Ionicons color={SLColors.textStrong} name={action.icon} size={22} />
          </Pressable>
        ) : null}
      </View>
      {subtitle ? <Text style={[styles.subtitle, !onBack && styles.subtitleFlush]}>{subtitle}</Text> : null}
    </View>
  );
}

/**
 * Page identity composed directly into governed atmospheric artwork.
 * This is intentionally not a card, breadcrumb widget, or detached subheader.
 */
export function SLAtmosphericContextHeader({
  title,
  contextLabel,
  atmosphereSource,
  accent = SLColors.accent,
  subtitle,
  onBack,
  backAccessibilityLabel = 'Back',
  onTitlePress,
  titleExpanded = false,
  artwork,
  children,
  style,
  testID,
}: AtmosphericHeaderProps) {
  const identity = <>
    <Text style={[styles.atmosphericContext, { color: accent }]}>{contextLabel}</Text>
    <View style={styles.atmosphericTitleRow}>
      <Text adjustsFontSizeToFit minimumFontScale={0.76} numberOfLines={1} style={styles.atmosphericTitle}>{title}</Text>
      {onTitlePress ? <Ionicons color={accent} name={titleExpanded ? 'chevron-up' : 'chevron-down'} size={17} /> : null}
    </View>
    {subtitle ? <Text numberOfLines={2} style={styles.atmosphericSubtitle}>{subtitle}</Text> : null}
  </>;

  return (
    <ImageBackground
      imageStyle={styles.atmosphericImage}
      resizeMode="cover"
      source={atmosphereSource}
      style={[styles.atmosphericHeader, { borderBottomColor: `${accent}66` }, style]}
      testID={testID}
    >
      <View pointerEvents="none" style={styles.atmosphericScrim} />
      {artwork}
      <View style={styles.atmosphericIdentityRow}>
        <Pressable
          accessibilityLabel={backAccessibilityLabel}
          accessibilityRole="button"
          hitSlop={6}
          onPress={onBack}
          style={({ pressed }) => [styles.atmosphericBackTarget, pressed && styles.pressed]}
          testID={testID ? `${testID}-back` : undefined}
        >
          <View style={[styles.atmosphericBackRail, { backgroundColor: accent }]} />
          <Ionicons color={SLColors.textStrong} name="chevron-back" size={25} />
        </Pressable>
        {onTitlePress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: titleExpanded }}
            onPress={onTitlePress}
            style={({ pressed }) => [styles.atmosphericCopy, pressed && styles.pressed]}
            testID={testID ? `${testID}-title` : undefined}
          >
            {identity}
          </Pressable>
        ) : <View style={styles.atmosphericCopy}>{identity}</View>}
      </View>
      {children ? <View style={styles.atmosphericFooter}>{children}</View> : null}
    </ImageBackground>
  );
}

export function SLCompactTabRail({
  items,
  selectedKey,
  onSelect,
  style,
  testID,
  accent = SLColors.accent,
}: Readonly<{
  items: readonly SLCompactTab[];
  selectedKey: string;
  onSelect: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accent?: string;
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
            style={({ pressed }) => [styles.tabTarget, selected && styles.tabTargetSelected, selected && { borderBottomColor: accent, backgroundColor: `${accent}12` }, pressed && styles.pressed]}
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
  header: { gap: 2, paddingHorizontal: SLLayout.screenGutter, paddingTop: 4, paddingBottom: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#242936' },
  identityRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9 },
  controlTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  copy: { minWidth: 0, flex: 1, justifyContent: 'center' },
  breadcrumb: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodySemiBold, fontSize: 9, lineHeight: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: SLColors.textStrong, fontFamily: SLFontFamilies.bodyBold, fontSize: 24, lineHeight: 29, letterSpacing: -0.45 },
  subtitle: { color: SLColors.textMuted, fontSize: 12, lineHeight: 17, paddingLeft: 53, paddingRight: 8 },
  subtitleFlush: { paddingLeft: 0 },
  atmosphericHeader: { minHeight: 164, overflow: 'hidden', justifyContent: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: '#000000' },
  atmosphericImage: { opacity: 0.92 },
  atmosphericScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.14)' },
  atmosphericIdentityRow: { minHeight: 116, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: SLLayout.screenGutter, paddingTop: 14, paddingBottom: 9 },
  atmosphericBackTarget: { width: 44, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', flexShrink: 0 },
  atmosphericBackRail: { width: 2, height: 25, marginRight: 5, borderRadius: 1 },
  atmosphericCopy: { maxWidth: '76%', minWidth: 0, flex: 1, justifyContent: 'flex-end', paddingLeft: 5 },
  atmosphericContext: { fontFamily: SLFontFamilies.bodySemiBold, fontSize: 10, lineHeight: 13, letterSpacing: 1.15, textTransform: 'uppercase' },
  atmosphericTitleRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6 },
  atmosphericTitle: { color: '#F6F3F8', fontFamily: SLFontFamilies.bodyBold, fontSize: 30, lineHeight: 34, letterSpacing: -0.7 },
  atmosphericSubtitle: { maxWidth: 285, color: '#BDC2CA', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  atmosphericFooter: { paddingTop: 1, paddingBottom: 2 },
  tabRail: { minWidth: '100%', paddingHorizontal: SLLayout.screenGutter, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#222733' },
  tabTarget: { minWidth: 88, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', backgroundColor: 'transparent' },
  tabTargetSelected: { borderBottomColor: SLColors.accent },
  tabLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodySemiBold, fontSize: 12, lineHeight: 16 },
  tabLabelSelected: { color: SLColors.textStrong },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
