import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { LEDGER as T } from '@/constants/ledger';
import { fetchReportedBodyweightHistory, type ReportedBodyweightPage } from '@/lib/ledger-journey';
import { ledgerDate, performedWeightValue, type LedgerSource } from '@/lib/ledger-records';
import type { LedgerUnit } from '@/lib/ledger-data';
import { useLedgerResource } from './use-ledger-resource';

/** Full cursor-backed measurements, retaining each report's original Session. */
export function LedgerBodyweightHistory({ athleteId, unit, open }: {
  athleteId?: number; unit: LedgerUnit; open: (source: LedgerSource) => void;
}) {
  const first = useLedgerResource(`bodyweight-history:${athleteId ?? 'self'}`, () => fetchReportedBodyweightHistory({ athleteId, limit: 24 }));
  const [older, setOlder] = useState<ReportedBodyweightPage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const firstPage = useRef(first.data);
  firstPage.current = first.data;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setOlder([]); }, [first.data]);
  const page = older.at(-1) ?? first.data;
  const items = [...new Map([...(first.data?.items ?? []), ...older.flatMap(value => value.items)].map(item => [item.id, item])).values()];
  const more = async () => {
    if (inFlight.current || !page?.next_cursor) return;
    inFlight.current = true;
    const snapshot = first.data;
    setBusy(true);
    setError(false);
    try {
      const next = await fetchReportedBodyweightHistory({ athleteId, limit: 24, cursor: page.next_cursor });
      if (alive.current && firstPage.current === snapshot) setOlder(previous => [...previous, next]);
    } catch { if (alive.current && firstPage.current === snapshot) setError(true); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  return <View style={s.history} testID="ledger-complete-bodyweight-history">
    <Text style={s.heading}>Reported bodyweight archive</Text>
    {first.loading ? <ActivityIndicator accessibilityLabel="Loading reported bodyweight" color={T.colors.teal} /> : null}
    {first.error ? <Pressable accessibilityRole="button" onPress={first.load} style={s.action}><Text style={s.link}>Retry bodyweight history</Text></Pressable> : null}
    {!first.loading && !first.error ? <Text style={s.caption}>{items.length} reports loaded{page?.has_more ? ' · more available' : ' · complete submitted record'}</Text> : null}
    {items.map(item => <Pressable key={item.id} accessibilityRole={item.workout_id ? 'button' : undefined} disabled={!item.workout_id} accessibilityLabel={`Bodyweight ${performedWeightValue(item.reported_bodyweight_kg, unit)} ${unit}, ${ledgerDate(item.training_date)}`} onPress={() => item.workout_id && open({ type: 'session', id: item.workout_id })} style={s.row}>
      <View style={s.flex}><Text style={s.body}>{ledgerDate(item.training_date)}</Text><Text style={s.caption}>{item.session?.label ?? (item.workout_id ? 'Original Session' : 'Daily check-in')}</Text></View>
      <Text style={s.body}>{performedWeightValue(item.reported_bodyweight_kg, unit)} {unit}</Text>
    </Pressable>)}
    {error ? <Text accessibilityRole="alert" style={s.caption}>Earlier reports could not be loaded. Retry below.</Text> : null}
    {page?.has_more ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void more()} style={s.action}><Text style={s.link}>{busy ? 'Loading earlier reports…' : error ? 'Retry earlier reports' : 'Load earlier reports'}</Text></Pressable> : null}
  </View>;
}
const s = StyleSheet.create({
  history: { gap: 8, marginTop: 8 }, heading: { color: T.colors.text, fontFamily: T.fonts.bodySemiBold, fontSize: 17 },
  body: { color: T.colors.text, fontSize: 14, lineHeight: 21 }, caption: { color: T.colors.muted, fontSize: 12, lineHeight: 18 },
  flex: { flex: 1, gap: 3 }, row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: T.colors.line },
  action: { minHeight: 48, justifyContent: 'center' }, link: { color: T.colors.accent, fontSize: 14 },
});
