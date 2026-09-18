/** Private DEV-only web entry, served by canonical npm start. No application
 * router, authentication state, workout data, or execution writes are mounted. */
import React, { useEffect, useState } from 'react';
// React DOM is used only by this private browser entry.
const { createRoot } = require('react-dom/client') as { createRoot: (element: Element) => { render: (node: React.ReactNode) => void } };
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/sl-text';
import { SessionV3MovementLayout } from '@/components/workout-logger/session-v3-movement';
import { SessionV3Header } from '@/components/workout-logger/session-v3-shell';
import { SessionHistoryPeek } from '@/components/workout-logger/session-history-peek';
import { SessionEquipmentContext } from '@/components/workout-logger/session-equipment-context';
import { MovementArtworkHeroLayer } from '@/components/movement/MovementArtworkHero';
import { movementHeroDefaultFocal } from '@/lib/movement-artwork-hero';
import { CANONICAL_ACCESSORY_ARTWORK_IDENTITIES, type CanonicalAccessoryArtworkKey } from '@/lib/canonical-movement-artwork';
import type { Presentation, LoggerCrop } from '@/lib/movement-artwork-geometry.mjs';

type Preview = { candidate_id: string; movement_definition_id: number; key: string; movement_name: string;
  primary_muscle_group: string; equipment_type: string; presentation?: Presentation;
  testOnly: boolean; source: string; dimensions: [number, number]; crop: LoggerCrop; machineSelected: boolean };
const send = (data: object) => window.parent.postMessage(data, location.origin);
function PreviewApp() {
  const [item, setItem] = useState<Preview | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [fontsLoaded, fontError] = useFonts({
    ionicons: `${location.origin}/dev/art-review/logger/fonts/Ionicons.ttf`,
    Michroma: `${location.origin}/dev/art-review/logger/fonts/Michroma-Regular.ttf`,
    'Exo2-Regular': `${location.origin}/dev/art-review/logger/fonts/Exo2-Regular.ttf`,
    'Exo2-Medium': `${location.origin}/dev/art-review/logger/fonts/Exo2-Medium.ttf`,
    'Exo2-SemiBold': `${location.origin}/dev/art-review/logger/fonts/Exo2-SemiBold.ttf`,
    'Exo2-Bold': `${location.origin}/dev/art-review/logger/fonts/Exo2-Bold.ttf`,
  });
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'logger-preview') return;
      const row = event.data.item as Preview;
      if (!row?.source || !new URL(row.source, location.href).pathname.startsWith('/dev/art-review/assets/')) return;
      if (new URL(row.source, location.href).origin !== location.origin) return;
      setItem(row);
    };
    window.addEventListener('message', receive);
    send({ type: 'logger-ready' });
    const keyboard = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'r', 's', '+', '=', '-', '0', 'c', 'j', 'k'].includes(event.key)) {
        event.preventDefault(); send({ type: 'logger-key', key: event.key, shiftKey: event.shiftKey });
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => { window.removeEventListener('message', receive); window.removeEventListener('keydown', keyboard); };
  }, []);
  useEffect(() => { if (item && loadedId === item.candidate_id) send({type:'logger-loaded',candidate_id:item.candidate_id}); }, [item, loadedId]);
  useEffect(() => { if (fontError) send({type: 'logger-error', message: 'Logger fonts could not load. Reload the preview.'}); }, [fontError]);
  if (!fontsLoaded || !item) return <Text style={{color:'#b9a7cb',padding:20}}>Loading canonical Logger…</Text>;
  const machine = item.equipment_type === 'machine';
  const selected = item.machineSelected;
  const identityId = item.testOnly ? Number(Object.entries(CANONICAL_ACCESSORY_ARTWORK_IDENTITIES).find(([, row]) => row.key === item.key)?.[0]) || item.movement_definition_id : item.movement_definition_id;
  const movement = { identity_type: 'accessory' as const, movement_definition_id: identityId,
    key: item.key, primary_muscle_group: item.primary_muscle_group };
  return <SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:window.innerWidth,height:window.innerHeight},insets:{top:0,left:0,right:0,bottom:0}}}>
    <View style={{backgroundColor:'#000'}} onLayout={event => send({type:'logger-height',height:event.nativeEvent.layout.height})}>
      <SessionV3Header title="Session" subtitle="Movement art preview" active={false} inset={8}
        logged={0} total={3} startedAt={null} onBack={() => undefined} onActions={() => undefined} />
      <View style={{paddingHorizontal:18,paddingTop:14}}>
        <SessionV3MovementLayout title={item.movement_name} index={1} expanded complete={false} reduceMotion onOpen={() => undefined}
          visual={{liftLabel:item.movement_name,liftAccentColor:'#ab83e3',movementArtworkInput:movement}}
          focus={{movementName:item.movement_name,currentSetLabel:'Set 1',currentSetPositionLabel:'SET 1 OF 3',
            currentSetLoadLabel:item.equipment_type==='bodyweight' ? undefined : '100 lb',currentSetRepsLabel:'12–15',currentSetEffortLabel:'1 RIR',progressionLabel:'0 / 3',rail:[],canLog:false,canRepeat:false}}
          artwork={<MovementArtworkHeroLayer key={item.candidate_id} source={{uri:item.source}} sourceWidth={item.dimensions[0]} sourceHeight={item.dimensions[1]}
            focal={item.presentation || movementHeroDefaultFocal(item.key as CanonicalAccessoryArtworkKey)} crop={item.crop} receiptId={item.candidate_id} reduceMotion
            onLoad={() => setLoadedId(item.candidate_id)}
            onError={() => send({type:'logger-error',candidate_id:item.candidate_id,message:'The Logger image did not load. Decisions are paused.'})} />}
          equipment={machine ? <SessionEquipmentContext selected={selected} manufacturer={selected?'Life Fitness':null}
            name="Life Fitness" variant="Plate-loaded" /> : null}
          history={<SessionHistoryPeek target={{athleteId:1,movementDefinitionId:item.movement_definition_id}} workoutId={1} sessionDate="2026-09-18" ownerId="logger-crop-preview"
            history={{identity_scope:'exact_identity',movement_definition_id:item.movement_definition_id,comparison_allowed:true,comparison_identity_key:'preview',previous_exposure:null}}
            unit="lb" onOpen={() => undefined} />}
          actions={<Text style={{color:'#d4b9f3',fontSize:13,paddingVertical:12}}>Swap movement</Text>} />
      </View>
    </View>
  </SafeAreaProvider>;
}
if (__DEV__ && typeof document !== 'undefined' && document.getElementById('logger-preview-root')) {
  createRoot(document.getElementById('logger-preview-root')!).render(<PreviewApp />);
}
