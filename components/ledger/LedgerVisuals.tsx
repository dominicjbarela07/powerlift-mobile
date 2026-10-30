import React, { useId } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/sl-text';
import { LEDGER as T } from '@/constants/ledger';
import { isGovernedMuscleId, MUSCLE_META } from '@/lib/anatomy-system';
import { ProgrammingMuscleRegionArt } from '@/components/anatomy/ProgrammingMuscleRegionArt';
import type { LedgerProgression, LedgerUnit, StrengthProgressionPoint } from '@/lib/ledger-data';
import { fetchLedgerExplorationIndex } from '@/lib/ledger-exploration';
import type { ArchiveItem } from '@/lib/ledger-archive';
import { ledgerBarFraction, ledgerCalendar, ledgerPreviewGeometry, ledgerTrainingWeeks } from '@/lib/ledger-visuals';
import { ledgerDate, performedWeightValue, type RecordLift } from '@/lib/ledger-records';
import { milestoneRenderAsset, MILESTONE_RENDER_ORIENTATION_STYLE } from '@/lib/barbell/milestone-render-assets';
import { useLedgerResource } from './use-ledger-resource';
const C=T.colors;

export function LedgerSurface({children,style,gold=false}:{children:React.ReactNode;style?:StyleProp<ViewStyle>;gold?:boolean}) {
  return <LinearGradient colors={gold?[T.material.goldFace,T.material.bottom]:[T.material.top,T.material.bottom]} start={{x:0,y:0}} end={{x:1,y:1}} style={[v.surface,gold&&v.gold,style]}>{children}</LinearGradient>;
}
export function LedgerSparkline({points,color,width=136,height=62}:{points:readonly Pick<StrengthProgressionPoint,'date'|'value_kg'>[];color:string;width?:number;height?:number}) {
  const id=`ledger-${useId().replaceAll(':','')}`,g=ledgerPreviewGeometry(points,width,height);
  if(!g)return <View style={[v.noTrend,{width,height}]}><Text style={v.note}>No load trend yet</Text></View>;
  const last=g.dots.at(-1)!;
  return <View accessible accessibilityLabel={`Recorded load, ${g.count} dated observations. ${ledgerDate(g.first)} to ${ledgerDate(g.last)}.`}>
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs><SvgGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity={0.24}/><Stop offset="1" stopColor={color} stopOpacity={0.01}/></SvgGradient></Defs>
      {g.dots.length>1?<><Path d={`${g.path} L${last.x},${height} L${g.dots[0].x},${height} Z`} fill={`url(#${id})`}/><Path d={g.path} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round"/></>:null}
      {g.dots.map((p,i)=><Circle key={i} cx={p.x} cy={p.y} r={i===g.dots.length-1?3.5:2} fill={color}/>)}
    </Svg>
    <View style={v.between}><Text style={v.tiny}>{shortDate(g.first)}</Text><Text style={v.tiny}>{shortDate(g.last)}</Text></View>
  </View>;
}
export function LedgerRecordCard({label,lift,kg,reps,points,unit,onPress,aggregation}:{label:string;lift:RecordLift;kg?:number|null;reps?:number|null;points:readonly StrengthProgressionPoint[];unit:LedgerUnit;onPress:()=>void;aggregation?:string}) {
  const {width}=useWindowDimensions();
  const chartWidth=width<360?100:width<410?116:136;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label} record. Best recorded load ${performedWeightValue(kg,unit)} ${unit}${reps!=null?` for ${reps} reps`:''}.`} onPress={onPress} style={({pressed})=>pressed&&v.pressed}>
    <LedgerSurface style={v.record}>
      <View style={v.recordCopy}><Text style={v.lift}>{label}</Text><Text style={v.note}>Best recorded load</Text><View style={v.weightLine}><Text style={[v.weight,{color:C[lift]}]}>{performedWeightValue(kg,unit)}</Text>{kg!=null?<Text style={[v.weightUnit,{color:C[lift]}]}>{unit}{reps!=null?` × ${reps}`:''}</Text>:null}</View></View>
      <View style={v.preview}><Text style={v.tiny}>{aggregation==='week'?'Weekly top load':'Session top load'}</Text><LedgerSparkline points={points} color={C[lift]} width={chartWidth}/></View><Ionicons name="chevron-forward" color={C.muted} size={15}/>
    </LedgerSurface>
  </Pressable>;
}
export function LedgerTrainingRhythm({progression,onPress}:{progression:LedgerProgression|null;onPress?:()=>void}) {
  const weeks=ledgerTrainingWeeks(progression),maximum=Math.max(1,...weeks.map(w=>w.completed!)),total=weeks.reduce((s,w)=>s+w.completed!,0);
  if(!weeks.length)return null;
  return <LedgerSurface style={v.panel}>
    <View style={v.between}><View><Text style={v.heading}>Training rhythm</Text><Text style={v.note}>Completed Sessions · last {weeks.length} recorded weeks</Text></View><Ionicons name="stats-chart-outline" color={C.accent} size={19}/></View>
    <View style={v.bars} accessibilityLabel={`${total} completed Sessions across ${weeks.length} weeks`} accessible>{weeks.map((w,i)=><View key={w.week_start} style={v.barColumn}><View style={v.barTrack}><View style={[v.barFill,{height:`${ledgerBarFraction(w.completed,maximum)*100}%`,backgroundColor:i===weeks.length-1?C.accent:C.squat}]}/></View><Text style={v.tiny}>{i===0||i===weeks.length-1?shortDate(w.week_start!):''}</Text></View>)}</View>
    <View style={v.between}><Text style={v.note}>{total} completed · shown weeks</Text>{onPress?<Pressable accessibilityRole="button" onPress={onPress} style={v.inlineAction}><Text style={v.link}>View history</Text><Ionicons name="arrow-forward" color={C.accent} size={15}/></Pressable>:null}</View>
  </LedgerSurface>;
}
export function LedgerHistoryCalendar({items}:{items:readonly ArchiveItem[]}) {
  const weeks=ledgerCalendar(items);
  if(!weeks)return null;
  return <LedgerSurface style={v.panel}>
    <View style={v.between}><Text style={v.heading}>Training rhythm</Text><Text style={v.note}>Loaded Sessions</Text></View>
    <View style={v.calendarRow}><View style={v.weekLabel}/>{['M','T','W','T','F','S','S'].map((d,i)=><Text key={i} style={v.dayLabel}>{d}</Text>)}</View>
    {weeks.map(week=><View key={week[0].date} style={v.calendarRow}><Text style={[v.note,v.weekLabel]}>{shortDate(week[0].date)}</Text>{week.map(day=><View key={day.date} style={v.calendarCell} accessible accessibilityRole="text" accessibilityLabel={`${ledgerDate(day.date)}: ${day.count} completed Sessions in loaded history`}><View style={[v.day,day.count>0&&v.dayActive]}/></View>)}</View>)}
    <Text style={v.tiny}>Recorded dates in the loaded history. Older pages remain available below.</Text>
  </LedgerSurface>;
}
export function LedgerMuscleExposure({athleteId,onPress}:{athleteId?:number;onPress:()=>void}) {
  const resource=useLedgerResource(`ledger-visual-muscles:${athleteId??'self'}`,()=>fetchLedgerExplorationIndex(athleteId,'index'));
  const data=resource.data,groups=(data?.muscle_groups??[]).filter(g=>g.set_count>0&&isGovernedMuscleId(g.key)).slice().sort((a,b)=>b.set_count-a.set_count),max=Math.max(1,...groups.map(g=>g.set_count));
  if(!groups.length)return resource.error?<Pressable accessibilityRole="button" onPress={resource.load} style={v.inlineAction}><Text style={v.note}>Retry muscle exposure</Text></Pressable>:null;
  return <Pressable accessibilityRole="button" onPress={onPress} accessibilityLabel={`Explore recorded muscle exposure. ${groups.map(g=>`${MUSCLE_META[g.key as keyof typeof MUSCLE_META]?.label}: ${g.set_count} primary sets`).join(', ')}.`}><LedgerSurface style={v.panel}>
    <View style={v.between}><Text style={v.heading}>Muscles trained</Text><Ionicons name="chevron-forward" color={C.muted} size={17}/></View><Text style={v.note}>Tagged primary muscles · all history</Text>
    <View style={v.muscleRow}><View style={v.muscleArt}><ProgrammingMuscleRegionArt athlete={data?.athlete} primary={groups.map(g=>g.key)} secondary={(data?.movements??[]).filter(m=>m.set_count>0).flatMap(m=>m.secondary_muscle_groups)} level="session" framingPreset="card" style={v.full}/></View><View style={v.muscleValues}>{groups.slice(0,3).map(g=><View key={g.key} style={v.muscleValue}><View style={v.between}><Text numberOfLines={1} style={v.body}>{MUSCLE_META[g.key as keyof typeof MUSCLE_META]?.label??g.key}</Text><Text style={v.note}>{g.set_count}</Text></View><View style={v.meter}><View style={[v.meterFill,{width:`${ledgerBarFraction(g.set_count,max)*100}%`}]}/></View></View>)}</View></View><Text style={v.tiny}>Violet: primary · Pink: supporting targets</Text>
  </LedgerSurface></Pressable>;
}
export function LedgerRepBar({reps,kg,careerKg,unit,maximum,onPress}:{reps:number;kg?:number|null;careerKg?:number|null;unit:LedgerUnit;maximum:number;onPress?:()=>void}) {
  return <Pressable accessibilityRole={onPress?'button':undefined} disabled={!onPress} accessibilityLabel={`Inspect ${reps}-rep record`} onPress={onPress} style={v.rep}>
    <Text style={v.body}>{reps} reps</Text><View style={v.repMiddle}><View style={v.meter}><View style={[v.meterFill,{width:`${ledgerBarFraction(kg,maximum)*100}%`}]}/></View>{careerKg!=null&&careerKg!==kg?<Text style={v.tiny}>Career: {performedWeightValue(careerKg,unit)} {unit}</Text>:null}</View><Text style={v.body}>{performedWeightValue(kg,unit)} {unit}</Text>
  </Pressable>;
}
export function LedgerPlateArt({lift,renderKey,large=false}:{lift:RecordLift;renderKey:number;large?:boolean}) {
  return <Image source={milestoneRenderAsset(lift,renderKey)} resizeMode="contain" style={[large?v.plateLarge:v.plate,MILESTONE_RENDER_ORIENTATION_STYLE]} accessibilityIgnoresInvertColors/>;
}
export function LedgerProgressMeter({value,maximum,color=C.accent}:{value:number;maximum:number;color?:string}) {
  return <View style={v.meter}><View style={[v.meterFill,{backgroundColor:color,width:`${ledgerBarFraction(value,maximum)*100}%`}]}/></View>;
}
function shortDate(date:string){const d=new Date(`${date.slice(0,10)}T12:00:00Z`);return d.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});}
const v=StyleSheet.create({
 surface:{backgroundColor:C.panel,borderWidth:1,borderColor:T.material.line,borderRadius:T.radius.material,overflow:'hidden'},gold:{borderColor:T.material.goldLine},panel:{padding:17,gap:12,marginTop:16},between:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},heading:{fontFamily:T.fonts.bodySemiBold,color:C.text,fontSize:T.type.row,lineHeight:25},body:{fontFamily:T.fonts.bodyMedium,color:C.text,fontSize:T.type.bodySmall,lineHeight:20},note:{color:C.muted,fontSize:T.type.caption,lineHeight:18},tiny:{color:C.muted,fontSize:T.type.micro,lineHeight:16},link:{color:C.accent,fontFamily:T.fonts.bodyMedium,fontSize:T.type.caption},inlineAction:{minHeight:44,alignItems:'center',flexDirection:'row',gap:7},pressed:{opacity:0.76},
 record:{padding:15,minHeight:116,flexDirection:'row',alignItems:'center',gap:7,marginBottom:10},recordCopy:{flex:1,minWidth:0,gap:4},lift:{color:C.text,fontFamily:T.fonts.bodySemiBold,fontSize:T.type.row,lineHeight:24},weightLine:{flexDirection:'row',alignItems:'baseline',gap:4,flexWrap:'wrap',marginTop:3},weight:{fontFamily:T.fonts.bodySemiBold,fontSize:T.type.cardNumber,lineHeight:35,fontVariant:['tabular-nums']},weightUnit:{fontFamily:T.fonts.bodyMedium,fontSize:T.type.small},noTrend:{justifyContent:'center',alignItems:'center'},
 bars:{flexDirection:'row',gap:6,marginTop:5},barColumn:{flex:1,gap:5,alignItems:'center'},barTrack:{height:65,width:'100%',justifyContent:'flex-end',borderBottomWidth:1,borderBottomColor:C.line},barFill:{width:'100%',borderTopLeftRadius:3,borderTopRightRadius:3,minHeight:0},
 calendarRow:{flexDirection:'row',alignItems:'center',gap:5},weekLabel:{width:43,fontSize:T.type.micro},dayLabel:{flex:1,color:C.muted,textAlign:'center',fontSize:T.type.micro},calendarCell:{flex:1,alignItems:'center'},day:{width:'100%',height:22,maxWidth:32,borderRadius:T.radius.sm,backgroundColor:C.raised},dayActive:{backgroundColor:C.squat},
 muscleRow:{flexDirection:'row',alignItems:'center',gap:15},muscleArt:{width:150,height:176},full:{width:'100%',height:'100%'},preview:{gap:3},muscleValues:{flex:1,gap:17,minWidth:0},muscleValue:{gap:7},meter:{height:6,borderRadius:T.radius.xs,backgroundColor:C.raised,overflow:'hidden'},meterFill:{height:'100%',borderRadius:T.radius.xs,backgroundColor:C.squat},rep:{flexDirection:'row',alignItems:'center',gap:12,minHeight:62},repMiddle:{flex:1,gap:4},plate:{width:100,height:68},plateLarge:{width:150,height:105},
});
