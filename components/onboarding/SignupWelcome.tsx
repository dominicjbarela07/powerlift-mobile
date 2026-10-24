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

type Props = {
  role: SignupRole; stage: 'choose' | 'preview'; onSelectRole: (role: SignupRole) => void;
  onBack: () => void; onContinue: () => void; onSignIn: () => void;
};
const roles: SignupRole[] = ['athlete', 'coach', 'self_coach'];
const roleDescriptions = { athlete: 'Train with a coach', coach: 'Coach a team', self_coach: 'Run your own training' };

export function SignupWelcome({ role, stage, onSelectRole, onBack, onContinue, onSignIn }: Props) {
  const path = SIGNUP_PATHS[role];
  const { fontScale, height, width } = useWindowDimensions();
  const [photoFailed, setPhotoFailed] = useState(false);
  const choosing = stage === 'choose';
  return <View style={styles.screen} testID={choosing ? 'signup-choose-path' : 'signup-app-preview'}>
    {choosing && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {!photoFailed && <Image accessible={false} source={require('../../assets/images/onboarding/loaded-iron-welcome-v1.png')}
        resizeMode="contain" style={[styles.gymPhoto, { height: width * 1.5 }]} onError={() => setPhotoFailed(true)} />}
      <LinearGradient colors={['rgba(2, 2, 5, 0.22)', 'rgba(2, 2, 5, 0.08)', 'rgba(2, 2, 5, 0.72)', SLColors.canvas]}
        locations={[0, 0.27, 0.56, 0.86]} style={StyleSheet.absoluteFill} />
    </View>}
    <SafeAreaView key={fontScale} style={styles.safeArea}>
      <View style={styles.header}>
        {choosing ? <Image accessible accessibilityLabel="Strength Ledger" source={require('../../assets/images/16:9.png')} resizeMode="contain" style={styles.logo} />
          : <Pressable accessibilityRole="button" accessibilityLabel="Choose another path" onPress={onBack} style={styles.back}><Ionicons accessible={false} name="arrow-back" size={20} color={SLColors.textSecondary} /><Text style={styles.headerText}>Your path</Text></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel="Sign in" onPress={onSignIn} style={styles.signIn}><Text style={styles.headerText}>Sign in</Text></Pressable>
      </View>
      {choosing ? <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.choiceContent}>
        <View style={{ minHeight: Math.min(260, height * 0.23) }} />
        <View style={styles.choiceBody}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.35} style={styles.welcomeTitle}>BUILT FOR{'\n'}THE WORK.</Text>
          <Text style={styles.choiceLabel}>CHOOSE YOUR PATH</Text>
          <View style={styles.choices}>
            {roles.map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={SIGNUP_PATHS[value].label}
              accessibilityHint={`Explore Strength Ledger for ${SIGNUP_PATHS[value].label}`} onPress={() => onSelectRole(value)}
              style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}>
              <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>{SIGNUP_PATHS[value].label}</Text><Text style={styles.choiceDescription}>{roleDescriptions[value]}</Text></View>
              <Ionicons accessible={false} name="arrow-forward" color={SLColors.textSecondary} size={22} />
            </Pressable>)}
          </View>
        </View>
      </ScrollView> : <>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.previewContent}>
          <Text style={styles.pathLabel}>{path.label}</Text>
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={styles.previewTitle}>{path.headline}</Text>
          <Text style={styles.description}>{path.description}</Text>
          <ScreenshotPreview key={role} role={role} />
        </ScrollView>
        <View style={styles.footer}>
          <Text style={styles.requirement}>{path.previewRequirement}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Continue as ${path.label}`} onPress={onContinue} style={({ pressed }) => [styles.continue, pressed && styles.pressed]}>
            <Text style={styles.continueLabel}>Continue</Text><Ionicons accessible={false} name="arrow-forward" size={21} color={SLColors.textInverted} />
          </Pressable>
        </View>
      </>}
    </SafeAreaView>
  </View>;
}

function ScreenshotPreview({ role }: { role: SignupRole }) {
  const path = SIGNUP_PATHS[role];
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const { width, height } = useWindowDimensions();
  const frameWidth = Math.min(width - 48, 472);
  const capture = path.captures[active];
  const source = educationImage(capture.name);
  const dimensions = Image.resolveAssetSource(source);
  const fullHeight = frameWidth * dimensions.height / dimensions.width;
  const previewHeight = Math.min(400, Math.max(240, height * 0.43));
  return <View style={styles.preview}>
    <View style={styles.previewFrame}>
      <View style={[styles.capture, { height: previewHeight }]}>
        {failed[capture.name] ? <View accessibilityRole="text" style={styles.fallback}>
          <Text style={styles.fallbackTitle}>{capture.label}</Text><Text style={styles.description}>A preview is unavailable. You can still continue with setup.</Text>
        </View> : <Image accessible accessibilityRole="image" accessibilityLabel={`${capture.label}. Actual app screenshot with example data.`} source={source} resizeMode="cover"
          onError={() => setFailed(current => ({ ...current, [capture.name]: true }))}
          style={{ position: 'absolute', width: frameWidth, height: fullHeight, top: -fullHeight * capture.focus, alignSelf: 'center' }} />}
        <LinearGradient pointerEvents="none" colors={['transparent', SLColors.canvas]} locations={[0.92, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.captureCaption}>
        <Text style={styles.captureTitle}>{capture.label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Next app preview. ${active + 1} of ${path.captures.length}`} onPress={() => setActive(value => (value + 1) % path.captures.length)} style={styles.nextPreview}>
          <Text style={styles.previewCount}>{active + 1}/{path.captures.length}</Text><Ionicons accessible={false} name="arrow-forward" size={20} color={SLColors.textSecondary} />
        </Pressable>
      </View>
    </View>
    <Text style={styles.exampleLabel}>App preview · Example data</Text>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SLColors.canvas },
  safeArea: { flex: 1 },
  gymPhoto: { position: 'absolute', top: 0, width: '100%' },
  header: { width: '100%', maxWidth: 520, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 26, paddingTop: 4, paddingBottom: 10 },
  logo: { width: 154, height: 38 },
  headerText: { color: SLColors.textSecondary, fontSize: 14, fontFamily: SLFontFamilies.sansSemiBold },
  signIn: { minHeight: 44, minWidth: 68, alignItems: 'flex-end', justifyContent: 'center' },
  back: { minHeight: 44, flexDirection: 'row', gap: 10, alignItems: 'center', paddingRight: 14 },
  choiceContent: { flexGrow: 1, justifyContent: 'flex-end', width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 26, paddingBottom: 20 },
  choiceBody: { width: '100%' },
  welcomeTitle: { color: SLColors.textStrong, fontSize: 47, lineHeight: 49, letterSpacing: -0.8, fontFamily: SLFontFamilies.sansBold, marginBottom: 26 },
  choiceLabel: { color: SLColors.textSecondary, fontSize: 10, letterSpacing: 1.7, fontFamily: SLFontFamilies.sansSemiBold, marginBottom: 12 },
  choices: { gap: 8 },
  choice: { minHeight: 76, paddingVertical: 13, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStrong, backgroundColor: 'rgba(8, 8, 12, 0.82)' },
  choicePressed: { backgroundColor: SLColors.backgroundRaised, borderColor: SLColors.textMuted },
  choiceCopy: { flex: 1, gap: 4 },
  choiceTitle: { color: SLColors.textStrong, fontSize: 18, fontFamily: SLFontFamilies.sansSemiBold },
  choiceDescription: { color: SLColors.textSecondary, fontSize: 13, lineHeight: 18, fontFamily: SLFontFamilies.sans },
  previewContent: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 18 },
  pathLabel: { color: SLColors.textMuted, fontSize: 12, fontFamily: SLFontFamilies.sansSemiBold, marginBottom: 9 },
  previewTitle: { color: SLColors.textStrong, fontSize: 29, lineHeight: 33, letterSpacing: -0.5, fontFamily: SLFontFamilies.sansSemiBold },
  description: { color: SLColors.textSecondary, fontSize: 14, lineHeight: 21, fontFamily: SLFontFamilies.sans, marginTop: 10 },
  preview: { marginTop: 24 },
  previewFrame: { borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStrong, borderRadius: 13, overflow: 'hidden' },
  capture: { overflow: 'hidden', backgroundColor: SLColors.canvas },
  captureCaption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SLColors.canvasRaised, paddingLeft: 16, paddingRight: 4 },
  captureTitle: { flex: 1, color: SLColors.textStrong, fontSize: 13, fontFamily: SLFontFamilies.sansSemiBold, paddingVertical: 12 },
  nextPreview: { minWidth: 72, minHeight: 48, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  previewCount: { color: SLColors.textMuted, fontSize: 10, fontFamily: SLFontFamilies.sans },
  exampleLabel: { marginTop: 10, fontSize: 10, color: SLColors.textMuted, fontFamily: SLFontFamilies.sans },
  requirement: { color: SLColors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 12, textAlign: 'center', fontFamily: SLFontFamilies.sans },
  footer: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, backgroundColor: SLColors.canvas },
  continue: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 16, borderRadius: 10, backgroundColor: SLColors.textStrong },
  continueLabel: { flexShrink: 1, textAlign: 'center', color: SLColors.textInverted, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 16 },
  pressed: { opacity: 0.76 },
  fallback: { flex: 1, justifyContent: 'center', padding: 24 },
  fallbackTitle: { fontFamily: SLFontFamilies.sansSemiBold, color: SLColors.textStrong, fontSize: 20 },
});
