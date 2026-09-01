import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { SLButton } from '@/components/ui/sl-button';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLShadows, SLSpacing } from '@/constants/theme';

type SLConfirmationModalProps = {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmTone?: 'primary' | 'danger';
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => unknown | Promise<unknown>;
  testID?: string;
};

/** Canonical OLED confirmation surface with explicit semantic foregrounds. */
export function SLConfirmationModal({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmTone = 'danger',
  loading = false,
  onCancel,
  onConfirm,
  testID,
}: SLConfirmationModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.stage} testID={testID}>
        <View pointerEvents="none" style={styles.backdrop} />
        <View accessibilityViewIsModal style={styles.card}>
          <Text typographyRole="modalTitle" style={styles.title}>{title}</Text>
          {body ? <Text typographyRole="modalBody" style={styles.body}>{body}</Text> : null}
          <View style={styles.actions}>
            <SLButton
              disabled={loading}
              label={cancelLabel}
              onPress={onCancel}
              style={styles.action}
              variant="secondary"
            />
            <SLButton
              label={confirmLabel}
              loading={loading}
              onPress={onConfirm}
              style={styles.action}
              variant={confirmTone}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SLSpacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SLColors.scrim,
  },
  card: {
    backgroundColor: SLColors.canvasRaised,
    borderColor: SLColors.borderStrong,
    borderRadius: SLRadius.radiusSheet,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SLSpacing.xl,
    ...SLShadows.shadowSheet,
  },
  title: {
    color: SLColors.textPrimary,
    textAlign: 'center',
  },
  body: {
    color: SLColors.textSecondary,
    marginTop: SLSpacing.sm,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: SLSpacing.sm,
    marginTop: SLSpacing.xl,
  },
  action: {
    flex: 1,
  },
});
