import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { KeyboardModal as Modal, KeyboardScrollView as ScrollView } from '@/components/keyboard/KeyboardSurface';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/sl-text';
import { MobileEducationRolePreview, MobileEducationWelcomePreview } from '@/components/education/MobileEducationRolePreview';
import { AthleteEducationExperience } from '@/components/education/AthleteEducationOpening';
import { CoachEducationExperience } from '@/components/education/CoachEducationOpening';
import { SelfCoachEducationExperience } from '@/components/education/SelfCoachEducationOpening';
import { useAuth } from '@/context/AuthContext';
import { SLFontFamilies } from '@/constants/theme';
import {
  completeEducationIntroduction,
  dismissEducationHint,
  educationRoleForMode,
  freshMobileEducationState,
  hasMultipleEducationModes,
  markEducationLearned,
  mobileEducationStorageKey,
  resetEducationGuidance,
  restoreMobileEducationState,
  shouldOfferEducationHint,
  shouldPresentMobileIntroduction,
  shouldShowEducationMarker,
  visitEducationDestination,
  type EducationDestination,
  type EducationFeature,
  type EducationRole,
  type MobileEducationState,
} from '@/lib/mobile-education';

type MobileEducationValue = {
  role: EducationRole | null;
  state: MobileEducationState;
  activeHint: EducationFeature | null;
  markLearned: (feature: EducationFeature) => void;
  dismissHint: (feature: EducationFeature) => void;
  requestHint: (feature: EducationFeature) => void;
  releaseHint: (feature: EducationFeature) => void;
  markVisited: (destination: EducationDestination) => void;
  showNew: (destination: EducationDestination) => boolean;
  setGuidanceEnabled: (enabled: boolean) => void;
  resetGuidance: () => void;
  replayIntroduction: () => void;
  finishIntroduction: (goToToday?: boolean) => void;
};

const MobileEducationContext = createContext<MobileEducationValue | null>(null);

const ROLE_CONTENT = {
  individual: {
    name: 'Self-Coach', title: 'Your training\ncomes first.',
    action: 'Go to Today',
  },
  coach: {
    name: 'Team Coach', title: 'Coach your athletes\nfrom your phone.',
    action: 'Go to Coach Home',
  },
  athlete: {
    name: 'Athlete', title: 'Your Session.\nYour record.',
    action: 'Go to Today',
  },
} as const;

export function useMobileEducation(): MobileEducationValue {
  const context = useContext(MobileEducationContext);
  if (!context) throw new Error('MobileEducationProvider is required');
  return context;
}

export function MobileEducationProvider({ children }: { children: React.ReactNode }) {
  const { user, authReady, activeMobileMode, refreshAccountState } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const role = educationRoleForMode(user, activeMobileMode);
  const storageKey = user ? mobileEducationStorageKey(user) : null;
  const [state, setState] = useState<MobileEducationState>(freshMobileEducationState);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [introStage, setIntroStage] = useState<'welcome' | 'role' | null>(null);
  const [journeyStep, setJourneyStep] = useState(-1);
  const [replaying, setReplaying] = useState(false);
  const [activeHint, setActiveHint] = useState<EducationFeature | null>(null);
  const activeHintRef = useRef<EducationFeature | null>(null);
  const identityRefreshRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) { identityRefreshRef.current = null; return; }
    if (!authReady || storageKey || identityRefreshRef.current === user.email) return;
    identityRefreshRef.current = user.email;
    void refreshAccountState().catch(() => undefined);
  }, [authReady, refreshAccountState, storageKey, user]);

  useEffect(() => {
    let cancelled = false;
    setLoadedKey(null);
    setIntroStage(null);
    setJourneyStep(-1);
    setActiveHint(null);
    activeHintRef.current = null;
    setState(freshMobileEducationState());
    if (!storageKey) return () => { cancelled = true; };
    AsyncStorage.getItem(storageKey).then((raw) => {
      if (cancelled) return;
      setState(restoreMobileEducationState(raw));
      setLoadedKey(storageKey);
    }).catch(() => {
      if (cancelled) return;
      setState(freshMobileEducationState());
      setLoadedKey(storageKey);
    });
    return () => { cancelled = true; };
  }, [storageKey]);

  useEffect(() => {
    if (storageKey && loadedKey === storageKey) void AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => undefined);
  }, [loadedKey, state, storageKey]);

  const onReadyHome = pathname.includes('/athlete-dashboard') || pathname.includes('/coach-dashboard');
  useEffect(() => {
    if (!introStage && shouldPresentMobileIntroduction({ authReady, role, storageKey, loadedKey, onReadyHome, state })) {
      setJourneyStep(-1);
      setIntroStage('welcome');
    }
  }, [authReady, introStage, loadedKey, onReadyHome, role, state.introductionComplete, storageKey]);

  const finishIntroduction = useCallback((goToToday = false) => {
    setState(completeEducationIntroduction);
    setIntroStage(null);
    setReplaying(false);
    if (goToToday) router.replace(role === 'coach' ? '/(tabs)/coach-dashboard' : '/(tabs)/athlete-dashboard');
  }, [role, router]);
  const markLearned = useCallback((feature: EducationFeature) => {
    setState((current) => markEducationLearned(current, feature));
    if (activeHintRef.current === feature) {
      activeHintRef.current = null;
      setActiveHint(null);
    }
  }, []);
  const dismissHint = useCallback((feature: EducationFeature) => {
    setState((current) => dismissEducationHint(current, feature));
    if (activeHintRef.current === feature) {
      activeHintRef.current = null;
      setActiveHint(null);
    }
  }, []);
  const requestHint = useCallback((feature: EducationFeature) => {
    if (introStage || activeHintRef.current || !shouldOfferEducationHint(state, role, feature)) return;
    activeHintRef.current = feature;
    setActiveHint(feature);
  }, [introStage, role, state]);
  const releaseHint = useCallback((feature: EducationFeature) => {
    if (activeHintRef.current !== feature) return;
    activeHintRef.current = null;
    setActiveHint(null);
  }, []);
  const markVisited = useCallback((destination: EducationDestination) => {
    setState((current) => visitEducationDestination(current, destination));
  }, []);
  const showNew = useCallback((destination: EducationDestination) => shouldShowEducationMarker(state, role, destination), [role, state]);
  const setGuidanceEnabled = useCallback((enabled: boolean) => {
    setState((current) => ({ ...current, guidanceEnabled: enabled }));
    if (!enabled) { activeHintRef.current = null; setActiveHint(null); }
  }, []);
  const resetGuidance = useCallback(() => {
    activeHintRef.current = null;
    setActiveHint(null);
    setState((current) => resetEducationGuidance(current));
  }, []);
  const replayIntroduction = useCallback(() => {
    activeHintRef.current = null;
    setActiveHint(null);
    setReplaying(true);
    setJourneyStep(-1);
    setIntroStage('welcome');
  }, []);

  const value = useMemo<MobileEducationValue>(() => ({
    role, state, activeHint, markLearned, dismissHint, requestHint, releaseHint,
    markVisited, showNew, setGuidanceEnabled, resetGuidance, replayIntroduction, finishIntroduction,
  }), [activeHint, dismissHint, finishIntroduction, markLearned, markVisited, releaseHint, replayIntroduction, requestHint, resetGuidance, role, setGuidanceEnabled, showNew, state]);
  const multipleModes = hasMultipleEducationModes(user);
  const content = role ? ROLE_CONTENT[role] : null;
  const athleteOpening = role === 'athlete' && !multipleModes;
  const coachOpening = role === 'coach' && !multipleModes;
  const selfCoachOpening = role === 'individual' && !multipleModes;

  return <MobileEducationContext.Provider value={value}>
    {children}
    <Modal animationType="fade" visible={!!introStage && !!role && loadedKey === storageKey} presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => finishIntroduction()}>
      {athleteOpening ? <AthleteEducationExperience
        step={journeyStep}
        onNext={() => {
          if (journeyStep === -1) { setJourneyStep(0); setIntroStage('role'); }
          else if (journeyStep < 2) setJourneyStep(journeyStep + 1);
          else finishIntroduction(true);
        }}
        onBack={() => {
          if (journeyStep <= 0) { setJourneyStep(-1); setIntroStage('welcome'); }
          else setJourneyStep(journeyStep - 1);
        }}
        onClose={() => finishIntroduction()}
        onGoToday={() => finishIntroduction(true)}
      /> : coachOpening ? <CoachEducationExperience
        step={journeyStep}
        onNext={() => {
          if (journeyStep === -1) { setJourneyStep(0); setIntroStage('role'); }
          else if (journeyStep < 2) setJourneyStep(journeyStep + 1);
          else finishIntroduction(true);
        }}
        onBack={() => {
          if (journeyStep <= 0) { setJourneyStep(-1); setIntroStage('welcome'); }
          else setJourneyStep(journeyStep - 1);
        }}
        onClose={() => finishIntroduction()}
        onGoCoachHome={() => finishIntroduction(true)}
      /> : selfCoachOpening ? <SelfCoachEducationExperience
        step={journeyStep}
        onNext={() => {
          if (journeyStep === -1) { setJourneyStep(0); setIntroStage('role'); }
          else if (journeyStep < 2) setJourneyStep(journeyStep + 1);
          else finishIntroduction(true);
        }}
        onBack={() => {
          if (journeyStep <= 0) { setJourneyStep(-1); setIntroStage('welcome'); }
          else setJourneyStep(journeyStep - 1);
        }}
        onClose={() => finishIntroduction()}
        onGoToday={() => finishIntroduction(true)}
      /> : <View style={styles.intro}>
        <LinearGradient colors={['#11091D', '#05030B', '#05030B']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFillObject} />
        <View style={[styles.mast, { paddingTop: Math.max(insets.top, 22) + 16 }]}>
          <Text style={styles.brand}>STRENGTH <Text style={styles.brandSmall}>LEDGER</Text></Text>
          <Pressable accessibilityLabel="Skip introduction" accessibilityRole="button" hitSlop={12} onPress={() => finishIntroduction()}><Ionicons color="#AAA3BA" name="close" size={25} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.introBody, introStage === 'welcome' ? styles.welcomeBody : styles.roleBody]} showsVerticalScrollIndicator={false}>
          {introStage === 'welcome' ? <>
            <View style={styles.welcomeLockup}>
              <Text style={styles.welcomeKicker}>INTRODUCING</Text>
              <Text style={styles.welcomeVersion}>3<Text style={styles.welcomeVersionDot}>.</Text>0</Text>
            </View>
            {role && <MobileEducationWelcomePreview multipleModes={multipleModes} role={role} />}
            <View style={styles.flexSpace} />
          </> : multipleModes ? <>
            <Text style={styles.kicker}>STRENGTH LEDGER 3.0 · COACH + OWN TRAINING</Text>
            <Text style={styles.roleTitle}>Coach and train{`\n`}in one account.</Text>
            {role && <MobileEducationRolePreview multipleModes role={role} />}
            <View style={styles.flexSpace} />
            <View style={styles.contextRow}><Text style={styles.contextLabel}>CURRENT MODE</Text><Text style={styles.contextValue}>{role === 'coach' ? 'Coach' : 'Your training'}</Text></View>
          </> : <>
            <Text style={styles.kicker}>STRENGTH LEDGER 3.0 · {content?.name.toUpperCase()}</Text>
            <Text style={styles.roleTitle}>{content?.title}</Text>
            {role && <MobileEducationRolePreview multipleModes={false} role={role} />}
            <View style={styles.flexSpace} />
          </>}
          <Pressable accessibilityRole="button" onPress={introStage === 'welcome' ? () => setIntroStage('role') : () => finishIntroduction()} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><Text style={styles.primaryActionText}>{introStage === 'welcome' ? 'Explore 3.0' : multipleModes ? `Continue in ${role === 'coach' ? 'Coach' : 'Your Training'}` : content?.action}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => finishIntroduction()} style={styles.skipAction}><Text style={styles.skipText}>{introStage === 'welcome' ? role === 'coach' ? 'Skip and enter Coach Home' : 'Skip and enter Today' : replaying ? 'Close overview' : 'Skip introduction'}</Text></Pressable>
        </ScrollView>
      </View>}
    </Modal>
  </MobileEducationContext.Provider>;
}

export function useEducationHint(feature: EducationFeature, eligible: boolean) {
  const education = useMobileEducation();
  const { requestHint, releaseHint } = education;
  useEffect(() => {
    if (eligible) requestHint(feature);
    return () => releaseHint(feature);
  }, [eligible, feature, releaseHint, requestHint]);
  return education.activeHint === feature && eligible;
}

export function EducationInlineHint({ feature, title }: { feature: EducationFeature; title: string }) {
  const { activeHint, dismissHint } = useMobileEducation();
  if (activeHint !== feature) return null;
  return <View style={styles.hint}>
    <Text style={styles.hintKicker}>NEW · {feature === 'active-session-edit' ? 'SESSION WORKSPACE' : feature === 'equipment-history' ? 'EQUIPMENT HISTORY' : feature === 'athlete-workspace' ? 'ATHLETE WORKSPACE' : 'MOVEMENT HISTORY'}</Text>
    <View style={styles.hintRow}><Text style={styles.hintTitle}>{title}</Text><Pressable accessibilityRole="button" onPress={() => dismissHint(feature)} hitSlop={10}><Text style={styles.hintAction}>Got it</Text></Pressable></View>
  </View>;
}

const styles = StyleSheet.create({
  intro: { flex: 1, backgroundColor: '#05030B' },
  mast: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 28, paddingBottom: 20 },
  brand: { color: '#F1E9FA', fontFamily: SLFontFamilies.display, fontSize: 14, letterSpacing: 1.3 },
  brandSmall: { color: '#A978E9', fontSize: 10 },
  introBody: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 100, paddingBottom: 30 },
  welcomeBody: { paddingTop: 5 },
  roleBody: { paddingTop: 45 },
  welcomeLockup: { paddingTop: 8 },
  welcomeKicker: { color: '#C391FA', fontFamily: SLFontFamilies.bodyBold, fontSize: 11, letterSpacing: 2.3 },
  welcomeVersion: { color: '#FCF7FF', fontFamily: SLFontFamilies.bodyBold, fontSize: 116, lineHeight: 124, letterSpacing: -7, marginLeft: -6, marginTop: -8 },
  welcomeVersionDot: { color: '#B565F8' },
  kicker: { color: '#BA86FA', fontFamily: SLFontFamilies.bodyBold, fontSize: 12, letterSpacing: 1.7, marginBottom: 14 },
  roleTitle: { color: '#F5EFFA', fontFamily: SLFontFamilies.bodyBold, fontSize: 36, lineHeight: 41, letterSpacing: -1.1 },
  flexSpace: { flexGrow: 1, minHeight: 32 },
  contextRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#514263', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  contextLabel: { color: '#8D829A', fontFamily: SLFontFamilies.bodyBold, fontSize: 11, letterSpacing: 1 },
  contextValue: { color: '#EEE5F6', fontFamily: SLFontFamilies.bodyBold, fontSize: 13 },
  primaryAction: { backgroundColor: '#9052DB', borderColor: '#BE88FD', borderWidth: 1, borderRadius: 19, minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: '#FFF9FF', fontFamily: SLFontFamilies.bodyBold, fontSize: 17 },
  skipAction: { alignItems: 'center', paddingTop: 19, paddingBottom: 9 },
  skipText: { color: '#9B90A8', fontFamily: SLFontFamilies.body, fontSize: 14 },
  pressed: { opacity: 0.75 },
  hint: { backgroundColor: '#160F22', borderColor: '#6E488D', borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, paddingVertical: 12, marginVertical: 10 },
  hintKicker: { color: '#B783F3', fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 1.2 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 7 },
  hintTitle: { color: '#F1E9F8', fontFamily: SLFontFamilies.bodyBold, fontSize: 15, lineHeight: 20, flex: 1 },
  hintAction: { color: '#C794FF', fontFamily: SLFontFamilies.bodyBold, fontSize: 13 },
});
