import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThreadScreen } from '@/app/(tabs)/messages/[threadId]';
import { COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import { Text } from '@/components/ui/sl-text';
import { SLFontFamilies, SLLayout, SLRadius } from '@/constants/theme';

import { useCoachAthleteWorkspace } from './CoachAthleteWorkspaceContext';

export function CoachAthleteMessages() {
  const router = useRouter();
  const workspace = useCoachAthleteWorkspace();
  const [resolving, setResolving] = useState(!workspace.messageThreadId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (workspace.messageThreadId) {
      setResolving(false);
      setError(null);
      return () => { active = false; };
    }
    setResolving(true);
    void workspace.ensureMessageThread().then((threadId) => {
      if (!active) return;
      if (!threadId) setError('The secure athlete conversation could not be resolved.');
      setResolving(false);
    });
    return () => { active = false; };
  }, [workspace.ensureMessageThread, workspace.messageThreadId, workspace.subjectKey]);

  if (!workspace.bootstrap) return null;
  if (resolving) return <View style={styles.state}><ActivityIndicator color={COACH_V2.violetBright} size="large" /><Text style={styles.stateTitle}>Opening secure conversation</Text><Text style={styles.stateBody}>Resolving this relationship’s message thread.</Text></View>;
  if (error || !workspace.messageThreadId) return (
    <View style={styles.state}>
      <View style={styles.errorIcon}><Ionicons color={COACH_V2.magenta} name="warning-outline" size={26} /></View>
      <Text style={styles.stateTitle}>Conversation unavailable</Text>
      <Text style={styles.stateBody}>{error || 'The secure thread could not be opened.'}</Text>
      <Pressable onPress={() => { setError(null); setResolving(true); void workspace.ensureMessageThread().then((threadId) => { if (!threadId) setError('The secure athlete conversation could not be resolved.'); setResolving(false); }); }} style={styles.retry}><Text style={styles.retryText}>Try Again</Text></Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.intro}><Text style={styles.kicker}>ATHLETE CONVERSATION</Text><Text style={styles.title}>Messages</Text></View>
      <ThreadScreen
        embedded
        forcedThreadId={workspace.messageThreadId}
        initialDraft={workspace.messageDraft}
        onBackOverride={() => router.replace(`/(tabs)/coach-athlete/${workspace.athleteId}` as any)}
        onDraftChange={workspace.setMessageDraft}
        workspaceAthleteId={workspace.athleteId}
        workspaceSubjectKey={workspace.subjectKey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: 88 },
  intro: { paddingHorizontal: SLLayout.screenGutter, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COACH_V2.border },
  kicker: { color: COACH_V2.violetBright, fontSize: 11, letterSpacing: 1.5 },
  title: { color: COACH_V2.text, fontFamily: SLFontFamilies.display, fontSize: 32, marginTop: 5 },
  state: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: SLLayout.screenGutter },
  stateTitle: { color: COACH_V2.text, fontSize: 20, fontWeight: '800', marginTop: 15, textAlign: 'center' },
  stateBody: { color: COACH_V2.muted, fontSize: 14, lineHeight: 20, marginTop: 6, maxWidth: 320, textAlign: 'center' },
  errorIcon: { alignItems: 'center', backgroundColor: 'rgba(255,71,103,0.12)', borderRadius: 22, height: 48, justifyContent: 'center', width: 48 },
  retry: { backgroundColor: COACH_V2.violet, borderRadius: SLRadius.md, marginTop: 18, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
