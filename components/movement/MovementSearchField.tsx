import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text, TextInput } from '@/components/ui/sl-text';
import type { MovementSearchSuggestion } from '@/lib/canonical-movement-search';

/** The same query refinement controls in Swap and the Session Workspace. */
export function MovementSearchField({ value, onChangeText, loading = false, suggestions = [],
  accessibilityLabel = 'Search movements', placeholder = 'Name, equipment, or muscle',
}: { value: string; onChangeText: (value: string) => void; loading?: boolean;
  suggestions?: MovementSearchSuggestion[]; accessibilityLabel?: string; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  const refine = (query: string) => {
    void Haptics.selectionAsync().catch(() => {});
    onChangeText(query);
  };
  return <View>
    <View style={[s.field, focused && s.focused]}>
      <Ionicons name="search-outline" size={19} color={focused ? '#c8a6ff' : '#9b92a7'} />
      <TextInput accessibilityLabel={accessibilityLabel} value={value} onChangeText={onChangeText}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        placeholder={placeholder} placeholderTextColor="#938b9e" style={s.input}
        autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
      {loading ? <ActivityIndicator size="small" color="#c8a6ff" accessibilityLabel="Searching movements" /> : null}
      {value ? <Pressable accessibilityRole="button" accessibilityLabel="Clear movement search"
        onPress={() => refine('')} hitSlop={4} style={({ pressed }) => [s.clear, pressed && s.pressed]}>
        <Ionicons name="close-circle" size={20} color="#aca2ba" />
      </Pressable> : null}
    </View>
    {!value ? <Text style={s.hint}>Try a familiar name, equipment, or a muscle.</Text> : null}
    {!loading && suggestions.length ? <View style={s.suggestions}>
      <Text style={s.eyebrow}>SEARCH SUGGESTIONS</Text>
      {suggestions.map(suggestion => <Pressable key={`${suggestion.movement_definition_id}:${suggestion.query}`}
        accessibilityRole="button" accessibilityLabel={`Search for ${suggestion.label}`}
        onPress={() => refine(suggestion.query)} style={({ pressed }) => [s.suggestion, pressed && s.pressed]}>
        <Ionicons name="search-outline" size={15} color="#aa90cf" />
        <Text numberOfLines={2} style={s.suggestionText}>{suggestion.label}</Text>
        <Ionicons name="arrow-up-outline" size={16} color="#c8a6ff" style={s.refineArrow} />
      </Pressable>)}
    </View> : null}
  </View>;
}

const s = StyleSheet.create({
  field: { minHeight: 48, paddingLeft: 14, paddingRight: 4, flexDirection: 'row', alignItems: 'center',
    gap: 9, borderWidth: 1, borderColor: '#30293d', borderRadius: 12, backgroundColor: '#0e0c13' },
  focused: { borderColor: '#a77ce3' },
  input: { flex: 1, minWidth: 0, minHeight: 46, color: '#f8f4ff', fontSize: 16, paddingVertical: 8 },
  clear: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65, backgroundColor: '#21142f' },
  hint: { color: '#a39aac', fontSize: 12, lineHeight: 17, marginTop: 7 },
  suggestions: { marginTop: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#30293d', paddingBottom: 5 },
  eyebrow: { color: '#a99aba', fontSize: 10, letterSpacing: 0.8, marginBottom: 2 },
  suggestion: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, borderRadius: 6 },
  suggestionText: { flex: 1, color: '#ded4ec', fontSize: 14, lineHeight: 19 },
  refineArrow: { transform: [{ rotate: '-45deg' }] },
});
