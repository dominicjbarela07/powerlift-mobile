import React, { useRef, useState } from 'react';
import { Linking, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuid } from 'expo-modules-core';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLButton } from '@/components/ui/sl-button';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';

export function OnboardingSupport({ step }: { step: 'signup' | 'verify' | 'checkout' | 'confirm' | 'invite' | 'login' }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const identity = `${user?.id || 'guest'}:${step}`;
  const pending = useRef<Record<string, string>>({});
  const send = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    let id: string | undefined;
    try {
      const key = `sl-onboarding-support:${identity}`;
      id = pending.current[identity];
      if (!id) {
        try { id = (await AsyncStorage.getItem(key)) || undefined; } catch { /* retain in memory */ }
        id ||= uuid.v4();
        pending.current[identity] = id;
        try { await AsyncStorage.setItem(key, id); } catch { /* submission remains available */ }
      }
      const result = await fetchJson<any>('/onboarding/mobile-support', {
        method: 'POST', auth: !!user, timeoutMs: 20000,
        body: JSON.stringify({ request_id: id, step, email, details, error_code: 'unknown' }),
      });
      if (!result.ok || !result.json?.saved) throw new Error('not saved');
      setSaved(true);
      setMessage(`${result.json.reference} · ${result.json.notification_status === 'accepted' ? 'Your request has been sent to support.' : 'Your request is saved for support. Notification is queued.'} We will reply by email.`);
    } catch {
      // The save may have succeeded even when its response was lost.
      try {
        const receipt = id && await fetchJson<any>(`/onboarding/support/${id}`, { auth: false, timeoutMs: 8000 });
        if (receipt && receipt.ok && receipt.json?.saved) {
          setSaved(true); setMessage(`${receipt.json.reference} · Your request is saved. We will reply by email.`);
          return;
        }
      } catch { /* show a direct fallback below */ }
      setMessage('We could not confirm that your request was saved. Try again when connected, or email us below. Your setup progress is safe.');
    } finally { setBusy(false); }
  };
  return <View style={s.panel}>
    <SLButton label={open ? 'Close support' : 'Need help with setup?'} variant="ghost" onPress={() => setOpen(!open)} />
    {open && <View style={s.body}>
      <Text style={s.title}>Let us help you finish</Text>
      <Text style={s.copy}>Send the setup step and account status to Strength Ledger support. Never include a password, verification code or card details.</Text>
      {!saved && <>
        {!user && <TextInput accessibilityLabel="Reply email" placeholder="Email for our reply" placeholderTextColor={SLColors.textMuted} style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />}
        <TextInput accessibilityLabel="What happened (optional)" placeholder="What happened? (optional)" placeholderTextColor={SLColors.textMuted} style={[s.input, s.details]} multiline maxLength={1500} value={details} onChangeText={setDetails} />
        <SLButton label="Ask Strength Ledger for help" variant="secondary" loading={busy} disabled={busy || (!user && !email.includes('@'))} onPress={send} />
      </>}
      {!!message && <Text accessibilityLiveRegion="polite" style={s.copy}>{message}</Text>}
      <SLButton label="Email support directly" variant="ghost" onPress={() => { void Linking.openURL('mailto:socials@strengthledger.fit?subject=Strength%20Ledger%20setup%20help').catch(() => setMessage('Email socials@strengthledger.fit and tell us which setup step you are on.')); }} />
    </View>}
  </View>;
}
const s = StyleSheet.create({
  panel: { borderTopWidth: 1, borderColor: SLColors.borderDefault, marginTop: 12 },
  body: { gap: 12, paddingVertical: 12 },
  title: { color: SLColors.textStrong, fontSize: SLTypography.cardTitle.fontSize, fontWeight: '600' },
  copy: { color: SLColors.textMuted, fontSize: SLTypography.caption.fontSize, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceInset, borderRadius: SLRadius.radiusControl, padding: 12, minHeight: 48, color: SLColors.textStrong },
  details: { minHeight: 80, textAlignVertical: 'top' },
});
