import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { uuid } from 'expo-modules-core';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLButton } from '@/components/ui/sl-button';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import { createSupportJournal, supportReceipt, validSupportEmail, type RecoveryStep } from '@/lib/recovery-support';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';

type Props = { step: RecoveryStep; errorCode?: string };
export function OnboardingSupport(props: Props) {
  const { user } = useAuth();
  const owner = String(user?.id ?? user?.user_id ?? 'guest');
  return <SupportForm key={`${owner}:${props.step}`} {...props} owner={owner} contactEmail={user?.email} />;
}

function SupportForm({ step, errorCode = 'unknown', owner, contactEmail }: Props & { owner: string; contactEmail?: string }) {
  const journal = useMemo(() => createSupportJournal(AsyncStorage, owner, step), [owner, step]);
  const [draft, setDraft] = useState(journal.snapshot());
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sending = useRef(false);
  const setup = ['signup', 'verify', 'checkout', 'confirm', 'invite', 'login'].includes(step);
  useEffect(() => {
    let mounted = true;
    void journal.ready.then(() => { if (mounted) { setDraft({ ...journal.snapshot() }); setReady(true); } });
    return () => { mounted = false; };
  }, [journal]);
  const edit = (email: string, details: string) => {
    setDraft(previous => ({ ...previous, email, details }));
    void journal.input(email, details);
  };
  const send = async () => {
    if (sending.current || !ready) return;
    sending.current = true;
    setBusy(true); setMessage('');
    let id: string | undefined;
    const accept = async (value: unknown) => {
      const receipt = supportReceipt(value);
      if (!receipt || receipt.request_id !== id) return false;
      await journal.accepted(receipt);
      setDraft({ ...journal.snapshot() });
      return true;
    };
    try {
      const payload = await journal.prepare({ email: contactEmail || draft.email, details: draft.details,
        error_code: errorCode, app_version: `${Constants.expoConfig?.version || 'DEV'} ${Platform.OS}` }, () => uuid.v4());
      id = payload.request_id;
      setDraft({ ...journal.snapshot() });
      const result = await fetchJson<unknown>('/onboarding/mobile-support', {
        method: 'POST', auth: owner !== 'guest', timeoutMs: 12000, body: JSON.stringify(payload),
      });
      if (!result.ok || !await accept(result.json)) throw new Error('Unconfirmed support request');
    } catch {
      try {
        const receipt = id && await fetchJson<unknown>(`/onboarding/support/${id}`, { auth: false, timeoutMs: 6000 });
        if (receipt && receipt.ok && await accept(receipt.json)) return;
      } catch { /* Retry the same request after an uncertain save. */ }
      setMessage(journal.isDurable()
        ? 'Save not confirmed. Your report is kept on this device. Retry when connected, or email support below.'
        : 'Save not confirmed. Keep this screen open and retry, or email support below.');
    } finally { sending.current = false; setBusy(false); }
  };
  const checkDelivery = async () => {
    if (busy || !draft.receipt) return;
    setBusy(true); setMessage('');
    try {
      const result = await fetchJson<unknown>(`/onboarding/support/${draft.receipt.request_id}`, { auth: false, timeoutMs: 6000 });
      const receipt = result.ok ? supportReceipt(result.json) : null;
      if (!receipt) throw new Error('Unconfirmed status');
      await journal.accepted(receipt);
      setDraft({ ...journal.snapshot() });
    } catch { setMessage('Your report is saved. We could not refresh the notification status.'); }
    finally { setBusy(false); }
  };
  const receipt = draft.receipt;
  const delivery = receipt?.notification_status === 'accepted' ? 'Support has been notified. We will reply by email.'
    : receipt?.notification_status === 'suppressed' ? 'Saved in DEV. External notifications are disabled here.'
    : 'Your report is saved. The support notification is waiting to send.';
  return <View style={s.panel}>
    <SLButton label={open ? 'Close help' : setup ? 'Need help with setup?' : 'Get help'} variant="ghost" onPress={() => setOpen(!open)} accessibilityState={{ expanded: open }} />
    {open && <View style={s.body}>
      <Text accessibilityRole="header" style={s.title}>{receipt ? 'Request saved' : setup ? 'Let us help you finish' : 'Help with this step'}</Text>
      {receipt ? <>
        <Text selectable style={s.reference}>{receipt.reference}</Text>
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.copy}>{delivery}</Text>
        {!['accepted', 'suppressed'].includes(receipt.notification_status) && <SLButton label="Check notification status" loading={busy} variant="secondary" onPress={checkDelivery} />}
        <SLButton label="Send another report" disabled={busy} variant="secondary" onPress={() => { void journal.another().then(value => { setDraft({ ...value }); setMessage(''); }); }} />
      </> : <>
        <Text style={s.copy}>Send this step, account status and app version to Strength Ledger support. Leave out passwords, verification codes and card details.</Text>
        {!contactEmail && <TextInput accessibilityLabel="Reply email" placeholder="Email for our reply" placeholderTextColor={SLColors.textMuted} style={s.input} value={draft.email} editable={ready && !draft.pending && !busy} onChangeText={email => edit(email, draft.details)} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />}
        <TextInput accessibilityLabel="What happened, optional" placeholder="What happened? (optional)" placeholderTextColor={SLColors.textMuted} style={[s.input, s.details]} multiline maxLength={1500} value={draft.details} editable={ready && !draft.pending && !busy} onChangeText={details => edit(draft.email, details)} />
        <SLButton label={draft.pending ? 'Retry sending report' : 'Ask Strength Ledger for help'} variant="secondary" loading={busy} disabled={!ready || busy || !validSupportEmail(contactEmail || draft.email)} onPress={send} />
        {draft.pending && !busy && <>
          <Text style={s.copy}>An earlier copy may already be saved. Retry it, or edit the details as a separate report.</Text>
          <SLButton label="Edit as a new report" variant="ghost" onPress={() => { void journal.revise().then(value => { setDraft({ ...value }); setMessage(''); }); }} />
        </>}
      </>}
      {!!message && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.copy}>{message}</Text>}
      <SLButton label="Email support directly" variant="ghost" onPress={() => { void Linking.openURL('mailto:socials@strengthledger.fit?subject=Strength%20Ledger%20help').catch(() => setMessage('Email socials@strengthledger.fit and tell us which step you are on.')); }} />
    </View>}
  </View>;
}
const s = StyleSheet.create({
  panel: { borderTopWidth: 1, borderColor: SLColors.borderDefault, marginTop: 12 },
  body: { gap: 12, paddingVertical: 12 },
  title: { color: SLColors.textStrong, fontSize: SLTypography.cardTitle.fontSize, fontWeight: '600' },
  reference: { color: SLColors.accentViolet, fontSize: 22, fontWeight: '600' },
  copy: { color: SLColors.textMuted, fontSize: SLTypography.caption.fontSize, lineHeight: 22 },
  input: { borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceInset, borderRadius: SLRadius.radiusControl, padding: 12, minHeight: 48, color: SLColors.textStrong },
  details: { minHeight: 88, textAlignVertical: 'top' },
});
