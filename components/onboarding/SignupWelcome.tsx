import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard/KeyboardSurface';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies } from '@/constants/theme';
import { SIGNUP_PATHS, type SignupRole } from '@/lib/signup-paths';

type Props = {
  onSelectRole: (role: SignupRole) => void;
  onSignIn: () => void;
};
const roles: SignupRole[] = ['athlete', 'coach', 'self_coach'];
const roleDescriptions = { athlete: 'Train with a coach', coach: 'Coach a team', self_coach: 'Run your own training' };

export function SignupWelcome({ onSelectRole, onSignIn }: Props) {
  const { fontScale, height, width } = useWindowDimensions();
  const [photoFailed, setPhotoFailed] = useState(false);
  return <View style={styles.screen} testID="signup-choose-path">
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {!photoFailed && <Image accessible={false} source={require('../../assets/images/onboarding/loaded-iron-welcome-v1.png')}
        resizeMode="contain" style={[styles.gymPhoto, { height: width * 1.5 }]} onError={() => setPhotoFailed(true)} />}
      <LinearGradient colors={['rgba(2, 2, 5, 0.22)', 'rgba(2, 2, 5, 0.08)', 'rgba(2, 2, 5, 0.72)', SLColors.canvas]}
        locations={[0, 0.27, 0.56, 0.86]} style={StyleSheet.absoluteFill} />
    </View>
    <SafeAreaView key={fontScale} style={styles.safeArea}>
      <View style={styles.header}>
        <Image accessible accessibilityLabel="Strength Ledger" source={require('../../assets/images/16:9.png')} resizeMode="contain" style={styles.logo} />
        <Pressable accessibilityRole="button" accessibilityLabel="Sign in" onPress={onSignIn} style={styles.signIn}><Text style={styles.headerText}>Sign in</Text></Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.choiceContent}>
        <View style={{ minHeight: Math.min(260, height * 0.23) }} />
        <View style={styles.choiceBody}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.35} style={styles.welcomeTitle}>BUILT FOR{'\n'}THE WORK.</Text>
          <Text style={styles.choiceLabel}>CHOOSE YOUR PATH</Text>
          <View style={styles.choices}>
            {roles.map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={SIGNUP_PATHS[value].label}
              accessibilityHint={`Create an account as ${SIGNUP_PATHS[value].label}`} onPress={() => onSelectRole(value)}
              style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}>
              <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>{SIGNUP_PATHS[value].label}</Text><Text style={styles.choiceDescription}>{roleDescriptions[value]}</Text></View>
              <Ionicons accessible={false} name="arrow-forward" color={SLColors.textSecondary} size={22} />
            </Pressable>)}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
});
