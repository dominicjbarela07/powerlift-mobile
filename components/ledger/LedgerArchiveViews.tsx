import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardScrollView } from '@/components/keyboard/KeyboardSurface';
import { Text } from '@/components/ui/sl-text';
import { LEDGER as T } from '@/constants/ledger';
import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { analyticalMetricDefinition } from '@/lib/chart-fidelity';
import type { ArchiveItem } from '@/lib/ledger-archive';
import { fetchArchiveDetail } from '@/lib/ledger-archive';
import type { AccomplishmentEvent, LedgerUnit } from '@/lib/ledger-data';
import { eventSource, ledgerDate, performedWeightValue, recordEventLabel, type LedgerSource } from '@/lib/ledger-records';
import { ledgerArchiveFacts, ledgerPrValue } from '@/lib/ledger-history-presentation';
import { archiveBestGroups, archiveDay, archiveItemKey, archiveLoadRecordPoints, archiveMeetAttempts, archiveMonthCells, archiveMonthComplete, archiveMonthItems, archiveMonthLabel, archiveSetTotal, archiveYearGroups, finiteArchiveNumber, shiftArchiveMonth } from '@/lib/ledger-archive-visuals';
import { ledgerArchiveArtwork, ledgerCoreKeyArtwork } from '@/lib/ledger-movement-art';
import { LedgerMovementBackdrop } from './LedgerMovementBackdrop';
import { LedgerSurface } from './LedgerVisuals';
import { useLedgerResource } from './use-ledger-resource';
const C=T.colors;
type Open=(source:LedgerSource)=>void;
const sourceOf=(item:ArchiveItem):LedgerSource=>({type:item.archive_item_type,id:item.source_id});
const shortDate=(date?:string)=>date?ledgerDate(date).replace(/, \d{4}$/,''):'Date unavailable';
function Kicker({children}:React.PropsWithChildren){return <Text style={s.kicker}>{children}</Text>;}
function SourceLink({onPress,label='Open original record'}:{onPress:()=>void;label?:string}){return <Pressable accessibilityRole="button" onPress={onPress} style={s.sourceLink}><Text style={s.link}>{label}</Text><Ionicons name="arrow-forward" color={C.accent} size={17}/></Pressable>;}

export function LedgerTrainingArchive({items,month,hasMore,subject,athleteId,unit,onMonth,open}:{items:ArchiveItem[];month:string;hasMore:boolean;subject:string;athleteId?:number;unit:LedgerUnit;onMonth:(month:string|null)=>void;open:Open}){
 const monthItems=archiveMonthItems(month,items),days=monthItems.map(archiveDay).sort(),[selected,setSelected]=useState(days.at(-1)??'');
 const day=selected.startsWith(month)?selected:days.at(-1)??'',cells=archiveMonthCells(month,items),chosen=monthItems.filter(i=>archiveDay(i)===day),complete=archiveMonthComplete(month,items,hasMore),sets=archiveSetTotal(monthItems);
 return <View style={s.stack} testID="ledger-training-calendar-archive">
  <LedgerSurface style={s.calendar}>
   <View style={s.between}><View><Text style={s.section}>{archiveMonthLabel(month)}</Text><Text style={s.caption}>{monthItems.length} {complete?'Sessions':'Sessions shown'}{sets!=null?` · ${sets} sets`:''}</Text></View><View style={s.controls}><Pressable accessibilityRole="button" accessibilityLabel="Previous archive month" onPress={()=>{setSelected('');onMonth(shiftArchiveMonth(month,-1));}} style={s.icon}><Ionicons name="chevron-back" size={21} color={C.text}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Next archive month" onPress={()=>{setSelected('');onMonth(shiftArchiveMonth(month,1));}} style={s.icon}><Ionicons name="chevron-forward" size={21} color={C.text}/></Pressable></View></View>
   <View style={s.week}>{['M','T','W','T','F','S','S'].map((d,i)=><Text key={i} style={s.weekLabel}>{d}</Text>)}</View>
   <View style={s.calendarGrid}>{cells.map((cell,index)=><View key={cell.date??`blank:${index}`} style={s.cell}>{cell.date?<Pressable accessibilityRole="button" accessibilityLabel={`${ledgerDate(cell.date)}: ${cell.items.length} ${complete?'recorded':'loaded'} Sessions${!complete&&!cell.items.length?'; more pages available':''}`} accessibilityState={{selected:day===cell.date}} onPress={()=>setSelected(cell.date!)} hitSlop={{top:0,bottom:0,left:4,right:4}} style={s.dayHit}><View style={[s.dayTarget,cell.items.length>0&&s.dayRecorded,day===cell.date&&s.daySelected]}><Text style={[s.dayNumber,cell.items.length>0&&s.dayHasEvidence,day===cell.date&&s.dayNumberSelected]}>{cell.day}</Text>{cell.items.length>0?<View style={[s.dayDot,day===cell.date&&s.dayDotSelected]}/>:null}</View></Pressable>:null}</View>)}</View>
   <View style={s.between}><Text style={s.caption}>{complete?'Tap a training day':'Loaded evidence · more in this month'}</Text><Pressable accessibilityRole="button" onPress={()=>{setSelected('');onMonth(null);}} style={s.textTarget}><Text style={s.link}>Recent training</Text></Pressable></View>
  </LedgerSurface>
  <View style={s.between}><Text style={s.section}>{day?shortDate(day):'This month'}</Text><Text style={s.caption}>{chosen.length} {chosen.length===1?'Session':'Sessions'}</Text></View>
  {chosen.length?chosen.map(item=><ArchiveSessionHero key={archiveItemKey(item)} item={item} subject={subject} athleteId={athleteId} unit={unit} open={open}/>):<View style={s.quiet}><Text style={s.body}>{complete?'No recorded Session on this day.':'No Session loaded for this day yet.'}</Text><Text style={s.caption}>Choose another date{hasMore?' or load more of the month below.':'.'}</Text></View>}
  {monthItems.length>1?<><Text style={s.section}>Across the month</Text><View style={s.grid}>{monthItems.map(item=><Pressable key={archiveItemKey(item)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}, ${ledgerDate(archiveDay(item))}`} onPress={()=>open(sourceOf(item))} style={s.gridHalf}><LedgerSurface style={s.sessionTile}><View style={s.between}><Text style={s.tileDay}>{archiveDay(item).slice(-2)}</Text><Ionicons name="arrow-forward" size={17} color={C.muted}/></View><Text numberOfLines={2} style={s.tileTitle}>{item.title}</Text><Text numberOfLines={2} style={s.caption}>{item.subtitle}</Text><Text style={s.tileMetric}>{item.performance?.set_count as number??'—'} <Text style={s.caption}>sets</Text></Text></LedgerSurface></Pressable>)}</View></>:null}
 </View>;
}
export function LedgerTrainingSearch({items,unit,open}:{items:ArchiveItem[];unit:LedgerUnit;open:Open}){
 return <View style={s.stack} testID="ledger-training-search-grid">{archiveYearGroups(items).map(group=><View key={group.year} style={s.stack}><Text style={s.section}>{group.year}</Text><View style={s.grid}>{group.records.map(item=><Pressable key={archiveItemKey(item)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}, ${ledgerDate(archiveDay(item))}`} onPress={()=>open(sourceOf(item))} style={s.gridHalf}><LedgerSurface style={s.sessionTile}><Text style={s.tileDay}>{shortDate(archiveDay(item))}</Text><Text style={s.tileTitle}>{item.title}</Text><Text style={s.caption}>{ledgerArchiveFacts(item,unit).join(' · ')}</Text></LedgerSurface></Pressable>)}</View></View>)}</View>;
}
function ArchiveSessionHero({item,subject,athleteId,unit,open}:{item:ArchiveItem;subject:string;athleteId?:number;unit:LedgerUnit;open:Open}){
 const resource=useLedgerResource(`archive-session-cover:${subject}:${item.source_id}`,()=>fetchArchiveDetail('session',item.source_id,athleteId));
 const detail=resource.data?.item as (ArchiveItem&{sets?:ArchiveItem[]})|undefined,artwork=detail?.sets?.map(ledgerArchiveArtwork).find(Boolean);
 return <Pressable accessibilityRole="button" accessibilityLabel={`Inspect ${item.title}`} onPress={()=>open(sourceOf(item))}><LedgerSurface style={s.sessionHero}>{artwork?<LedgerMovementBackdrop movement={artwork} width={228}/>:null}<View style={[s.heroCopy,artwork&&s.protectedCopy]}><Kicker>RECORDED SESSION</Kicker><Text style={s.heroTitle}>{item.title}</Text><Text numberOfLines={2} style={s.body}>{item.subtitle}</Text><Text style={s.caption}>{ledgerArchiveFacts(item,unit).join(' · ')}</Text><View style={s.heroAction}><Text style={s.link}>Explore the Session</Text><Ionicons name="arrow-forward" color={C.accent} size={18}/></View></View></LedgerSurface></Pressable>;
}

export function LedgerBestArchive({events,unit,open}:{events:AccomplishmentEvent[];unit:LedgerUnit;open:Open}){
 const groups=archiveBestGroups(events),[chosen,setChosen]=useState(groups[0]?.key??'');
 const group=groups.find(g=>g.key===chosen)??groups[0];
 if(!group)return null;
 const points=archiveLoadRecordPoints(group.records,group.key,unit),latest=points.at(-1)?.event??group.records[0],source=eventSource(latest),art=ledgerCoreKeyArtwork(group.key);
 return <View style={s.stack} testID="ledger-personal-best-collection">
  <KeyboardScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.bookRail}>{groups.map(g=><Pressable key={g.key} accessibilityRole="tab" accessibilityState={{selected:g.key===group.key}} onPress={()=>setChosen(g.key)} style={s.bookTarget}><Text style={[s.bookLabel,g.key===group.key&&s.bookSelected]}>{g.label.replace(/^Competition /,'')}</Text><Text style={s.caption}>{g.records.length} records shown</Text></Pressable>)}</KeyboardScrollView>
  <LedgerSurface gold style={s.bestHero}>{art?<LedgerMovementBackdrop movement={art} width={228}/>:null}<View style={[s.heroCopy,art&&s.protectedCopy]}><Kicker>{points.length?'LATEST LOAD RECORD':recordEventLabel(latest).toUpperCase()}</Kicker><Text style={s.recordNumber}>{ledgerPrValue(latest,unit)}</Text><Text style={s.body}>{ledgerDate(latest.workout_date||latest.occurred_at)}</Text>{source?<SourceLink label="View the qualifying set" onPress={()=>open(source)}/>:<Text style={s.caption}>Source link unavailable</Text>}</View></LedgerSurface>
  {points.length?<LedgerSurface style={s.chart}><View style={s.between}><Text style={s.section}>The record trail</Text><Text style={s.caption}>Performed load · {unit}</Text></View><AnalyticalTimeSeriesChart fillArea readableText surfaceColor={T.material.chartFace} series={[{key:group.key,label:'Recorded load PR',color:C.gold,points}]} metric={analyticalMetricDefinition('archive-load-pr',{label:'Recorded load',kind:'weight',unit,includeZero:false,maximumFractionDigits:1})} height={210} selectedInitially="latest" showLegend={false} onPointPress={selection=>{const event=points[selection.index]?.event,link=eventSource(event);if(link)open(link);}}/><Text style={s.caption}>Load records in the pages shown. Estimates stay separate.</Text></LedgerSurface>:null}
  <View style={s.between}><Text style={s.section}>Your record collection</Text><Text style={s.caption}>{group.records.length} shown</Text></View>
  <View style={s.grid}>{group.records.map(event=>{const link=eventSource(event);return <Pressable key={event.id} accessibilityRole={link?'button':undefined} accessibilityLabel={`Inspect ${event.movement_label} ${recordEventLabel(event)}, ${ledgerDate(event.workout_date||event.occurred_at)}`} disabled={!link} onPress={()=>link&&open(link)} style={s.gridHalf}><LedgerSurface style={s.recordTile}><Ionicons name={event.event_type.includes('E1RM')?'analytics-outline':'ribbon-outline'} color={event.event_type.includes('E1RM')?C.muted:C.gold} size={23}/><Text style={s.caption}>{recordEventLabel(event)}{event.event_type.includes('E1RM')?' · calculated':''}</Text><Text style={s.recordTileValue}>{ledgerPrValue(event,unit)}</Text><Text style={s.caption}>{ledgerDate(event.workout_date||event.occurred_at)}</Text>{link?<Ionicons name="arrow-forward" size={16} color={C.muted}/>:null}</LedgerSurface></Pressable>;})}</View>
 </View>;
}

export function LedgerPastArchive({items,unit,open}:{items:ArchiveItem[];unit:LedgerUnit;open:Open}){
 const groups=archiveYearGroups(items),[year,setYear]=useState(groups[0]?.year??''),group=groups.find(g=>g.year===year)??groups[0];if(!group)return null;
 return <View style={s.stack} testID="ledger-past-entry-collection"><View><Text style={s.section}>Your earlier chapters</Text><Text style={s.caption}>Imported and manually preserved performances.</Text></View><KeyboardScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.bookRail}>{groups.map(g=><Pressable key={g.year} accessibilityRole="tab" accessibilityState={{selected:g.year===group.year}} onPress={()=>setYear(g.year)} style={s.bookTarget}><Text style={[s.year,g.year===group.year&&s.bookSelected]}>{g.year}</Text><Text style={s.caption}>{g.records.length} entries shown</Text></Pressable>)}</KeyboardScrollView><View style={s.grid}>{group.records.map(item=><Pressable key={archiveItemKey(item)} accessibilityRole="button" accessibilityLabel={`Open past entry ${item.title}, ${ledgerDate(archiveDay(item))}`} onPress={()=>open(sourceOf(item))} style={s.gridHalf}><LedgerSurface style={s.pastTile}><View style={s.between}><Ionicons name="document-text-outline" color={C.teal} size={24}/><Text style={s.sourceBadge}>{String(item.source_type).includes('manual')||String(item.provenance_label).toLowerCase().includes('manual')?'MANUAL':'IMPORTED'}</Text></View><Text style={s.tileTitle}>{item.title}</Text><Text style={s.recordTileValue}>{ledgerArchiveFacts(item,unit)[0]??'Original evidence'}</Text><Text style={s.caption}>{shortDate(archiveDay(item))}</Text><Text style={s.caption}>{item.performance?.sets as number??'—'} recorded {item.performance?.sets===1?'set':'sets'}</Text></LedgerSurface></Pressable>)}</View></View>;
}

export function LedgerFilmArchive({items,posters,unit,open,play,loadingPosters}:{items:ArchiveItem[];posters:Record<number,string>;unit:LedgerUnit;open:Open;play:(id:number)=>void;loadingPosters?:boolean}){
 return <View style={s.stack} testID="ledger-film-gallery"><View style={s.between}><View><Text style={s.section}>The film room</Text><Text style={s.caption}>Your saved lifts, ready to replay.</Text></View><Ionicons name="film-outline" color={C.teal} size={27}/></View>{loadingPosters?<ActivityIndicator accessibilityLabel="Loading film previews" color={C.teal}/>:null}<View style={s.grid}>{items.map(item=><FilmTile key={archiveItemKey(item)} item={item} poster={posters[item.source_id]} unit={unit} play={()=>play(item.source_id)} open={()=>open(sourceOf(item))}/>)}</View></View>;
}
function FilmTile({item,poster,unit,play,open}:{item:ArchiveItem;poster?:string;unit:LedgerUnit;play:()=>void;open:()=>void}){
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[poster]);
 return <View style={s.gridHalf}><Pressable accessibilityRole="button" accessibilityLabel={`Play ${item.title}, ${ledgerDate(archiveDay(item))}`} onPress={play} style={s.filmPoster}>{poster&&!failed?<Image source={{uri:poster}} contentFit="contain" cachePolicy="memory-disk" style={StyleSheet.absoluteFillObject} onError={()=>setFailed(true)}/>:<View style={s.posterMissing}><Ionicons name="videocam-outline" color={C.teal} size={35}/><Text style={s.caption}>{failed?'Preview unavailable':'Play saved film'}</Text></View>}<View style={s.playSeal}><Ionicons name="play" size={19} color={C.text}/></View><View style={s.filmTag}><Text style={s.filmTagText}>{item.status==='reviewed'?'Reviewed':'Awaiting review'}</Text></View></Pressable><Text numberOfLines={2} style={s.tileTitle}>{item.title}</Text><Text style={s.body}>{ledgerArchiveFacts(item,unit)[0]}</Text><Text numberOfLines={2} style={s.caption}>{item.subtitle}</Text><Text style={s.caption}>{ledgerDate(archiveDay(item))}</Text><SourceLink label="Set & feedback" onPress={open}/></View>;
}


export function LedgerMeetArchive({items,unit,open}:{items:ArchiveItem[];unit:LedgerUnit;open:Open}){
 const [selected,setSelected]=useState(items[0]?.source_id),item=items.find(i=>i.source_id===selected)??items[0];if(!item)return null;
 const final=['completed','archived'].includes(String(item.status)),summary=final?item.meet_context?.result_summary as Record<string,unknown>|undefined:undefined,total=final&&finiteArchiveNumber(summary?.total_kg)?summary.total_kg:null,attempts=archiveMeetAttempts(item);
 return <View style={s.stack} testID="ledger-meet-scorebook"><View><Text style={s.section}>The competition book</Text><Text style={s.caption}>Meet totals, every attempt and the original result.</Text></View><KeyboardScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.bookRail}>{items.map(meet=><Pressable key={meet.source_id} accessibilityRole="tab" accessibilityState={{selected:meet.source_id===item.source_id}} onPress={()=>setSelected(meet.source_id)} style={s.meetBookmark}><Text style={[s.bookLabel,meet.source_id===item.source_id&&s.bookSelected]}>{meet.title}</Text><Text style={s.caption}>{ledgerDate(archiveDay(meet))}</Text></Pressable>)}</KeyboardScrollView>
 <LedgerSurface gold style={s.meetCard}><View style={s.between}><Kicker>{final?'COMPETITION RESULT':'MEET RECORD'}</Kicker><Ionicons name="trophy-outline" color={C.gold} size={31}/></View><Text style={s.heroTitle}>{item.title}</Text><Text style={s.body}>{ledgerDate(archiveDay(item))}</Text><Text style={s.caption}>{[item.meet_context?.federation,item.meet_context?.weight_class,item.meet_context?.location].filter(Boolean).join(' · ')}</Text><View style={s.meetTotal}><Text style={s.recordNumber}>{performedWeightValue(total,unit)}</Text>{total!=null?<Text style={s.unit}>{unit} total</Text>:<Text style={s.caption}>No final total recorded</Text>}</View><View style={s.meetStats}>{[['best_squat_kg','Squat','squat'],['best_bench_kg','Bench','bench'],['best_deadlift_kg','Deadlift','deadlift']].map(([key,label,tone])=><View key={key} style={s.stat}><Text style={[s.liftBest,{color:C[tone as 'squat']}]}>{finiteArchiveNumber(summary?.[key])?performedWeightValue(summary[key] as number,unit):'—'}</Text><Text style={s.caption}>{label} · {unit}</Text></View>)}</View>
 <View style={s.between}><Text style={s.section}>The attempts</Text><Text style={s.caption}>{finiteArchiveNumber(summary?.attempts_made)?`${summary.attempts_made}/${summary?.attempts_taken??'—'} made`:unit}</Text></View><View style={s.attemptHeader}><Text style={s.liftLabel}/>{[1,2,3].map(n=><Text key={n} style={s.attemptColumn}>Attempt {n}</Text>)}</View>{attempts.map(lift=><View key={lift.key} style={s.attemptRow}><Text style={[s.liftLabel,{color:C[lift.tone]}]}>{lift.label}</Text>{lift.attempts.map(a=><View key={a.number} style={s.attempt}><Text style={[s.attemptValue,a.state==='made'&&s.made,a.state==='missed'&&s.missed]}>{performedWeightValue(a.kg,unit)}</Text><Ionicons name={a.state==='made'?'checkmark':a.state==='missed'?'close':'remove'} color={a.state==='made'?C.success:a.state==='missed'?C.danger:C.muted} size={15}/></View>)}</View>)}<Text style={s.caption}>Attempt weights in {unit} · ✓ made · × missed · — unrecorded</Text><SourceLink label="Open complete meet record" onPress={()=>open(sourceOf(item))}/></LedgerSurface>
 </View>;
}
const s=StyleSheet.create({
 stack:{gap:16},
 between:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
 section:{color:C.text,fontFamily:T.fonts.bodySemiBold,fontSize:T.type.sectionCompact,lineHeight:26},
 body:{color:C.secondary,fontSize:T.type.small,lineHeight:21},
 caption:{color:C.muted,fontSize:T.type.caption,lineHeight:18},
 kicker:{color:C.muted,fontFamily:T.fonts.bodyMedium,fontSize:T.type.micro,letterSpacing:1,lineHeight:17},
 link:{color:C.accent,fontFamily:T.fonts.bodyMedium,fontSize:T.type.small,lineHeight:20},
 controls:{flexDirection:'row'},
 icon:{width:44,height:44,justifyContent:'center',alignItems:'center'},
 textTarget:{minHeight:36,justifyContent:'center'},
 calendar:{padding:14,gap:8},
 week:{flexDirection:'row'},
 weekLabel:{flex:1,textAlign:'center',color:C.muted,fontSize:T.type.micro,lineHeight:20},
 calendarGrid:{flexDirection:'row',flexWrap:'wrap'},
 cell:{width:'14.285714%',height:44,alignItems:'center',justifyContent:'center'},
 dayHit:{width:'100%',height:44,alignItems:'center',justifyContent:'center'},
 dayTarget:{width:35,height:35,alignItems:'center',justifyContent:'center',borderRadius:T.radius.material,gap:2},
 dayNumber:{color:C.muted,fontSize:T.type.bodySmall,fontVariant:['tabular-nums']},
 dayRecorded:{backgroundColor:C.action},
 daySelected:{backgroundColor:C.accent},
 dayHasEvidence:{color:C.text,fontFamily:T.fonts.bodySemiBold},
 dayNumberSelected:{color:C.canvas},
 dayDot:{width:3,height:3,borderRadius:T.radius.xs,backgroundColor:C.accent},
 dayDotSelected:{backgroundColor:C.canvas},
 quiet:{gap:6,paddingVertical:10},
 grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:12,alignItems:'flex-start'},
 gridHalf:{width:'48%',minWidth:0,gap:5},
 sessionTile:{padding:14,minHeight:158,gap:8},
 tileDay:{color:C.accent,fontFamily:T.fonts.bodySemiBold,fontSize:T.type.heading,lineHeight:34},
 tileTitle:{color:C.text,fontFamily:T.fonts.bodySemiBold,fontSize:T.type.bodyStrong,lineHeight:23},
 tileMetric:{color:C.text,fontFamily:T.fonts.bodySemiBold,fontSize:T.type.section,lineHeight:26},
 sessionHero:{minHeight:204,padding:17},
 heroCopy:{gap:9,justifyContent:'center',minHeight:170},
 protectedCopy:{width:'57%'},
 heroTitle:{color:C.text,fontFamily:T.fonts.bodySemiBold,fontSize:T.type.section,lineHeight:28},
 heroAction:{flexDirection:'row',gap:8,alignItems:'center',marginTop:6},
 bookRail:{gap:18,paddingBottom:4},
 bookTarget:{minHeight:52,justifyContent:'center',gap:5,paddingVertical:5},
 bookLabel:{color:C.muted,fontFamily:T.fonts.bodyMedium,fontSize:T.type.body,lineHeight:22},
 bookSelected:{color:C.text,fontFamily:T.fonts.bodySemiBold},
 bestHero:{minHeight:210,padding:18},
 recordNumber:{color:C.text,fontFamily:T.fonts.bodySemiBold,fontSize:T.type.cardNumber,lineHeight:42,fontVariant:['tabular-nums']},
 sourceLink:{minHeight:44,alignItems:'center',flexDirection:'row',gap:8},
 chart:{padding:14,gap:9},
 recordTile:{padding:14,minHeight:168,gap:9},
 recordTileValue:{color:C.text,fontFamily:T.fonts.bodySemiBold,fontSize:T.type.lead,lineHeight:25,fontVariant:['tabular-nums']},
 year:{color:C.muted,fontFamily:T.fonts.bodySemiBold,fontSize:T.type.studio,lineHeight:47},
 pastTile:{padding:14,minHeight:192,gap:11},
 sourceBadge:{color:C.teal,fontSize:T.type.micro,fontFamily:T.fonts.bodyMedium,letterSpacing:.4},
 filmPoster:{aspectRatio:9/16,backgroundColor:C.inset,borderRadius:T.radius.inner,overflow:'hidden'},
 posterMissing:{flex:1,alignItems:'center',justifyContent:'center',gap:12,padding:12},
 playSeal:{position:'absolute',left:12,bottom:12,width:36,height:36,borderRadius:T.radius.material,backgroundColor:C.canvas,justifyContent:'center',alignItems:'center'},
 filmTag:{position:'absolute',top:10,left:8,right:8,alignItems:'flex-start'},
 filmTagText:{paddingVertical:4,paddingHorizontal:7,backgroundColor:C.canvas,color:C.text,fontSize:T.type.micro,borderRadius:T.radius.xs},
 meetBookmark:{width:190,minHeight:65,gap:6,justifyContent:'center'},
 meetCard:{padding:18,gap:13},
 meetTotal:{flexDirection:'row',alignItems:'baseline',gap:7,paddingVertical:8},
 unit:{color:C.secondary,fontSize:T.type.bodyStrong},
 meetStats:{flexDirection:'row',borderTopWidth:StyleSheet.hairlineWidth,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:C.line,paddingVertical:14,gap:12},
 stat:{flex:1,gap:5},
 liftBest:{fontFamily:T.fonts.bodySemiBold,fontSize:T.type.section,lineHeight:28},
 attemptHeader:{flexDirection:'row',alignItems:'center',gap:5},
 attemptRow:{flexDirection:'row',alignItems:'center',gap:5},
 liftLabel:{width:48,color:C.muted,fontSize:T.type.caption,fontFamily:T.fonts.bodyMedium},
 attemptColumn:{flex:1,textAlign:'center',color:C.muted,fontSize:T.type.micro},
 attempt:{flex:1,alignItems:'center',justifyContent:'center',gap:3,minHeight:52,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line},
 attemptValue:{color:C.muted,fontFamily:T.fonts.bodyMedium,fontSize:T.type.bodySmall,fontVariant:['tabular-nums']},
 made:{color:C.success},
 missed:{color:C.danger}
});
