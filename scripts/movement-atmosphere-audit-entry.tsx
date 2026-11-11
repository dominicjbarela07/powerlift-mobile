/** Read-only DEV catalog inspection. Uses actual Session components and approved
 * asset resolution. This entry has no router, account or artwork decision API. */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Asset } from 'expo-asset';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionV3Movement, SessionV3MovementLayout } from '@/components/workout-logger/session-v3-movement';
import { SupersetRoundWorkspace, type SupersetWorkspaceItem } from '@/components/workout-logger/superset-round-workspace';
import { buildSupersetRoundModel } from '@/lib/superset-rounds';
import { MovementArtworkHeroLayer } from '@/components/movement/MovementArtworkHero';
import { Text } from '@/components/ui/sl-text';
import { canonicalArtworkInputFromDefinition } from '@/lib/canonical-movement-artwork';
import { isSelectableLibraryMovement } from '@/lib/retired-movement-discovery';
import { approvedLoggerCrop, movementAtmosphereFraming, movementHeroFocal, resolveApprovedExactMovementArtwork } from '@/lib/movement-artwork-hero';
import { CANONICAL_ACCESSORY_MOVEMENT_ARTWORK } from '@/lib/canonical-movement-artwork-assets';
import catalog from '@/config/governed-movement-art-taxonomy.json';
import policy from '@/artwork-review/runtime-policy.json';
import { resolveLoggerPlateStackForDisplayWeight } from '@/lib/logger-visual-context';
import type { CanonicalMovementArtworkKey } from '@/lib/canonical-movement-artwork';

const { createRoot } = require('react-dom/client') as {
  createRoot: (element: Element) => { render: (node: React.ReactNode) => void };
};
const definitions = catalog.movements.filter(isSelectableLibraryMovement);
const used = new Set(definitions.map(definition => resolveApprovedExactMovementArtwork(canonicalArtworkInputFromDefinition(definition))?.candidate_id));
const extra = policy.approved_exact_artwork.filter(row => !used.has(row.candidate_id));
const entries = [
  ...definitions.map(definition => ({ id: definition.id, key: definition.key, name: definition.display_name,
    equipment: definition.equipment_type, definition, archived: false })),
  ...extra.map(row => ({ id: row.movement_definition_id, key: row.key, name: row.key.replace(/^accessory_/, '').replaceAll('_', ' '),
    equipment: 'legacy', definition: null, archived: true })),
].sort((a, b) => a.key.localeCompare(b.key));

function AuditApp() {
  const query = new URLSearchParams(location.search);
  const [page, setPage] = useState(Number(query.get('page')) || 0);
  const [complete, setComplete] = useState(query.get('complete') === '1');
  const [width, setWidth] = useState(Number(query.get('width')) || 390);
  const ids = query.get('ids')?.split(',').map(Number);
  const superset = query.get('superset') === '1';
  const rows = ids ? entries.filter(row => ids.includes(row.id)) : entries;
  const count = 20;
  const [fontsLoaded, fontError] = useFonts({
    ionicons: `${location.origin}/fonts/Ionicons.ttf`,
    Michroma: `${location.origin}/fonts/Michroma-Regular.ttf`,
    'Exo2-Regular': `${location.origin}/fonts/Exo2-Regular.ttf`,
    'Exo2-Medium': `${location.origin}/fonts/Exo2-Medium.ttf`,
    'Exo2-SemiBold': `${location.origin}/fonts/Exo2-SemiBold.ttf`,
    'Exo2-Bold': `${location.origin}/fonts/Exo2-Bold.ttf`,
  });
  if (fontError) return <Text>{fontError.message}</Text>;
  if (!fontsLoaded) return <Text>Loading audit fonts</Text>;
  const navigate = (value: number) => {
    setPage(value);
    const updated = new URL(location.href);
    updated.searchParams.set('page', String(value));
    history.replaceState(null, '', updated);
    window.scrollTo(0, 0);
  };
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width, height: 900 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
    <View style={{ backgroundColor: '#121019', padding: 12, gap: 12 }}>
      <div style={{ color: '#eee', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', gap: 16 }}>
        <strong>DEV · Actual Session artwork audit · {rows.length} entries</strong>
        <button disabled={page === 0} onClick={() => navigate(page - 1)}>Previous</button>
        <span>Page {page + 1} of {Math.ceil(rows.length / count)}</span>
        <button disabled={(page + 1) * count >= rows.length} onClick={() => navigate(page + 1)}>Next</button>
        <button onClick={() => setComplete(!complete)}>{complete ? 'Show active' : 'Show completed'}</button>
        <select aria-label="Card width" value={width} onChange={event => setWidth(Number(event.target.value))}>
          {[320, 375, 390, 430].map(value => <option key={value} value={value}>{value} px</option>)}
        </select>
      </div>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }} testID="audit-grid">
        {rows.slice(page * count, (page + 1) * count).map((row, index) => {
          const movement = row.definition ? canonicalArtworkInputFromDefinition(row.definition) : null;
          const key = row.key as CanonicalMovementArtworkKey;
          const asset = CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[key];
          const dimensions = asset ? Asset.fromModule(asset.source as Parameters<typeof Asset.fromModule>[0]) : null;
          const receipt = policy.approved_exact_artwork.find(item => item.key === row.key);
          const props = {
            title: row.name, index: 1, expanded: true, complete, reduceMotion: true, onOpen: () => undefined,
            visual: { liftLabel: row.name, liftAccentColor: '#ab83e3', movementArtworkInput: movement,
              plateStack: row.definition?.kind === 'core' && query.get('plates') === '1'
                ? resolveLoggerPlateStackForDisplayWeight({ movement: row.definition.family || '' }, 135, 'lb') : null },
            focus: { movementName: row.name, currentSetLabel: 'Set 1', currentSetPositionLabel: 'Set 1 of 3',
              currentSetLoadLabel: row.equipment === 'bodyweight' ? null : '135 lb',
              currentSetRepsLabel: '8 reps', currentSetEffortLabel: '2 RIR', progressionLabel: '0 / 3',
              rail: [], canLog: false, canRepeat: false },
            history: <View style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: '#aadce5', fontSize: 13 }}>Movement history</Text></View>,
          };
          return <View key={`${row.key}:${row.archived ? 'legacy' : 'current'}`} style={{ width, backgroundColor: '#000' }} testID={`audit-${row.id}-${row.archived ? 'legacy' : 'current'}`}>
            <Text style={{ color: '#d3c3e4', backgroundColor: '#25202e', fontSize: 11, padding: 5 }}>
              {page * count + index + 1} · #{row.id} · {row.archived ? 'legacy mapping' : row.equipment}
            </Text>
            <View style={{ paddingHorizontal: 20, minHeight: superset ? 620 : 520 }}>
              {superset && movement ? <SupersetRoundWorkspace groupLabel="A" expanded selectedItemId={row.id}
                phase={complete ? 'complete' : 'active'} canLog={false} reduceMotion
                model={buildSupersetRoundModel<SupersetWorkspaceItem>([
                  { id: row.id, title: row.name, movement: row.name, sets: 3, superset_pos: 1, prescription: '3 × 8 · 2 RIR', movementArtwork: movement },
                  { id: -1, title: 'Push-Up', sets: 3, superset_pos: 2, prescription: '3 × 8 · 2 RIR',
                    movementArtwork: canonicalArtworkInputFromDefinition(definitions.find(definition => definition.id === 67)) },
                ])} onToggle={() => undefined} onSelectMember={() => undefined} onConfigureEquipment={() => undefined}
                onOpenHistory={() => undefined} onSwapMovement={() => undefined} swapActionForItem={() => null}
                onEditSet={() => undefined} onDeleteSet={() => undefined} />
                : row.archived ? <SessionV3MovementLayout {...props} framing={movementAtmosphereFraming(key)} artwork={asset && receipt ? <MovementArtworkHeroLayer
                source={asset.source} sourceWidth={dimensions?.width ?? undefined} sourceHeight={dimensions?.height ?? undefined}
                focal={movementHeroFocal(key)} crop={approvedLoggerCrop(key)} framing={movementAtmosphereFraming(key)} receiptId={receipt.candidate_id} reduceMotion /> : null} />
                : <SessionV3Movement {...props} />}
            </View>
          </View>;
        })}
      </View>
    </View>
  </SafeAreaProvider>;
}

if (__DEV__ && typeof document !== 'undefined' && document.getElementById('movement-audit-root')) {
  createRoot(document.getElementById('movement-audit-root')!).render(<AuditApp />);
}
