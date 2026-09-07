import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MuscleMap } from '@/components/anatomy/MuscleMap';
import { Text } from '@/components/ui/sl-text';
import { SLColors } from '@/constants/theme';
import {
  ANATOMY_QA_PRESETS,
  GOVERNED_MUSCLE_IDS,
  MUSCLE_META,
  type AnatomyPresentationPreference,
  type AnatomyViewPreference,
  type GovernedMuscleId,
} from '@/lib/anatomy-system';
import type { AnatomyLaterality } from '@/components/anatomy/anatomy-mask-registry';

type MuscleRole = 'inactive' | 'primary' | 'secondary';

const PRESENTATIONS: readonly AnatomyPresentationPreference[] = ['automatic', 'masculine', 'feminine'];
const VIEWS: readonly AnatomyViewPreference[] = ['front', 'rear', 'dual'];
const LATERALITIES: readonly AnatomyLaterality[] = ['bilateral', 'left', 'right'];
const PRESET_ALIASES: Readonly<Record<string, keyof typeof ANATOMY_QA_PRESETS>> = {
  upper: 'Lats + Biceps',
  lower: 'Dense Lower Session',
  front_core: 'Abs + Obliques',
  rear_upper: 'Lats + Upper Back + Rear Delts',
  dense: 'Full Multi-Muscle Accessory Block',
  push: 'Chest + Front Delts + Triceps',
  pull: 'Dense Pull Session',
  accessory: 'Full Multi-Muscle Accessory Block',
};

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AnatomySystemLab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ presentation?: string; view?: string; preset?: string; scenario?: string }>();
  const requestedPresetName = PRESET_ALIASES[params.scenario || ''] || params.preset || 'Lats + Biceps';
  const initialPreset = ANATOMY_QA_PRESETS[requestedPresetName] || ANATOMY_QA_PRESETS['Lats + Biceps'];
  const [presentation, setPresentation] = useState<AnatomyPresentationPreference>(params.presentation === 'feminine' ? 'feminine' : params.presentation === 'automatic' ? 'automatic' : 'masculine');
  const [view, setView] = useState<AnatomyViewPreference>(params.view === 'front' || params.view === 'rear' ? params.view : 'dual');
  const [laterality, setLaterality] = useState<AnatomyLaterality>('bilateral');
  const [primary, setPrimary] = useState<GovernedMuscleId[]>([...initialPreset.primary]);
  const [secondary, setSecondary] = useState<GovernedMuscleId[]>([...initialPreset.secondary]);

  useEffect(() => {
    setPresentation(params.presentation === 'feminine' ? 'feminine' : params.presentation === 'automatic' ? 'automatic' : 'masculine');
    setView(params.view === 'front' || params.view === 'rear' ? params.view : 'dual');
    const presetName = PRESET_ALIASES[params.scenario || ''] || params.preset || '';
    const requestedPreset = ANATOMY_QA_PRESETS[presetName];
    if (requestedPreset) {
      setPrimary([...requestedPreset.primary]);
      setSecondary([...requestedPreset.secondary]);
    }
  }, [params.presentation, params.preset, params.scenario, params.view]);

  const roles = useMemo(() => {
    const roleByMuscle = new Map<GovernedMuscleId, MuscleRole>();
    for (const muscle of GOVERNED_MUSCLE_IDS) roleByMuscle.set(muscle, 'inactive');
    for (const muscle of secondary) roleByMuscle.set(muscle, 'secondary');
    for (const muscle of primary) roleByMuscle.set(muscle, 'primary');
    return roleByMuscle;
  }, [primary, secondary]);

  if (!__DEV__) return null;

  const applyPreset = (name: keyof typeof ANATOMY_QA_PRESETS) => {
    const preset = ANATOMY_QA_PRESETS[name];
    setPrimary([...preset.primary]);
    setSecondary([...preset.secondary]);
  };
  const cycleRole = (muscle: GovernedMuscleId) => {
    const role = roles.get(muscle) || 'inactive';
    setPrimary((values) => values.filter((value) => value !== muscle));
    setSecondary((values) => values.filter((value) => value !== muscle));
    if (role === 'inactive') setPrimary((values) => [...values, muscle]);
    if (role === 'primary') setSecondary((values) => [...values, muscle]);
  };

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]} style={styles.page} testID="dynamic-anatomy-qa-library">
      <View style={styles.titleRow}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <Ionicons color={SLColors.textPrimary} name="chevron-back" size={22} />
        </Pressable>
        <View style={styles.titleCopy}>
          <Text style={styles.kicker}>DEV · DYNAMIC ANATOMY</Text>
          <Text style={styles.title}>Interactive Lab</Text>
          <Text style={styles.subtitle}>Registered 418 × 941 master geometry · primary violet · secondary magenta</Text>
        </View>
      </View>

      <View style={styles.controlCard}>
        <Text style={styles.sectionTitle}>Presentation + View</Text>
        <View style={styles.controlRail}>
          {PRESENTATIONS.map((value) => (
            <Pressable key={value} onPress={() => setPresentation(value)} style={[styles.control, presentation === value && styles.controlActive]} testID={`anatomy-presentation-${value}`}>
              <Text style={[styles.controlText, presentation === value && styles.controlTextActive]}>{titleCase(value)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.controlRail}>
          {VIEWS.map((value) => (
            <Pressable key={value} onPress={() => setView(value)} style={[styles.control, view === value && styles.controlActive]} testID={`anatomy-view-${value}`}>
              <Text style={[styles.controlText, view === value && styles.controlTextActive]}>{titleCase(value)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.controlLabel}>Segment addressability</Text>
        <View style={styles.controlRail}>
          {LATERALITIES.map((value) => (
            <Pressable key={value} onPress={() => setLaterality(value)} style={[styles.control, laterality === value && styles.controlActive]} testID={`anatomy-laterality-${value}`}>
              <Text style={[styles.controlText, laterality === value && styles.controlTextActive]}>{titleCase(value)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.heroCard}>
        <MuscleMap anatomy={presentation} laterality={laterality} primary={primary} secondary={secondary} semanticLevel="session" size="hero" style={styles.heroMap} surface="portrait" view={view} testID="anatomy-qa-hero" />
        <Text style={styles.legend}>Violet · {primary.map((muscle) => MUSCLE_META[muscle].label).join(', ') || 'none'}</Text>
        <Text style={styles.legend}>Magenta · {secondary.map((muscle) => MUSCLE_META[muscle].label).join(', ') || 'none'}</Text>
      </View>

      <Text style={styles.sectionTitle}>Presets</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRail}>
        {Object.keys(ANATOMY_QA_PRESETS).map((name) => (
          <Pressable key={name} onPress={() => applyPreset(name)} style={styles.preset} testID={`anatomy-preset-${name.toLowerCase().replaceAll(' ', '-')}`}>
            <Text style={styles.presetText}>{name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Muscle QA</Text>
      <Text style={styles.help}>Tap a muscle to cycle inactive → primary → secondary.</Text>
      <View style={styles.muscleGrid}>
        {GOVERNED_MUSCLE_IDS.map((muscle) => {
          const role = roles.get(muscle) || 'inactive';
          return (
            <Pressable key={muscle} onPress={() => cycleRole(muscle)} style={[styles.muscleControl, role === 'primary' && styles.primary, role === 'secondary' && styles.secondary]} testID={`anatomy-muscle-${muscle}`}>
              <Text style={styles.muscleText}>{MUSCLE_META[muscle].label}</Text>
              <Text style={styles.roleText}>{role}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Size Tests</Text>
      <View style={styles.sizeCard}>
        <View style={styles.sizeCell}><MuscleMap anatomy={presentation} laterality={laterality} primary={primary} secondary={secondary} size="thumbnail" view={view} /><Text style={styles.sizeLabel}>76 thumbnail</Text></View>
        <View style={styles.sizeCell}><MuscleMap anatomy={presentation} laterality={laterality} primary={primary} secondary={secondary} size="card" view={view} /><Text style={styles.sizeLabel}>156 × 184 card</Text></View>
        <View style={styles.sizeCellWide}><MuscleMap anatomy={presentation} laterality={laterality} primary={primary} secondary={secondary} size="hero" style={styles.compactHero} surface="wide" view={view} /><Text style={styles.sizeLabel}>responsive hero</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Platform Previews</Text>
      <View style={styles.previewGrid}>
        <View style={styles.squarePreview}><MuscleMap anatomy={presentation} laterality={laterality} primary={primary} secondary={secondary} size="thumbnail" style={styles.fill} surface="square" view={view} /></View>
        <View style={styles.widePreview}><MuscleMap anatomy={presentation} laterality={laterality} primary={primary} secondary={secondary} size="card" style={styles.fill} surface="wide" view={view} /></View>
        <View style={styles.portraitPreview}><MuscleMap anatomy={presentation} laterality={laterality} primary={primary} secondary={secondary} size="card" style={styles.fill} surface="portrait" view={view} /></View>
      </View>
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#020306' },
  content: { gap: 14, paddingHorizontal: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#343A47', backgroundColor: '#0B0E14' },
  titleCopy: { flex: 1, gap: 3 },
  kicker: { color: '#A35BFF', fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: '#F4F0F8', fontSize: 25, lineHeight: 30, fontWeight: '800' },
  subtitle: { color: '#9298A5', fontSize: 11.5, lineHeight: 16 },
  sectionTitle: { color: '#D2A8FF', fontSize: 13, lineHeight: 18, fontWeight: '800', letterSpacing: 0.65 },
  controlCard: { gap: 9, padding: 12, borderRadius: 15, borderWidth: 1, borderColor: '#343A47', backgroundColor: '#090C12' },
  controlRail: { flexDirection: 'row', gap: 7 },
  control: { flex: 1, minHeight: 37, alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: '#3B414E', backgroundColor: '#0E1219' },
  controlActive: { borderColor: '#A35BFF', backgroundColor: '#492079' },
  controlText: { color: '#A8AFBB', fontSize: 11.5, fontWeight: '700' },
  controlTextActive: { color: '#FFFFFF' },
  controlLabel: { color: '#858C99', fontSize: 10.5, lineHeight: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.45 },
  heroCard: { alignItems: 'center', gap: 4, padding: 10, borderRadius: 17, borderWidth: 1, borderColor: '#57366F', backgroundColor: '#06070A' },
  heroMap: { width: '100%', height: 370 },
  legend: { alignSelf: 'stretch', color: '#B6BBC5', fontSize: 10.5, lineHeight: 15 },
  presetRail: { gap: 7, paddingRight: 14 },
  preset: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 17, borderWidth: 1, borderColor: '#54316D', backgroundColor: '#100B17' },
  presetText: { color: '#D9C2F4', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  help: { marginTop: -10, color: '#858C99', fontSize: 10.5, lineHeight: 15 },
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  muscleControl: { width: '48%', minHeight: 48, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 11, borderWidth: 1, borderColor: '#313642', backgroundColor: '#0A0D12' },
  primary: { borderColor: '#A35BFF', backgroundColor: '#25113D' },
  secondary: { borderColor: '#E447B7', backgroundColor: '#321126' },
  muscleText: { color: '#E4DFE9', fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  roleText: { color: '#858C99', fontSize: 9.5, lineHeight: 12, textTransform: 'uppercase' },
  sizeCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10, padding: 10, borderRadius: 15, borderWidth: 1, borderColor: '#303642', backgroundColor: '#080B10' },
  sizeCell: { minWidth: 95, alignItems: 'center', gap: 5 },
  sizeCellWide: { width: '100%', alignItems: 'center', gap: 5 },
  compactHero: { width: '100%', height: 178 },
  sizeLabel: { color: '#858C99', fontSize: 9.5, lineHeight: 12 },
  previewGrid: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  squarePreview: { width: 84, height: 84, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#303642', backgroundColor: '#07090D' },
  widePreview: { flex: 1, height: 94, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#303642', backgroundColor: '#07090D' },
  portraitPreview: { width: 90, height: 130, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#303642', backgroundColor: '#07090D' },
  fill: { width: '100%', height: '100%' },
  bottomSpace: { height: 120 },
});
