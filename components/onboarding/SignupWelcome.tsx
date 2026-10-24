import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { KeyboardScrollView as ScrollView } from '@/components/keyboard/KeyboardSurface';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies } from '@/constants/theme';
import { educationImage } from '@/lib/mobile-education-images';
import { SIGNUP_PATHS, type SignupRole } from '@/lib/signup-paths';

type Props = { role: SignupRole; onSelectRole: (role: SignupRole) => void; onContinue: () => void; onSignIn: () => void };
const roles: SignupRole[] = ['athlete', 'coach', 'self_coach'];

export function SignupWelcome({ role, onSelectRole, onContinue, onSignIn }: Props) {
  const path = SIGNUP_PATHS[role];
  const { fontScale } = useWindowDimensions();
  return <View style={styles.screen} testID="signup-role-preview">
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[SLColors.accentSoft, SLColors.canvas, SLColors.canvas]} locations={[0, 0.64, 1]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[SLColors.illuminationAccent, 'transparent']} style={styles.aura} />
      <View style={styles.orbit} />
      <View style={styles.orbitInner} />
    </View>
    <SafeAreaView key={fontScale} style={styles.safeArea}>
      <View style={styles.header}>
        <Image accessible accessibilityLabel="Strength Ledger" source={require('../../assets/images/16:9.png')} resizeMode="contain" style={styles.logo} />
        <Pressable accessibilityRole="button" onPress={onSignIn} style={styles.signIn}><Text style={styles.signInText}>Sign in</Text><Ionicons accessible={false} name="arrow-forward" color={SLColors.textSecondary} size={15} /></Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.heading}>Choose your experience.</Text>
        <View accessibilityRole="tablist" accessibilityLabel="Choose your Strength Ledger experience" style={[styles.roles, fontScale > 1.3 && styles.rolesStacked]}>
          {roles.map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: role === value }} accessibilityLabel={SIGNUP_PATHS[value].label}
            onPress={() => onSelectRole(value)} style={({ pressed }) => [styles.role, fontScale > 1.3 && styles.roleStacked, role === value && styles.roleSelected, pressed && styles.pressed]}>
            <Ionicons accessible={false} name={SIGNUP_PATHS[value].icon} color={role === value ? SLColors.accentMuted : SLColors.textMuted} size={21} />
            <Text style={[styles.roleLabel, role === value && styles.roleLabelSelected]}>{SIGNUP_PATHS[value].label}</Text>
          </Pressable>)}
        </View>
        <View style={styles.story} accessibilityLiveRegion="polite">
          <Text style={styles.headline}>{path.headline}</Text>
          <Text style={styles.description}>{path.description}</Text>
        </View>
        <View style={[styles.features, fontScale > 1.3 && styles.featuresStacked]}>
          {path.features.map(feature => <View key={feature} style={[styles.feature, fontScale > 1.3 && styles.featureStacked]}>
            <Ionicons accessible={false} name="checkmark-circle-outline" size={17} color={SLColors.accentMuted} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>)}
        </View>
        <ScreenshotPreview key={role} role={role} />
        <Text style={styles.requirement}>{path.requirement}</Text>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Continue as ${path.label}`} onPress={onContinue} style={({ pressed }) => [styles.continue, pressed && styles.pressed]}>
          <LinearGradient colors={[SLColors.accentMuted, SLColors.accentViolet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.continueFill}>
            <Text style={styles.continueLabel}>Continue as {path.label}</Text><Ionicons accessible={false} name="arrow-forward" size={21} color={SLColors.textInverted} />
          </LinearGradient>
        </Pressable>
        <Text style={styles.nextStep}>{path.nextStep}</Text>
      </View>
    </SafeAreaView>
  </View>;
}

function ScreenshotPreview({ role }: { role: SignupRole }) {
  const path = SIGNUP_PATHS[role];
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const { width, height, fontScale } = useWindowDimensions();
  const frameWidth = Math.min(width - 48, 472);
  const capture = path.captures[active];
  const source = educationImage(capture.name);
  const dimensions = Image.resolveAssetSource(source);
  const fullHeight = frameWidth * dimensions.height / dimensions.width;
  const previewHeight = Math.min(246, Math.max(196, height * 0.25));

  return <View style={styles.preview}>
    <View style={styles.previewHeading}><Text style={styles.previewEyebrow}>INSIDE YOUR {role === 'coach' ? 'COACHING' : 'TRAINING'} SPACE</Text><Text style={styles.previewIndex}>0{active + 1} / 02</Text></View>
    <LinearGradient colors={[SLColors.borderFocus, SLColors.borderStandard, SLColors.borderSubtle]} style={styles.previewRim}>
      <View style={[styles.capture, { height: previewHeight }]}>
        {failed[capture.name] ? <View accessibilityRole="text" style={styles.fallback}>
          <Ionicons accessible={false} name={path.icon} size={42} color={SLColors.accentMuted} /><Text style={styles.fallbackTitle}>{capture.label}</Text><Text style={styles.description}>A preview is unavailable. You can still continue with setup.</Text>
        </View> : <Image accessible accessibilityRole="image" accessibilityLabel={`${capture.label}. Actual app screenshot with example data.`} source={source} resizeMode="cover" onError={() => setFailed(current => ({ ...current, [capture.name]: true }))}
          style={{ position: 'absolute', width: frameWidth, height: fullHeight, top: -fullHeight * capture.focus, alignSelf: 'center' }} />}
        <LinearGradient pointerEvents="none" colors={['transparent', SLColors.canvas]} locations={[0.88, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.captureCaption}><Text style={styles.captureTitle}>{capture.label}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next app preview" onPress={() => setActive(value => (value + 1) % path.captures.length)} style={styles.nextPreview}><Ionicons accessible={false} name="arrow-forward" size={19} color={SLColors.accentMuted} /></Pressable></View>
    </LinearGradient>
    <View style={[styles.previewControls, fontScale > 1.3 && { flexWrap: 'wrap' }]}>
      <View style={styles.previewButtons}>{path.captures.map((item, index) => <Pressable key={item.name} accessibilityRole="button" accessibilityLabel={`Show preview ${index + 1}: ${item.label}`} accessibilityState={{ selected: active === index }} onPress={() => setActive(index)} style={styles.previewTarget}>
        <View style={[styles.previewDot, active === index && styles.previewDotSelected]} />
      </Pressable>)}</View>
      <Text style={styles.exampleLabel}>Actual app · Example data</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SLColors.canvas },
  safeArea: { flex: 1 },
  aura: { position: 'absolute', top: 180, right: -170, width: 490, height: 600, borderRadius: 300, transform: [{ rotate: '-24deg' }] },
  orbit: { position: 'absolute', top: 120, right: -205, width: 510, height: 510, borderRadius: 255, borderWidth: 1, borderColor: SLColors.illuminationAccent, transform: [{ scaleX: 0.75 }, { rotate: '-20deg' }] },
  orbitInner: { position: 'absolute', top: 165, right: -170, width: 410, height: 410, borderRadius: 205, borderWidth: 1, borderColor: SLColors.borderSubtle },
  header: { width: '100%', maxWidth: 520, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 4, paddingBottom: 12 },
  logo: { width: 146, height: 36 },
  signIn: { minHeight: 44, minWidth: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  signInText: { color: SLColors.textSecondary, fontSize: 14, fontFamily: SLFontFamilies.sansSemiBold },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 4, paddingBottom: 12 },
  heading: { color: SLColors.textStrong, fontSize: 24, lineHeight: 30, fontFamily: SLFontFamilies.sansSemiBold, letterSpacing: -0.5 },
  roles: { flexDirection: 'row', gap: 9, marginTop: 14 },
  rolesStacked: { flexDirection: 'column' },
  role: { flex: 1, minWidth: 0, minHeight: 68, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.canvasRaised },
  roleStacked: { flex: 0, minHeight: 64, flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 18, gap: 14 },
  roleSelected: { borderColor: SLColors.accentViolet, backgroundColor: SLColors.accentSoft },
  roleLabel: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 13, textAlign: 'center' },
  roleLabelSelected: { color: SLColors.textStrong },
  pressed: { opacity: 0.76 },
  story: { marginTop: 22, marginBottom: 12, gap: 8 },
  headline: { color: SLColors.textStrong, fontSize: 33, lineHeight: 37, letterSpacing: -0.8, fontFamily: SLFontFamilies.sansSemiBold },
  description: { color: SLColors.textSecondary, fontSize: 14, lineHeight: 21, fontFamily: SLFontFamilies.sans },
  preview: { width: '100%' },
  previewHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 },
  previewEyebrow: { flex: 1, fontSize: 10, letterSpacing: 1.1, color: SLColors.textMuted, fontFamily: SLFontFamilies.sansSemiBold },
  previewIndex: { fontSize: 11, letterSpacing: 1, color: SLColors.accentMuted, fontFamily: SLFontFamilies.sansSemiBold },
  previewRim: { padding: 1, borderRadius: 20, overflow: 'hidden' },
  capture: { overflow: 'hidden', borderTopLeftRadius: 19, borderTopRightRadius: 19, backgroundColor: SLColors.canvas },
  captureCaption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: SLColors.canvasRaised, paddingHorizontal: 16, paddingVertical: 0 },
  captureTitle: { flex: 1, color: SLColors.textStrong, fontSize: 14, fontFamily: SLFontFamilies.sansSemiBold },
  previewControls: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8 },
  previewButtons: { flexDirection: 'row' },
  previewTarget: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  previewDot: { width: 5, height: 5, borderRadius: 4, backgroundColor: SLColors.textSubtle },
  previewDotSelected: { width: 19, backgroundColor: SLColors.accentViolet },
  exampleLabel: { flex: 1, textAlign: 'right', fontSize: 10, color: SLColors.textMuted, fontFamily: SLFontFamilies.sans },
  nextPreview: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  features: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  featuresStacked: { flexDirection: 'column' },
  feature: { flex: 1, gap: 7 },
  featureStacked: { flex: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { color: SLColors.textSecondary, fontSize: 12, lineHeight: 17, fontFamily: SLFontFamilies.sans },
  requirement: { color: SLColors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 17, marginBottom: 8, fontFamily: SLFontFamilies.sans },
  footer: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, backgroundColor: SLColors.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderSubtle },
  continue: { borderRadius: 15, overflow: 'hidden' },
  continueFill: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  continueLabel: { flexShrink: 1, textAlign: 'center', color: SLColors.textInverted, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 16 },
  nextStep: { color: SLColors.textMuted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 10, fontFamily: SLFontFamilies.sans },
  fallback: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  fallbackTitle: { fontFamily: SLFontFamilies.sansSemiBold, color: SLColors.textStrong, fontSize: 20 },
});
