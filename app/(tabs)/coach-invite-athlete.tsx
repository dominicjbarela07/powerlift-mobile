import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';

import { SLScreen } from '@/components/ui';
import { SLColors, SLRadius, SLSpacing, SLTypography } from '@/constants/theme';
import { fetchJson } from '@/lib/api';

type InviteResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  reused_existing?: boolean;
  email_sent?: boolean;
  reason?: string;
  next_action?: string;
  invite?: {
    id?: number;
    athlete_email?: string;
    athlete_first?: string;
    athlete_last?: string;
    status?: string;
  };
};

const clean = (value: string) => value.trim();

export default function CoachInviteAthleteScreen() {
  const router = useRouter();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<InviteResponse | null>(null);

  const canSubmit = useMemo(() => {
    return clean(first).length > 0 && clean(last).length > 0 && clean(email).length > 0 && !submitting;
  }, [email, first, last, submitting]);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetchJson<InviteResponse>('/coach/mobile/invites', {
        method: 'POST',
        auth: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first: clean(first),
          last: clean(last),
          email: clean(email).toLowerCase(),
        }),
      });
      const json = response.json || {};
      if (!response.ok || !json.ok) {
        const suffix = json.next_action ? ` ${String(json.next_action).replace(/_/g, ' ')}.` : '';
        setError(`${json.error || `Invite failed. (${response.status})`}${suffix}`);
        return;
      }
      setSuccess(json);
    } catch (err) {
      console.warn('Invite athlete failed', err);
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inviteEmail = success?.invite?.athlete_email || clean(email).toLowerCase();
  const inviteName = [success?.invite?.athlete_first || clean(first), success?.invite?.athlete_last || clean(last)]
    .filter(Boolean)
    .join(' ');

  return (
    <SLScreen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={22} color={SLColors.textStrong} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Roster invite</Text>
              <Text typographyRole="pageTitle" numberOfLines={2} style={styles.title}>Invite your first athlete</Text>
              <Text typographyRole="supportingBody" style={styles.subtitle}>
                Send an invite through Strength Ledger so the athlete can accept, verify their email, and join your roster.
              </Text>
            </View>
          </View>

          {success ? (
            <View style={styles.successCard}>
              <View style={styles.successIcon}>
                <Ionicons name="mail-open-outline" size={26} color={SLColors.success} />
              </View>
              <Text style={styles.successTitle}>{success.reused_existing ? 'Invite already pending' : 'Invite sent'}</Text>
              <Text style={styles.successText}>
                {inviteName || 'This athlete'} has a pending invite at {inviteEmail}. They will appear on your roster after accepting.
              </Text>
              {!success.email_sent ? (
                <Text style={styles.warningText}>
                  The invite was saved, but email delivery was not confirmed. You can resend or follow up from roster tools.
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace({ pathname: '/(tabs)/coach-dashboard', params: { roster: '1' } } as any)}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>Back to Coach Home</Text>
                <Ionicons name="arrow-forward" size={18} color={SLColors.white} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.formCard}>
              <View style={styles.planCard}>
                <Text style={styles.planTitle}>What happens next</Text>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNumber}>1</Text>
                  <Text style={styles.stepText}>Strength Ledger sends the athlete a secure invite.</Text>
                </View>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNumber}>2</Text>
                  <Text style={styles.stepText}>They create or sign in to their own account and verify email ownership.</Text>
                </View>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNumber}>3</Text>
                  <Text style={styles.stepText}>After acceptance, the canonical relationship activates and your roster updates.</Text>
                </View>
              </View>

              <View style={styles.fields}>
                <LabeledInput
                  autoCapitalize="words"
                  label="First name"
                  onChangeText={setFirst}
                  placeholder="Alex"
                  value={first}
                />
                <LabeledInput
                  autoCapitalize="words"
                  label="Last name"
                  onChangeText={setLast}
                  placeholder="Rivera"
                  value={last}
                />
                <LabeledInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  label="Email"
                  onChangeText={setEmail}
                  placeholder="athlete@example.com"
                  value={email}
                />
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={18} color={SLColors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={!canSubmit}
                onPress={submit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (!canSubmit || submitting) && styles.disabledButton,
                  pressed && canSubmit && styles.pressed,
                ]}
              >
                {submitting ? <ActivityIndicator color={SLColors.white} /> : <Ionicons name="send-outline" size={18} color={SLColors.white} />}
                <Text style={styles.primaryButtonText}>{submitting ? 'Sending Invite...' : 'Send Invite'}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SLScreen>
  );
}

function LabeledInput({
  label,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  keyboardType?: 'default' | 'email-address';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={SLColors.textSubtle}
        selectionColor={SLColors.accentViolet}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: SLSpacing.lg,
    paddingTop: SLSpacing.lg,
    paddingBottom: 36,
  },
  header: {
    gap: SLSpacing.md,
    paddingHorizontal: SLSpacing.lg,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: SLColors.surface,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerCopy: {
    gap: SLSpacing.xs,
  },
  eyebrow: {
    color: SLColors.accentMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: SLColors.textStrong,
  },
  subtitle: {
    color: SLColors.textMuted,
  },
  formCard: {
    backgroundColor: SLColors.surface,
    borderColor: SLColors.borderSelected,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    gap: SLSpacing.lg,
    padding: SLSpacing.lg,
  },
  planCard: {
    backgroundColor: SLColors.surfaceInset,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    gap: SLSpacing.md,
    padding: SLSpacing.md,
  },
  planTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '800',
    letterSpacing: 0,
  },
  stepRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SLSpacing.sm,
  },
  stepNumber: {
    backgroundColor: SLColors.accentVioletSoft,
    borderRadius: SLRadius.pill,
    color: SLColors.accentMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    height: 22,
    lineHeight: 22,
    overflow: 'hidden',
    textAlign: 'center',
    width: 22,
  },
  stepText: {
    color: SLColors.text,
    flex: 1,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
  },
  fields: {
    gap: SLSpacing.md,
  },
  field: {
    gap: SLSpacing.xs,
  },
  label: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: SLColors.surfaceInset,
    borderColor: SLColors.borderSelected,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    minHeight: 52,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: 13,
  },
  errorBox: {
    alignItems: 'flex-start',
    backgroundColor: SLColors.dangerSoft,
    borderColor: SLColors.danger,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    padding: SLSpacing.md,
  },
  errorText: {
    color: SLColors.textStrong,
    flex: 1,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
  },
  warningText: {
    color: SLColors.warning,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 19,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: SLColors.accentViolet,
    borderRadius: SLRadius.sm,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: SLSpacing.lg,
  },
  primaryButtonText: {
    color: SLColors.white,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.995 }],
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: SLColors.surface,
    borderColor: SLColors.borderSelected,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    gap: SLSpacing.md,
    padding: SLSpacing.lg,
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: SLColors.accentSteelSoft,
    borderColor: SLColors.accentCyanMuted,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  successTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.title.fontSize,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  successText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 21,
    textAlign: 'center',
  },
});
