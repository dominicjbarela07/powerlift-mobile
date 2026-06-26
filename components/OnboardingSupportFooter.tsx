import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { SLColors, SLFontFamilies, SLRadius, SLSpacing } from '@/constants/theme';

const SUPPORT_EMAIL = 'socials@strengthledger.fit';
const INSTAGRAM_URL = 'https://www.instagram.com/strength.ledger/';

export function OnboardingSupportFooter() {
  const openInstagram = () => Linking.openURL(INSTAGRAM_URL);
  const openEmail = () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`);

  return (
    <View style={styles.supportBox} accessibilityLabel="Onboarding support">
      <Text style={styles.supportTitle}>Need help getting started?</Text>
      <Text style={styles.supportBody}>
        If you run into any issues during onboarding, feel free to reach out.
      </Text>
      <View style={styles.linkRow}>
        <Pressable hitSlop={8} onPress={openInstagram}>
          <Text style={styles.supportLink}>Instagram: @strength.ledger</Text>
        </Pressable>
        <Pressable hitSlop={8} onPress={openEmail}>
          <Text style={styles.supportLink}>Email: {SUPPORT_EMAIL}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  supportBox: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(216, 183, 106, 0.18)',
    borderRadius: SLRadius.lg,
    backgroundColor: 'rgba(8, 9, 10, 0.58)',
    paddingHorizontal: SLSpacing.lg,
    paddingVertical: SLSpacing.md,
    gap: 5,
  },
  supportTitle: {
    color: SLColors.textStrong,
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 14,
    lineHeight: 19,
  },
  supportBody: {
    color: SLColors.textMuted,
    fontFamily: SLFontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 2,
  },
  supportLink: {
    color: '#E7D49D',
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 13,
    lineHeight: 18,
  },
});
