import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { checkMobileBillingStatus } from '@/lib/api';
import { Text } from '@/components/ui/sl-text';
import { SLButton } from '@/components/ui/sl-button';
import { SLColors } from '@/constants/theme';

export default function BillingReturn() {
  const { authReady, user, refreshAccountState } = useAuth();
  const router = useRouter();
  const [waiting, setWaiting] = useState(true);
  useEffect(() => {
    if (!authReady) return;
    let live = true;
    void (async () => {
      try { if (user) await checkMobileBillingStatus(); } catch { /* setup screen provides recovery */ }
      try { if (user) await refreshAccountState(); } catch { /* retain current account */ }
      if (live) { setWaiting(false); router.replace(user ? '/' : '/login'); }
    })();
    return () => { live = false; };
  }, [authReady, user?.id, refreshAccountState, router]);
  return <View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 18, backgroundColor: SLColors.surfaceCanvas }}>
    {waiting && <ActivityIndicator color={SLColors.accentViolet} />}
    <Text style={{ color: SLColors.textStrong, fontSize: 24 }}>Checking your membership</Text>
    <Text style={{ color: SLColors.textMuted, lineHeight: 22 }}>Your account is saved. We will confirm your checkout with Stripe before opening your workspace.</Text>
    <SLButton label="Return to setup" variant="secondary" onPress={() => router.replace('/')} />
  </View>;
}
