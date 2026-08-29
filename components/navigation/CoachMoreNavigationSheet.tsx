import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { StrengthLedgerBottomSheet, type StrengthLedgerBottomSheetHandle } from '@/components/sheets/StrengthLedgerBottomSheet';
import { SLMotionPressable } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies, SLLayout, SLMotion, SLRadius, SLSpacing } from '@/constants/theme';
import {
  COACH_MORE_ACCOUNT_DESTINATIONS,
  COACH_MORE_TOOL_DESTINATIONS,
  coachMoreDestinationTarget,
  type CoachMoreDestination,
  type CoachMoreLaunchContext,
} from '@/lib/coach-more-navigation';

type CoachMoreNavigationContextValue = Readonly<{
  isOpen: boolean;
  open: (context?: CoachMoreLaunchContext) => void;
  close: () => void;
}>;

const CoachMoreNavigationContext = createContext<CoachMoreNavigationContextValue>({
  isOpen: false,
  open: () => undefined,
  close: () => undefined,
});

const ACCENT_COLORS = {
  violet: SLColors.review,
  cyan: SLColors.accentCyanMuted,
  green: SLColors.success,
  gold: SLColors.warning,
  magenta: SLColors.accentMagenta,
  muted: SLColors.textSecondary,
} as const;

export function useCoachMoreNavigation() {
  return useContext(CoachMoreNavigationContext);
}

export function CoachMoreNavigationProvider({ children, enabled }: Readonly<{ children: React.ReactNode; enabled: boolean }>) {
  const router = useRouter();
  const sheetRef = useRef<StrengthLedgerBottomSheetHandle>(null);
  const pendingDestinationRef = useRef<CoachMoreDestination | null>(null);
  const launchContextRef = useRef<CoachMoreLaunchContext | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((context?: CoachMoreLaunchContext) => {
    if (!enabled) return;
    pendingDestinationRef.current = null;
    launchContextRef.current = context;
    setIsOpen(true);
  }, [enabled]);

  const close = useCallback(() => {
    pendingDestinationRef.current = null;
    sheetRef.current?.dismiss();
  }, []);

  useEffect(() => {
    if (!enabled && isOpen) {
      pendingDestinationRef.current = null;
      setIsOpen(false);
    }
  }, [enabled, isOpen]);

  const handleDismiss = useCallback(() => {
    const destination = pendingDestinationRef.current;
    const context = launchContextRef.current;
    pendingDestinationRef.current = null;
    launchContextRef.current = undefined;
    setIsOpen(false);
    if (!destination) return;

    const target = coachMoreDestinationTarget(destination, context);
    setTimeout(() => {
      if (destination.navigation === 'navigate') router.navigate(target as any);
      else router.push(target as any);
    }, 0);
  }, [router]);

  const selectDestination = useCallback((destination: CoachMoreDestination) => {
    if (pendingDestinationRef.current) return;
    void Haptics.selectionAsync().catch(() => undefined);
    pendingDestinationRef.current = destination;
    sheetRef.current?.dismiss();
  }, []);

  const value = useMemo(() => ({ isOpen, open, close }), [close, isOpen, open]);

  return (
    <CoachMoreNavigationContext.Provider value={value}>
      {children}
      <StrengthLedgerBottomSheet
        accessibilityLabel="More navigation"
        heightFraction={0.62}
        motionPreset="deliberate"
        onDismiss={handleDismiss}
        ref={sheetRef}
        testID="coach-more-navigation-sheet"
        visible={isOpen}
      >
        <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={styles.title}>More</Text>
          <DestinationSection destinations={COACH_MORE_TOOL_DESTINATIONS} onSelect={selectDestination} title="Coach Tools" />
          <DestinationSection destinations={COACH_MORE_ACCOUNT_DESTINATIONS} onSelect={selectDestination} title="Account" />
        </ScrollView>
      </StrengthLedgerBottomSheet>
    </CoachMoreNavigationContext.Provider>
  );
}

function DestinationSection({ destinations, onSelect, title }: Readonly<{
  destinations: readonly CoachMoreDestination[];
  onSelect: (destination: CoachMoreDestination) => void;
  title: string;
}>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.grid}>
        {destinations.map((destination) => {
          const accent = ACCENT_COLORS[destination.accent];
          return (
            <SLMotionPressable
              accessibilityHint={`Open ${destination.label}`}
              accessibilityLabel={destination.label}
              accessibilityRole="button"
              key={destination.key}
              onPress={() => onSelect(destination)}
              pressScale={SLMotion.prominentPressScale}
              pressedOpacity={0.78}
              style={styles.tile}
            >
              <View style={[styles.icon, { backgroundColor: `${accent}18`, borderColor: `${accent}55` }]}>
                <Ionicons color={accent} name={destination.icon as keyof typeof Ionicons.glyphMap} size={22} />
              </View>
              <Text numberOfLines={1} style={styles.label}>{destination.label}</Text>
              <Text numberOfLines={1} style={styles.detail}>{destination.detail}</Text>
            </SLMotionPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: SLSpacing.md, paddingHorizontal: SLLayout.screenGutter, paddingTop: 2, paddingBottom: SLSpacing.sm },
  title: { color: SLColors.textStrong, fontFamily: SLFontFamilies.display, fontSize: 23, lineHeight: 28 },
  section: { gap: 8 },
  sectionTitle: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 11, letterSpacing: 1.05, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.8%', minHeight: 96, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: SLRadius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceRaised },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, marginBottom: 7 },
  label: { color: SLColors.textStrong, fontFamily: SLFontFamilies.bodyBold, fontSize: 14, lineHeight: 18 },
  detail: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 10, lineHeight: 14, marginTop: 2 },
});
