import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLShadows, SLSpacing, SLTypography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export function FinalSessionCompletionPresenter({
  visible,
  ending,
  onEndSession,
  onNotYet,
}: {
  visible: boolean;
  ending: boolean;
  onEndSession: () => void;
  onNotYet: () => void;
}) {
  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={ending ? undefined : onNotYet}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        accessibilityViewIsModal
        style={styles.backdrop}
        testID="final-session-completion-modal"
      >
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons color={SLColors.success} name="checkmark" size={30} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            All Sets Completed
          </Text>
          <Text style={styles.body}>
            You&apos;ve logged every set in this Session.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={ending}
            onPress={onEndSession}
            style={({ pressed }) => [
              styles.action,
              styles.primaryAction,
              pressed && !ending ? styles.pressed : null,
            ]}
            testID="final-session-end-session"
          >
            {ending ? <ActivityIndicator color={SLColors.textStrong} size="small" /> : null}
            <Text style={styles.primaryText}>{ending ? 'Opening…' : 'End Session'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={ending}
            onPress={onNotYet}
            style={({ pressed }) => [
              styles.action,
              styles.secondaryAction,
              pressed && !ending ? styles.pressed : null,
            ]}
            testID="final-session-not-yet"
          >
            <Text style={styles.secondaryText}>Not Yet</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SLSpacing.xl,
    paddingVertical: SLSpacing.xxl,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'stretch',
    padding: SLSpacing.xl,
    borderRadius: SLRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.48)',
    backgroundColor: '#0B0A12',
    ...SLShadows.shadowSheet,
  },
  icon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    marginBottom: SLSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.52)',
    backgroundColor: 'rgba(20,83,45,0.35)',
  },
  title: {
    color: SLColors.textStrong,
    fontSize: SLTypography.screenTitle.fontSize,
    lineHeight: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    marginTop: SLSpacing.sm,
    marginBottom: SLSpacing.xl,
    color: SLColors.textMuted,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 24,
    textAlign: 'center',
  },
  action: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SLSpacing.sm,
    borderRadius: SLRadius.md,
  },
  primaryAction: {
    backgroundColor: SLColors.accentViolet,
  },
  secondaryAction: {
    marginTop: SLSpacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    backgroundColor: 'rgba(30,27,45,0.78)',
  },
  primaryText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  secondaryText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
