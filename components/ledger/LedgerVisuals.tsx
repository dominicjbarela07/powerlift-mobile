import React, { useId } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/sl-text';
import { LEDGER as T } from '@/constants/ledger';
import { isGovernedMuscleId, MUSCLE_META } from '@/lib/anatomy-system';
import { ProgrammingMuscleRegionArt } from '@/components/anatomy/ProgrammingMuscleRegionArt';
import type { LedgerProgression, LedgerUnit, StrengthProgressionPoint } from '@/lib/ledger-data';
import { fetchLedgerExplorationIndex } from '@/lib/ledger-exploration';
import type { ArchiveItem } from '@/lib/ledger-archive';
import { ledgerBarFraction, ledgerCalendar, ledgerCompetitionVolume, ledgerPreviewGeometry, ledgerSessionTotal, ledgerTrainingWeeks } from '@/lib/ledger-visuals';
import { ledgerDate, performedWeightValue, type RecordLift } from '@/lib/ledger-records';
import { resolvePlateStackRender } from '@/lib/barbell/plate-stack-render-resolver';
import { kilogramsToDisplayValue } from '@/lib/display-units';
import { milestoneRenderAsset, MILESTONE_RENDER_ORIENTATION_STYLE } from '@/lib/barbell/milestone-render-assets';
import { useLedgerResource } from './use-ledger-resource';
import { LedgerMovementBackdrop } from './LedgerMovementBackdrop';
import { ledgerCompetitionArtwork } from '@/lib/ledger-movement-art';
const C=T.colors;

export function LedgerSurface({children,style,gold=false,tone}:{children:React.ReactNode;style?:StyleProp<ViewStyle>;gold?:boolean;tone?:RecordLift}) {
  return <LinearGradient colors={gold?[T.material.goldFace,T.material.goldMiddle,T.material.bottom]:[tone?T.material[`${tone}Face`]:T.material.top,T.material.face,T.material.bottom]} locations={[0,0.48,1]} start={{x:0,y:0}} end={{x:0.88,y:1}} style={[v.surface,tone&&{borderColor:T.material[`${tone}Edge`]},gold&&v.gold,style]}>
    <LinearGradient pointerEvents="none" accessible={false} colors={[T.material.faceSheen,T.material.maskClear]} style={v.faceLight}/>
    <LinearGradient pointerEvents="none" accessible={false} colors={[T.material.maskClear,T.material.edgeLight,T.material.maskClear]} start={{x:0,y:0}} end={{x:1,y:0}} style={v.topLight}/>
    {children}
  </LinearGradient>;
}
export function LedgerSparkline({points,color,unit='kg',width=164,height=78}:{points:readonly Pick<StrengthProgressionPoint,'date'|'value_kg'>[];color:string;unit?:LedgerUnit;width?:number;height?:number}) {
  const id=`ledger-${useId().replaceAll(':','')}`,left=38,plotWidth=width-left-4,g=ledgerPreviewGeometry(points,plotWidth,height-12);
  if(!g)return <View style={[v.noTrend,{width,height}]}><Text style={v.note}>No load trend yet</Text></View>;
  const last=g.dots.at(-1)!,ticks=g.high===g.low?[{value:g.high,y:(height-12)/2}]:[{value:g.high,y:5},{value:(g.high+g.low)/2,y:(height-12)/2},{value:g.low,y:height-19}];
  return <View accessible accessibilityLabel={`Recorded load, ${g.count} dated observations in ${unit}. ${ledgerDate(g.first)} to ${ledgerDate(g.last)}.`}>
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs><SvgGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity={0.38}/><Stop offset="1" stopColor={color} stopOpacity={0.04}/></SvgGradient></Defs>
      {ticks.map((tick,i)=><React.Fragment key={i}><Line x1={left} x2={width} y1={tick.y+7} y2={tick.y+7} stroke={T.material.chartGrid} strokeOpacity={0.25}/><SvgText x={left-6} y={tick.y+10} fill={C.muted} fontSize={T.type.micro} textAnchor="end">{performedWeightValue(tick.value,unit)}</SvgText></React.Fragment>)}
      {[0,1,2,3].map(i=><Line key={i} x1={left+i*plotWidth/3} x2={left+i*plotWidth/3} y1={4} y2={height-8} stroke={T.material.chartGrid} strokeOpacity={0.2} strokeDasharray="2 3"/>)}
      {g.dots.length>1?<Path d={`${g.path} L${last.x},${height-7} L${g.dots[0].x},${height-7} Z`} transform={`translate(${left} 7)`} fill={`url(#${id})`}/>:null}
      <Path d={g.path} transform={`translate(${left} 7)`} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round"/>
      <SvgText x={width-4} y={Math.max(9,last.y+2)} textAnchor="end" fill={color} fontSize={T.type.micro} fontWeight="600">{performedWeightValue(g.lastValue,unit)}</SvgText>
      {g.dots.map((p,i)=><Circle key={i} cx={p.x+left} cy={p.y+7} r={i===g.dots.length-1?3.2:1.9} fill={color}/>)}
    </Svg>
    <View style={v.between}><Text style={v.tiny}>{unit}</Text><Text style={v.tiny}>{shortDate(g.first)}</Text><Text style={v.tiny}>{shortDate(g.last)}</Text></View>
  </View>;
}
export function LedgerRecordCard({label,lift,kg,reps,points,unit,onPress,aggregation}:{label:string;lift:RecordLift;kg?:number|null;reps?:number|null;points:readonly StrengthProgressionPoint[];unit:LedgerUnit;onPress:()=>void;aggregation?:string}) {
  const {width}=useWindowDimensions();
  const artWidth=Math.min(210,(width-36)*.55),chartWidth=Math.min(194,(width-36-32)*.56);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label} record. Best recorded load ${performedWeightValue(kg,unit)} ${unit}${reps!=null?` for ${reps} reps`:''}.`} onPress={onPress} style={({pressed})=>pressed&&v.pressed}>
    <LedgerSurface tone={lift} style={v.record}>
      <LedgerMovementBackdrop movement={ledgerCompetitionArtwork(lift)} width={artWidth} align="right" testID={`ledger-record-${lift}-artwork`}/>
      <View style={[v.recordCopy,{flex:0,width:chartWidth}]}><View style={v.between}><Text style={v.lift}>{label}</Text><Ionicons name="chevron-forward" color={C.muted} size={15}/></View>
        <View style={v.weightLine}><Text style={[v.weight,{color:C[lift]}]}>{performedWeightValue(kg,unit)}</Text>{kg!=null?<Text style={[v.weightUnit,{color:C[lift]},width<390&&v.compactUnit]}>{unit}{reps!=null?` × ${reps}`:''}</Text>:null}</View>
        <LedgerSparkline points={points} unit={unit} color={C[lift]} width={chartWidth} height={64}/>
      </View>
    </LedgerSurface>
  </Pressable>;
}
export function LedgerTrainingRhythm({progression,unit='kg',onPress}:{progression:LedgerProgression|null;unit?:LedgerUnit;onPress?:()=>void}) {
  const weeks=ledgerCompetitionVolume(progression),sessionWeeks=ledgerTrainingWeeks(progression),maximum=Math.max(1,...weeks.map(w=>w.total));
  if(!weeks.length&&!sessionWeeks.length)return null;
  const completed=ledgerSessionTotal(progression),shown=sessionWeeks.reduce((s,w)=>s+w.completed!,0),total=weeks.reduce((s,w)=>s+w.total,0);
  return <LedgerSurface style={v.panel}>
    <View style={v.between}><View><Text style={v.heading}>Training rhythm</Text><Text style={v.note}>{weeks.length?'Competition lift volume':'Completed Sessions'} · 90 days</Text></View><Text style={v.note}>{completed!=null?`${completed} Sessions`:`${shown} in shown weeks`}</Text></View>
    {weeks.length?<><View style={v.volumeChart}><View style={v.axis}><Text style={v.tiny}>{Math.round(kilogramsToDisplayValue(maximum,unit)).toLocaleString()}</Text><Text style={v.tiny}>0</Text></View><View style={v.volumePlot}><View style={v.volumeColumns}>{weeks.map(w=><View key={w.date} style={v.volumeColumn} accessible accessibilityLabel={`${shortDate(w.date)}: ${performedWeightValue(w.total,unit)} ${unit} times reps, exact Competition lifts`}><View style={v.volumeBar}>{(['deadlift','bench','squat'] as const).map(l=><View key={l} style={{height:`${ledgerBarFraction(w[l],maximum)*100}%`,backgroundColor:C[l]}}/>)}</View></View>)}</View><View style={v.between}><Text style={v.tiny}>{shortDate(weeks[0].date)}</Text><Text style={v.tiny}>{shortDate(weeks.at(-1)!.date)}</Text></View></View></View><View style={v.legend}>{(['squat','bench','deadlift'] as const).map(l=><View style={v.legendItem} key={l}><View style={[v.legendDot,{backgroundColor:C[l]}]}/><Text style={v.tiny}>{l==='bench'?'Bench':l[0].toUpperCase()+l.slice(1)}</Text></View>)}</View><Text style={v.note}>{performedWeightValue(total,unit)} {unit} × reps · shown weeks</Text></>:<Text style={v.note}>{shown} completed Sessions in shown weeks.</Text>}
    {onPress?<Pressable accessibilityRole="button" onPress={onPress} style={v.inlineAction}><Text style={v.link}>Explore training history</Text><Ionicons name="arrow-forward" color={C.accent} size={16}/></Pressable>:null}
  </LedgerSurface>;
}
export function LedgerHistoryCalendar({items,compact=false}:{items:readonly ArchiveItem[];compact?:boolean}) {
  const weeks=ledgerCalendar(items);
  if(!weeks)return null;
  if(compact)return <LedgerSurface style={v.compactCalendar}><View style={v.between}><View><Text style={v.body}>Training rhythm</Text><Text style={v.tiny}>Loaded Sessions</Text></View><Text style={v.tiny}>{shortDate(weeks[0][0].date)} – {shortDate(weeks.at(-1)!.at(-1)!.date)}</Text></View><View style={v.calendarMiniRow}>{['M','T','W','T','F','S','S'].map((d,i)=><Text key={i} style={v.dayLabel}>{d}</Text>)}</View>{weeks.map(week=><View key={week[0].date} style={v.calendarMiniRow}>{week.map(day=><View key={day.date} accessible accessibilityLabel={`${ledgerDate(day.date)}: ${day.count} completed Sessions in loaded history`} style={v.calendarCell}><View style={[v.day,v.miniDay,day.count>0&&v.dayActive]}/></View>)}</View>)}</LedgerSurface>;
  return <LedgerSurface style={[v.panel,compact&&v.compactPanel]}>
    <View style={v.between}><Text style={v.heading}>Training rhythm</Text><Text style={v.note}>Loaded Sessions</Text></View>
    <View style={v.calendarRow}><View style={v.weekLabel}/>{['M','T','W','T','F','S','S'].map((d,i)=><Text key={i} style={v.dayLabel}>{d}</Text>)}</View>
    {weeks.map(week=><View key={week[0].date} style={v.calendarRow}><Text style={[v.note,v.weekLabel]}>{shortDate(week[0].date)}</Text>{week.map(day=><View key={day.date} style={v.calendarCell} accessible accessibilityRole="text" accessibilityLabel={`${ledgerDate(day.date)}: ${day.count} completed Sessions in loaded history`}><View style={[v.day,compact&&v.compactDay,day.count>0&&v.dayActive]}/></View>)}</View>)}
    <Text style={v.tiny}>Loaded Sessions only · earlier records below</Text>
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
export function LedgerPlateArt({lift,renderKey,value,unit,large=false}:{lift:RecordLift;renderKey:number;value:number;unit:LedgerUnit;large?:boolean}) {
  const catalog=resolvePlateStackRender({weight:value,unit})??resolvePlateStackRender({weight:renderKey,unit:'lb'});
  return <LinearGradient colors={[T.material.artFace,T.material.chartFace]} style={[large?v.plateLarge:v.plate,v.plateStage]}><View style={v.full}><Image source={catalog?.imageSource??milestoneRenderAsset(lift,renderKey)} resizeMode="contain" style={[v.full,!catalog&&MILESTONE_RENDER_ORIENTATION_STYLE]} accessibilityIgnoresInvertColors/></View></LinearGradient>;
}
export function LedgerEarnedMedallion({compact=false}:{compact?:boolean}){return <Image source={require('@/assets/images/ledger-cleanup/earned-pr-medallion-v2.png')} style={[v.medallion,compact&&v.medallionCompact]} resizeMode="contain" accessibilityIgnoresInvertColors/>;}

export function LedgerProgressMeter({value,maximum,color=C.accent}:{value:number;maximum:number;color?:string}) {
  return <View style={v.meter}><View style={[v.meterFill,{backgroundColor:color,width:`${ledgerBarFraction(value,maximum)*100}%`}]}/></View>;
}
function shortDate(date:string){const d=new Date(`${date.slice(0,10)}T12:00:00Z`);return d.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});}
const v=StyleSheet.create({
 compactCalendar:{padding:12,gap:5,marginTop:2},calendarMiniRow:{flexDirection:'row',gap:5},miniDay:{height:9},compactPanel:{padding:12,gap:5,marginTop:2},compactDay:{height:12},faceLight:{position:'absolute',top:0,left:0,right:0,height:64},topLight:{position:'absolute',top:0,left:16,right:16,height:StyleSheet.hairlineWidth},surface:{backgroundColor:C.panel,borderWidth:1,borderColor:T.material.line,borderRadius:T.radius.material,overflow:'hidden'},gold:{borderColor:T.material.goldLine},panel:{padding:12,gap:10,marginTop:10},between:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},heading:{fontFamily:T.fonts.bodySemiBold,color:C.text,fontSize:T.type.row,lineHeight:25},body:{fontFamily:T.fonts.bodyMedium,color:C.text,fontSize:T.type.bodySmall,lineHeight:20},note:{color:C.muted,fontSize:T.type.caption,lineHeight:18},tiny:{color:C.muted,fontSize:T.type.micro,lineHeight:16},link:{color:C.accent,fontFamily:T.fonts.bodyMedium,fontSize:T.type.caption},inlineAction:{minHeight:44,alignItems:'center',flexDirection:'row',gap:7},pressed:{opacity:0.76},
 record:{padding:12,minHeight:164,flexDirection:'row',alignItems:'center',gap:10,marginBottom:8},recordCopy:{flex:1,minWidth:0,gap:4},lift:{color:C.text,fontFamily:T.fonts.bodySemiBold,fontSize:T.type.row,lineHeight:24},weightLine:{flexDirection:'row',alignItems:'baseline',gap:4,flexWrap:'wrap',marginTop:3},weight:{fontFamily:T.fonts.bodySemiBold,fontSize:T.type.cardNumber,lineHeight:35,fontVariant:['tabular-nums']},weightUnit:{fontFamily:T.fonts.bodyMedium,fontSize:T.type.lead},compactUnit:{fontSize:T.type.small},noTrend:{justifyContent:'center',alignItems:'center'},
 bars:{flexDirection:'row',gap:6,marginTop:5},barColumn:{flex:1,gap:5,alignItems:'center'},barTrack:{height:65,width:'100%',justifyContent:'flex-end',borderBottomWidth:1,borderBottomColor:C.line},barFill:{width:'100%',borderTopLeftRadius:3,borderTopRightRadius:3,minHeight:0},
 calendarRow:{flexDirection:'row',alignItems:'center',gap:5},weekLabel:{width:43,fontSize:T.type.micro},dayLabel:{flex:1,color:C.muted,textAlign:'center',fontSize:T.type.micro},calendarCell:{flex:1,alignItems:'center'},day:{width:'100%',height:22,maxWidth:32,borderRadius:T.radius.sm,backgroundColor:C.raised},dayActive:{backgroundColor:C.squat},
 muscleRow:{flexDirection:'row',alignItems:'center',gap:15},muscleArt:{width:150,height:176},full:{width:'100%',height:'100%'},preview:{gap:3},muscleValues:{flex:1,gap:17,minWidth:0},muscleValue:{gap:7},meter:{height:6,borderRadius:T.radius.xs,backgroundColor:C.raised,overflow:'hidden'},meterFill:{height:'100%',borderRadius:T.radius.xs,backgroundColor:C.squat},rep:{flexDirection:'row',alignItems:'center',gap:12,minHeight:62},repMiddle:{flex:1,gap:4},plate:{width:124,height:94},plateLarge:{width:180,height:130},plateStage:{borderRadius:T.radius.chip,borderWidth:1,borderColor:T.material.artEdge,padding:5},medallion:{width:118,height:118},medallionCompact:{width:62,height:62},volumePlot:{flex:1,gap:3},volumeChart:{height:106,flexDirection:'row',gap:6},axis:{width:36,paddingBottom:20,justifyContent:'space-between'},volumeColumns:{flex:1,flexDirection:'row',gap:5},volumeColumn:{flex:1},volumeBar:{height:82,justifyContent:'flex-end',overflow:'hidden',borderBottomWidth:1,borderBottomColor:C.strongLine},legend:{flexDirection:'row',justifyContent:'center',gap:16},legendItem:{flexDirection:'row',alignItems:'center',gap:5},legendDot:{height:6,width:6,borderRadius:T.radius.xs},
});
