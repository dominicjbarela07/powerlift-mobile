import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/ui/sl-text';
import { COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';

type TeamPoint = { date: string; team_average?: number | null; low?: number | null; high?: number | null };
type AthletePoint = { date: string; value?: number | null };

export function CoachAnalyticsTrend({ athlete = [], team = [] }: { athlete?: AthletePoint[]; team?: TeamPoint[] }) {
  const geometry = useMemo(() => {
    const dates = team.map((point) => point.date);
    const all = [...team.flatMap((point) => [point.low, point.high, point.team_average]), ...athlete.map((point) => point.value)]
      .filter((value): value is number => value != null && Number.isFinite(value));
    if (dates.length < 2 || !all.length) return null;
    const low = Math.min(...all, 0);
    const high = Math.max(...all, low + 1);
    const span = Math.max(1, high - low);
    const x = (index: number) => 12 + (index / Math.max(1, dates.length - 1)) * 296;
    const y = (value: number) => 125 - ((value - low) / span) * 101;
    const line = (points: (number | null | undefined)[]) => points.reduce<string>((path, value, index) => value == null ? path : `${path}${path ? 'L' : 'M'}${x(index)},${y(value)} `, '').trim();
    const upper = line(team.map((point) => point.high ?? point.team_average));
    const lower = team.map((point) => point.low ?? point.team_average).reverse().reduce<string>((path, value, reverseIndex) => {
      if (value == null) return path;
      const index = team.length - reverseIndex - 1;
      return `${path}L${x(index)},${y(value)} `;
    }, '');
    return {
      athletePath: line(athlete.map((point) => point.value)),
      bandPath: upper && lower ? `${upper} ${lower}Z` : '',
      end: dates.at(-1) || '',
      start: dates[0] || '',
      teamPath: line(team.map((point) => point.team_average)),
      x,
      y,
    };
  }, [athlete, team]);

  if (!geometry) {
    return <View style={styles.empty}><Text style={styles.emptyTitle}>Not enough comparable history</Text><Text style={styles.emptyCopy}>Two real observations are required before this chart is drawn.</Text></View>;
  }
  return (
    <View>
      <Svg height={145} viewBox="0 0 320 145" width="100%">
        {geometry.bandPath ? <Path d={geometry.bandPath} fill="rgba(151, 105, 255, 0.10)" /> : null}
        {geometry.teamPath ? <Path d={geometry.teamPath} fill="none" stroke={COACH_V2.violetBright} strokeWidth={2.4} /> : null}
        {geometry.athletePath ? <Path d={geometry.athletePath} fill="none" stroke={COACH_V2.magenta} strokeWidth={2.8} /> : null}
        {athlete.map((point, index) => point.value == null ? null : <Circle cx={geometry.x(index)} cy={geometry.y(point.value)} fill={COACH_V2.magenta} key={`${point.date}:${index}`} r={3.1} />)}
      </Svg>
      <View style={styles.dates}><Text style={styles.date}>{geometry.start.slice(5)}</Text><Text style={styles.date}>{geometry.end.slice(5)}</Text></View>
      <View style={styles.legend}><Legend color={COACH_V2.magenta} label="Athlete" /><Legend color={COACH_V2.violetBright} label="Team average" /><Legend color="#343844" label="Normal band" /></View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  date: { color: COACH_V2.subtle, fontSize: 9 },
  dates: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -10, paddingHorizontal: 12 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  empty: { minHeight: 145, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyCopy: { color: COACH_V2.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  emptyTitle: { color: COACH_V2.text, fontSize: 14, fontWeight: '800' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { color: COACH_V2.muted, fontSize: 9 },
});
