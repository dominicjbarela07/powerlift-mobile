import { useRouter } from 'expo-router';
import { useAthleteLedgerSubject } from './athlete-ledger-subject';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput } from '@/components/ui/sl-text';
import SetVideoPlayerModal from '@/components/SetVideoPlayerModal';
import { useAuth } from '@/context/AuthContext';
import { getAthleteVideoArchive, getCoachVideoArchive } from '@/lib/api';
import { LEDGER as T } from '@/constants/ledger';
import { canonicalPrHistory } from '@/lib/ledger-rewards';
import type { LedgerUnit } from '@/lib/ledger-data';
import type { ArchiveItem } from '@/lib/ledger-archive';
import { ledgerDate, type LedgerSource } from '@/lib/ledger-records';
import { historyItemDateWithin, type HistoryDateRange } from '@/lib/ledger-history-presentation';
import { archiveMonthBounds, latestArchiveMonth } from '@/lib/ledger-archive-visuals';
import { fromLocalYMD, toLocalYMD } from '@/lib/coach-calendar';
import { useLedgerHistory, type HistoryFilter } from './use-ledger-history';
import { useLedgerResource } from './use-ledger-resource';
import { LedgerContextFilter } from './LedgerContextFilter';
import { LedgerTrainingArchive, LedgerTrainingSearch, LedgerBestArchive, LedgerPastArchive, LedgerFilmArchive, LedgerMeetArchive } from './LedgerArchiveViews';
const C = T.colors;
export type LedgerHistoryFocus={nonce:number;query?:string;from?:string;to?:string};

export function LedgerHistoryPane({subject,athleteId,unit,open,filter,setFilter,focus}:{filter:HistoryFilter;setFilter:(filter:HistoryFilter)=>void;subject:string;athleteId?:number;unit:LedgerUnit;open:(source:LedgerSource)=>void;focus?:LedgerHistoryFocus}) {
 const router=useRouter(),ledgerSubject=useAthleteLedgerSubject();
 const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[range,setRange]=useState<HistoryDateRange>({}),[month,setMonth]=useState<string|null>(null);
 const [searchOpen,setSearchOpen]=useState(false),[datesOpen,setDatesOpen]=useState(false),[picker,setPicker]=useState<'from'|'to'|null>(null);
 useEffect(()=>{const timer=setTimeout(()=>setSearch(query.trim()),250);return()=>clearTimeout(timer);},[query]);
 useEffect(()=>{if(focus){setQuery(focus.query??'');setSearch(focus.query??'');setRange({from:focus.from,to:focus.to});setMonth(null);setSearchOpen(Boolean(focus.query));setDatesOpen(false);setPicker(null);}},[focus]);
 const showSearch=searchOpen||Boolean(query||search);
 const hasDates=Boolean(range.from||range.to),scoped=Boolean(search||hasDates);
 const effectiveRange=filter==='training'&&month&&!scoped?archiveMonthBounds(month):range;
 const data=useLedgerHistory(subject,athleteId,filter,filter==='prs'?'':search,effectiveRange);
 const events=canonicalPrHistory(data.events).filter(e=>(!search||`${e.movement_label} ${e.workout_title} ${ledgerDate(e.workout_date)}`.toLowerCase().includes(search.toLowerCase()))&&historyItemDateWithin(e.workout_date||e.occurred_at,range));
 const count=filter==='prs'?events.length:data.items.length;
 const visibleMonth=month??latestArchiveMonth(data.items)??toLocalYMD(new Date()).slice(0,7);
 const chooseDate=(date:Date)=>{if(!picker)return;const value=toLocalYMD(date);setRange(old=>picker==='from'?{...old,from:value,to:old.to&&value>old.to?value:old.to}:{...old,to:value,from:old.from&&value<old.from?value:old.from});setPicker(null);};
 return <View testID="ledger-connected-history" style={s.page}>
  <View style={s.toolbar}><LedgerContextFilter section="history" value={filter} onChange={setFilter}/><View style={s.tools}><Pressable accessibilityRole="button" accessibilityLabel="Search history" accessibilityState={{expanded:showSearch}} onPress={()=>setSearchOpen(true)} style={s.toolIcon}><Ionicons name="search-outline" color={showSearch?C.accent:C.secondary} size={21}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Filter history by date" accessibilityState={{expanded:datesOpen}} onPress={()=>{Keyboard.dismiss();setDatesOpen(v=>!v);setPicker(null);}} style={s.toolIcon}><Ionicons name="calendar-outline" size={21} color={hasDates?C.accent:C.secondary}/></Pressable></View></View>
  {showSearch?<View style={s.searchRow}><View style={[s.search,s.flex]}><Ionicons name="search-outline" color={C.muted} size={18}/><TextInput autoFocus accessibilityLabel="Search training history" placeholder={filter==='prs'?'Find a movement in loaded records':filter==='media'?'Find a lift in your film':filter==='competition'?'Find a meet':filter==='imports'?'Find earlier training':'Find a movement or Session'} placeholderTextColor={C.muted} value={query} onChangeText={setQuery} style={s.input}/>{query?<Pressable accessibilityRole="button" accessibilityLabel="Clear history search" onPress={()=>setQuery('')} style={s.clear}><Ionicons name="close" size={19} color={C.secondary}/></Pressable>:null}</View><Pressable accessibilityRole="button" accessibilityLabel="Cancel history search" onPress={()=>{Keyboard.dismiss();setQuery('');setSearch('');setSearchOpen(false);}} style={s.clear}><Text style={s.small}>Cancel</Text></Pressable></View>:null}
  {hasDates&&!datesOpen?<View style={s.between}><Text style={[s.caption,s.flex]}>{range.from?ledgerDate(range.from):'Any start'} – {range.to?ledgerDate(range.to):'Any end'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Clear history dates" onPress={()=>setRange({})} style={s.clear}><Ionicons name="close-circle-outline" size={21} color={C.secondary}/></Pressable></View>:null}
  {datesOpen?<View style={s.datePanel}><View style={s.between}><Text style={s.heading}>Performed dates</Text><Pressable accessibilityRole="button" onPress={()=>{setDatesOpen(false);setPicker(null);}} style={s.retry}><Text style={s.small}>Done</Text></Pressable></View><View style={s.searchRow}>{(['from','to'] as const).map(key=><Pressable key={key} accessibilityRole="button" accessibilityLabel={key==='from'?'Choose history start date':'Choose history end date'} onPress={()=>setPicker(key)} style={[s.dateField,picker===key&&s.active]}><Text style={s.caption}>{key==='from'?'FROM':'THROUGH'}</Text><Text style={s.small}>{range[key]?ledgerDate(range[key]):'Any date'}</Text></Pressable>)}</View>{picker?<DateTimePicker value={range[picker]?fromLocalYMD(range[picker]!):new Date()} mode="date" display={Platform.OS==='ios'?'inline':'default'} themeVariant="dark" accentColor={C.accent} onChange={(event,date)=>{if(event.type==='dismissed')setPicker(null);else if(date)chooseDate(date);}}/>:null}<Pressable accessibilityRole="button" onPress={()=>{setRange({});setPicker(null);}} style={s.retry}><Text style={s.small}>Clear dates</Text></Pressable></View>:null}

  {data.loading?<ActivityIndicator accessibilityLabel="Loading training history" color={C.accent} style={s.loading}/>:null}
  {data.error?<View style={s.notice}><Text style={s.copy}>{[401,403].includes(Number((data.error as {status?:number})?.status))?'History is not available to this account.':'History could not be refreshed. Your saved records are safe.'}</Text><Pressable accessibilityRole="button" onPress={data.reload} style={s.retry}><Text style={s.small}>Try again</Text></Pressable></View>:null}
  {!data.loading&&!data.error&&!count&&!(filter==='training'&&!scoped)?<View style={s.empty}><Text style={s.heading}>{scoped?'No matching records in this view.':'No records here yet.'}</Text><Text style={s.copy}>{filter==='prs'&&data.cursor?'Older personal bests are available below.':scoped?'Try another movement or widen the dates.':'Saved evidence will appear with its original context.'}</Text></View>:null}
  {!data.loading&&(!data.error||count>0)?<>
   {filter==='training'?(scoped?<LedgerTrainingSearch items={data.items} unit={unit} open={open}/>:<LedgerTrainingArchive items={data.items} month={visibleMonth} hasMore={Boolean(data.cursor)} subject={subject} athleteId={athleteId} unit={unit} onMonth={setMonth} open={open}/>):null}
   {filter==='prs'?<LedgerBestArchive events={events} unit={unit} open={open}/>:null}
   {filter==='imports'?<LedgerPastArchive items={data.items} unit={unit} open={open}/>:null}
   {filter==='media'?<FilmCollection key={subject} items={data.items} subject={subject} athleteId={athleteId} unit={unit} open={open}/>:null}
   {filter==='competition'?<LedgerMeetArchive items={data.items} unit={unit} open={open}/>:null}
  </>:null}
  {!data.loading&&count>0?<Text style={s.coverage}>{count} {filter==='prs'?'records':filter==='media'?'films':filter==='competition'?'meets':'entries'} loaded{data.cursor?' · more available':''}{scoped?' · filtered':''}</Text>:null}
  {data.cursor?<Pressable accessibilityRole="button" disabled={data.loadingMore} onPress={()=>void data.more()} style={s.more}><Text style={s.small}>{data.loadingMore?'Loading older records…':data.error?'Retry older records':'Load older records'}</Text><Ionicons name="arrow-down" size={17} color={C.secondary}/></Pressable>:null}
  <View style={s.archiveTools}><Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/(tabs)/ledger/journey',params:ledgerSubject.routeParams} as never)} style={s.tool}><Ionicons name="git-branch-outline" size={19} color={C.muted}/><Text style={s.small}>Career chapters</Text><Ionicons name="chevron-forward" size={16} color={C.muted}/></Pressable><Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/(tabs)/ledger/archive',params:{...ledgerSubject.routeParams,displayUnit:unit}} as never)} style={s.tool}><Ionicons name="options-outline" size={19} color={C.muted}/><Text style={s.small}>All archive filters</Text><Ionicons name="chevron-forward" size={16} color={C.muted}/></Pressable></View>
  {filter==='prs'?<Text style={s.caption}>Search and dates apply to the loaded personal-best pages. Load older records to continue.</Text>:null}
 </View>;
}
function FilmCollection({items,subject,athleteId,unit,open}:{items:ArchiveItem[];subject:string;athleteId?:number;unit:LedgerUnit;open:(source:LedgerSource)=>void}){
 const {user}=useAuth(),[video,setVideo]=useState<number|null>(null);
 const posters=useLedgerResource(`archive-posters:${subject}:${athleteId??'self'}:${user?.role}`,async()=>{
  const own=user?.athlete_id??user?.self_athlete_id,target=athleteId??own;
  const response=user?.role==='coach'&&target?await getCoachVideoArchive({athlete_id:target,per_page:100}):user?.role==='athlete'&&(athleteId==null||athleteId===own)?await getAthleteVideoArchive():null;
  if(!response?.ok||!response.json?.ok)throw new Error('Previews unavailable');
  return Object.fromEntries((Array.isArray(response.json.videos)?response.json.videos:[]).flatMap((v:{id?:number;thumbnail_url?:string})=>typeof v.id==='number'&&typeof v.thumbnail_url==='string'&&v.thumbnail_url?[[v.id,v.thumbnail_url]]:[])) as Record<number,string>;
 });
 return <><LedgerFilmArchive items={items} posters={posters.data??{}} unit={unit} open={open} play={setVideo} loadingPosters={posters.loading}/>{posters.error?<Pressable accessibilityRole="button" onPress={posters.load} style={s.retry}><Text style={s.small}>Retry film previews</Text></Pressable>:null}<SetVideoPlayerModal visible={video!==null} videoId={video} allowExport={athleteId==null||athleteId===user?.athlete_id||athleteId===user?.self_athlete_id?undefined:false} onClose={()=>setVideo(null)}/></>;
}
const s=StyleSheet.create({
 page:{gap:8},toolbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},tools:{flexDirection:'row'},toolIcon:{width:44,minHeight:44,alignItems:'center',justifyContent:'center'},
 copy:{color:C.secondary,fontSize:T.type.small,lineHeight:21},
 caption:{color:C.muted,fontSize:T.type.caption,lineHeight:19},
 small:{color:C.text,fontFamily:T.fonts.bodyMedium,fontSize:T.type.small},
 heading:{color:C.text,fontFamily:T.fonts.bodySemiBold,fontSize:T.type.body,lineHeight:23},
 between:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
 searchRow:{flexDirection:'row',gap:9,alignItems:'center'},
 coverage:{color:C.muted,fontSize:T.type.caption,lineHeight:18},
 archiveTools:{gap:2,marginTop:12,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.line},
 tool:{minHeight:50,flexDirection:'row',alignItems:'center',gap:9},
 search:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:T.radius.control,paddingLeft:13},
 input:{flex:1,minWidth:0,minHeight:50,color:C.text,fontFamily:T.fonts.body,fontSize:T.type.body,paddingVertical:12},
 clear:{minHeight:44,minWidth:44,alignItems:'center',justifyContent:'center'},
 dateButton:{height:52,width:50,alignItems:'center',justifyContent:'center',backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:T.radius.control},
 datePanel:{gap:12,padding:14,backgroundColor:C.panel,borderWidth:1,borderColor:C.strongLine,borderRadius:T.radius.card},
 dateField:{flex:1,gap:5,minHeight:65,padding:10,borderWidth:1,borderColor:C.line,borderRadius:T.radius.chip},
 active:{backgroundColor:C.action,borderColor:T.material.accentEdge},
 loading:{padding:28},
 notice:{paddingVertical:20,gap:12},
 retry:{minHeight:44,alignSelf:'flex-start',justifyContent:'center',paddingHorizontal:15,borderWidth:1,borderColor:C.strongLine,borderRadius:T.radius.control},
 empty:{paddingVertical:28,gap:10},
 flex:{flex:1,gap:5,minWidth:0},
 more:{minHeight:48,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,borderWidth:1,borderColor:C.line,borderRadius:T.radius.control,marginVertical:12}
});
