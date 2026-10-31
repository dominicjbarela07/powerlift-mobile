import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/sl-text';
import { LEDGER as T } from '@/constants/ledger';
import { type DisplayWeightUnit } from '@/lib/display-units';
import type { ArchiveItem } from '@/lib/ledger-archive';
import { ledgerSourceFacts, ledgerReflectionFacts, ledgerProvenanceLabel } from '@/lib/ledger-history-presentation';
import { performedWeightValue, ledgerDate, type LedgerSource } from '@/lib/ledger-records';
import { LedgerMovementBackdrop } from './LedgerMovementBackdrop';
import { ledgerArchiveArtwork } from '@/lib/ledger-movement-art';
const C=T.colors;
type Item=ArchiveItem & {sets?:ArchiveItem[];athlete_visible_coach_feedback?:string|null;athlete_reflection?:Record<string,unknown>|null};
function performance(item:ArchiveItem,unit:DisplayWeightUnit) {
 const p=item.performance;
 return [typeof p?.weight_kg==='number'?`${performedWeightValue(p.weight_kg,unit)} ${unit}`:null,typeof p?.reps==='number'?`× ${p.reps}`:null,typeof p?.rpe==='number'?`@ RPE ${p.rpe}`:typeof p?.rir==='number'?`· ${p.rir} RIR`:null].filter(Boolean).join(' ');
}
export function LedgerSourceContent({item,unit,onOpen,onPlay,onBrowseFilm}:{onBrowseFilm?:(item:ArchiveItem)=>void;item:Item;unit:DisplayWeightUnit;onOpen?:(source:LedgerSource)=>void;onPlay:()=>void}) {
 const artwork=ledgerArchiveArtwork(item);
 const p=item.performance,weight=typeof p?.weight_kg==='number'?p.weight_kg:null;
 const equipment=[item.movement?.equipment_manufacturer,item.movement?.equipment_model,item.movement?.equipment_type].filter(v=>typeof v==='string'&&v.trim()).join(' · ');
 const context=[item.program_context?.program_name,item.program_context?.training_program_name,item.program_context?.block_name,item.program_context?.training_block_name].filter((v,i,a)=>typeof v==='string'&&v.trim()&&a.indexOf(v)===i).join(' · ');
 const sourceFacts=ledgerSourceFacts(item,unit),reflectionFacts=ledgerReflectionFacts(item.athlete_reflection);
 const filmFeedback=typeof item.media?.athlete_visible_feedback==='string'?item.media.athlete_visible_feedback:null;
 const unavailable=item.invalidation_state&&item.invalidation_state!=='valid';
 return <View style={s.page} testID="ledger-source-content">
  <Text style={s.label}>{ledgerProvenanceLabel(item)}</Text>
  <Text style={s.title}>{item.title}</Text>{item.subtitle&&item.archive_item_type!=='historical_performance'?<Text style={s.copy}>{item.subtitle}</Text>:null}
  <Text style={s.date}>{ledgerDate(item.occurred_on || item.occurred_at)}</Text>
  {unavailable?<View style={s.notice}><Ionicons name="information-circle-outline" color={C.gold} size={20}/><Text style={s.copy}>No longer current. This original entry is retained in your history.</Text></View>:null}
  {weight!=null||typeof p?.reps==='number'||artwork?<View style={[s.performance,artwork&&s.performanceAtmosphere]}>
    {artwork?<LedgerMovementBackdrop movement={artwork} width={220} testID="ledger-source-movement-artwork"/>:null}
    <View style={[s.flex,artwork&&s.performanceCopy]}>{weight!=null?<View style={s.load}><Text style={[s.number,artwork&&s.artNumber]}>{performedWeightValue(weight,unit)}</Text><Text style={[s.unit,artwork&&s.artUnit]}>{unit}{typeof p?.reps==='number'?` × ${p.reps}`:''}</Text></View>:typeof p?.reps==='number'?<><View style={s.load}><Text style={[s.number,artwork&&s.artNumber]}>{p.reps}</Text><Text style={s.unit}>reps</Text></View><Text style={s.copy}>Load was not recorded.</Text></>:null}
    <View style={s.facts}>{typeof p?.rpe==='number'?<Text style={s.fact}>RPE {p.rpe}</Text>:null}{typeof p?.rir==='number'?<Text style={s.fact}>{p.rir} RIR</Text>:null}{typeof p?.set_index==='number'?<Text style={s.fact}>Set {p.set_index}</Text>:null}</View></View>
  </View>:null}
  {sourceFacts.length?<View style={s.factGrid}>{sourceFacts.map(f=><View key={f.label} style={s.factTile}><Text style={s.label}>{f.label}</Text><Text style={s.heading}>{f.value}</Text></View>)}</View>:null}
  {item.reported_bodyweight?<View style={s.section}><Text style={s.label}>REPORTED BODYWEIGHT · AT THIS SESSION</Text><Text style={s.copy}>{performedWeightValue(item.reported_bodyweight.reported_bodyweight_kg,unit)} {unit}</Text></View>:null}
  {equipment?<View style={s.section}><Text style={s.label}>PERFORMED EQUIPMENT</Text><Text style={s.copy}>{equipment}</Text></View>:null}
  {context?<View style={s.section}><Text style={s.label}>TRAINING CONTEXT</Text><Text style={s.heading}>{context}</Text></View>:null}
  {item.sets?.length?<View style={s.section}><Text style={s.heading}>Performed sets</Text><Text style={s.copy}>{item.sets.length} preserved {item.sets.length===1?'set':'sets'}, with {item.sets.length===1?'its':'their'} original movement and equipment.</Text>{item.sets.map(set=><Pressable key={`${set.archive_item_type}:${set.source_id}`} accessibilityRole={onOpen?'button':undefined} accessibilityLabel={`Inspect ${set.title}, set ${set.performance?.set_index || 'record'}`} disabled={!onOpen} onPress={()=>onOpen?.({type:set.archive_item_type,id:set.source_id})} style={s.set}><Text style={s.setIndex}>{String(set.performance?.set_index??'—')}</Text><View style={s.flex}><Text style={s.heading}>{set.title}</Text><Text style={s.copy}>{performance(set,unit)||'Performed evidence'}</Text></View><Ionicons name="chevron-forward" color={C.muted} size={18}/></Pressable>)}</View>:null}
  {item.archive_item_type==='video'?<Pressable accessibilityRole="button" onPress={onPlay} style={s.play}><Ionicons name="play-circle-outline" size={25} color={C.text}/><Text style={s.heading}>Play recorded film</Text></Pressable>:null}
  {item.athlete_visible_coach_feedback?<View style={s.section}><Text style={s.label}>COACH FEEDBACK · SHARED WITH YOU</Text><Text style={s.copy}>{item.athlete_visible_coach_feedback}</Text></View>:null}
  {filmFeedback?<View style={s.feedback}><Text style={s.label}>COACH FEEDBACK · SHARED ON THIS FILM</Text><Text style={s.copy}>{filmFeedback}</Text></View>:null}
  {item.athlete_reflection&&(reflectionFacts.length||item.athlete_reflection.note)?<View style={s.section}><Text style={s.heading}>Athlete reflection</Text>{reflectionFacts.map(f=><View style={s.factRow} key={f.label}><Text style={s.copy}>{f.label}</Text><Text style={s.heading}>{f.value}</Text></View>)}{typeof item.athlete_reflection.note==='string'&&item.athlete_reflection.note.trim()?<Text style={s.copy}>{item.athlete_reflection.note}</Text>:null}</View>:null}
  {item.archive_item_type!=='video'&&Number(item.media?.video_count)>0&&onBrowseFilm?<Pressable accessibilityRole="button" accessibilityLabel="Find recorded film from this Session or movement" onPress={()=>onBrowseFilm(item)} style={s.play}><Ionicons name="videocam-outline" size={24} color={C.teal}/><View style={s.flex}><Text style={s.heading}>Find recorded film</Text><Text style={s.label}>Same movement or Session · performed date</Text></View><Ionicons name="arrow-forward" size={19} color={C.teal}/></Pressable>:null}
  <Text style={s.foot}>Your original evidence stays attached to this record.</Text>
 </View>;
}
const s=StyleSheet.create({page:{gap:12},performanceAtmosphere:{minHeight:198},performanceCopy:{maxWidth:'55%'},artNumber:{fontSize:T.type.cardNumber,lineHeight:41},artUnit:{fontSize:T.type.bodyStrong},factGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginVertical:8},factTile:{width:'47%',padding:13,gap:9,backgroundColor:C.panel,borderRadius:T.radius.chip,borderWidth:1,borderColor:C.line},factRow:{flexDirection:'row',justifyContent:'space-between',gap:12},feedback:{gap:12,padding:16,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:T.radius.card},label:{color:C.muted,fontFamily:T.fonts.bodyMedium,fontSize:T.type.micro,lineHeight:17,letterSpacing:1},title:{color:C.text,fontFamily:T.fonts.bodySemiBold,fontSize:T.type.title,lineHeight:37,letterSpacing:-.5},copy:{color:C.secondary,fontSize:T.type.body,lineHeight:24},date:{color:C.muted,fontSize:T.type.small,lineHeight:21},performance:{flexDirection:'row',alignItems:'center',gap:16,paddingVertical:20,marginBottom:5,borderBottomWidth:1,borderBottomColor:C.line},load:{flexDirection:'row',alignItems:'baseline',gap:7,flexWrap:'wrap'},number:{color:C.text,fontFamily:T.fonts.bodySemiBold,fontSize:T.type.number,lineHeight:62,fontVariant:['tabular-nums']},unit:{color:C.secondary,fontSize:T.type.section,fontFamily:T.fonts.bodyMedium},facts:{flexDirection:'row',gap:18,flexWrap:'wrap'},fact:{color:C.secondary,fontSize:T.type.body,lineHeight:23},heading:{color:C.text,fontFamily:T.fonts.bodyMedium,fontSize:T.type.body,lineHeight:23},section:{gap:12,paddingTop:17},notice:{flexDirection:'row',gap:12,paddingVertical:16},set:{flexDirection:'row',gap:13,alignItems:'center',minHeight:80,borderBottomWidth:1,borderBottomColor:C.line,paddingVertical:15},setIndex:{width:24,color:C.muted,fontSize:T.type.body},flex:{flex:1,gap:5},play:{minHeight:54,borderWidth:1,borderColor:C.strongLine,borderRadius:T.radius.control,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,marginTop:12},foot:{color:C.muted,fontSize:T.type.caption,lineHeight:19,paddingVertical:24}});
