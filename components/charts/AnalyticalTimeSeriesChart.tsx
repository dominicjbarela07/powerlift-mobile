import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/ui/sl-text';
import {
  buildNumericScale,
  buildTimeTicks,
  formatAnalyticalValue,
  type AnalyticalMetricDefinition,
} from '@/lib/chart-fidelity';

export type AnalyticalChartPoint = Readonly<{
  date: string;
  value?: number | null;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type AnalyticalChartSeries = Readonly<{
  key: string;
  label: string;
  color: string;
  points: readonly AnalyticalChartPoint[];
}>;

export type AnalyticalChartBandPoint = Readonly<{
  date: string;
  low?: number | null;
  high?: number | null;
}>;

export type AnalyticalSelection = Readonly<{
  date: string;
  index: number;
  values: readonly Readonly<{ key: string; label: string; color: string; value: number; meta?: Readonly<Record<string, unknown>> }>[];
}>;

type Props = Readonly<{
  series: readonly AnalyticalChartSeries[];
  metric: AnalyticalMetricDefinition;
  band?: readonly AnalyticalChartBandPoint[];
  bandLabel?: string;
  height?: number;
  emptyTitle?: string;
  emptyBody?: string;
  showLegend?: boolean;
  selectedInitially?: 'latest' | 'none';
  tooltipRows?: (selection: AnalyticalSelection) => readonly string[];
  formatSeriesValue?: (seriesKey: string, value: number) => string;
  testID?: string;
}>;

type NormalizedPoint = Readonly<{
  date: string;
  timestamp: number;
  x: number;
}>;

function timestamp(value: string) {
  const parsed = Date.parse(value.includes('T') ? value : `${value.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fullDate(value: string) {
  const parsed = new Date(timestamp(value));
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function pathFor(points: readonly Readonly<{ x: number; y: number }>[]) {
  return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
}

export function AnalyticalTimeSeriesChart({
  series,
  metric,
  band = [],
  bandLabel,
  height = 220,
  emptyTitle = 'Not enough history',
  emptyBody = 'At least one real observation is required.',
  showLegend = true,
  selectedInitially = 'latest',
  tooltipRows,
  formatSeriesValue,
  testID,
}: Props) {
  const [width, setWidth] = useState(320);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const plot = useMemo(() => {
    const dateMap = new Map<string, number>();
    series.forEach((item) => item.points.forEach((point) => {
      const time = timestamp(point.date);
      if (time > 0 && point.value != null && Number.isFinite(Number(point.value))) dateMap.set(point.date, time);
    }));
    band.forEach((point) => {
      const time = timestamp(point.date);
      if (time > 0 && (Number.isFinite(Number(point.low)) || Number.isFinite(Number(point.high)))) dateMap.set(point.date, time);
    });
    const dates = [...dateMap.entries()].sort((left, right) => left[1] - right[1]);
    const values = [
      ...series.flatMap((item) => item.points.map((point) => Number(point.value)).filter(Number.isFinite)),
      ...band.flatMap((point) => [Number(point.low), Number(point.high)].filter(Number.isFinite)),
    ];
    if (!dates.length || !values.length) return null;
    const left = width < 330 ? 43 : 48;
    const right = 12;
    const top = 54;
    const bottom = 30;
    const chartHeight = Math.max(78, height - top - bottom);
    const scale = buildNumericScale(values, metric, height < 180 ? 4 : 5);
    const minTime = dates[0][1];
    const maxTime = dates.at(-1)![1];
    const timeSpan = Math.max(1, maxTime - minTime);
    const x = (time: number) => left + ((time - minTime) / timeSpan) * Math.max(1, width - left - right);
    const y = (value: number) => top + ((scale.maximum - value) / Math.max(1e-9, scale.maximum - scale.minimum)) * chartHeight;
    const normalizedDates: NormalizedPoint[] = dates.map(([date, dateTimestamp]) => ({ date, timestamp: dateTimestamp, x: dates.length === 1 ? left + (width - left - right) / 2 : x(dateTimestamp) }));
    const rows = series.map((item) => ({
      ...item,
      points: item.points.flatMap((point) => {
        const value = Number(point.value);
        const time = timestamp(point.date);
        return !Number.isFinite(value) || time <= 0 ? [] : [{ ...point, value, x: dates.length === 1 ? normalizedDates[0].x : x(time), y: y(value) }];
      }),
    }));
    const bandRows = band.flatMap((point) => {
      const low = Number(point.low);
      const high = Number(point.high);
      const time = timestamp(point.date);
      return !Number.isFinite(low) || !Number.isFinite(high) || time <= 0 ? [] : [{ date: point.date, low, high, x: dates.length === 1 ? normalizedDates[0].x : x(time), lowY: y(low), highY: y(high) }];
    });
    const upper = pathFor(bandRows.map((point) => ({ x: point.x, y: point.highY })));
    const lower = pathFor([...bandRows].reverse().map((point) => ({ x: point.x, y: point.lowY }))).replace(/^M/, 'L');
    return {
      left, right, top, bottom, chartHeight, scale, y, rows, normalizedDates,
      timeTicks: buildTimeTicks(normalizedDates.map((point) => point.date), width),
      bandPath: upper && lower ? `${upper} ${lower} Z` : '',
    };
  }, [band, height, metric, series, width]);

  useEffect(() => {
    const next = plot && selectedInitially === 'latest' ? plot.normalizedDates.length - 1 : null;
    selectedRef.current = next;
    setSelectedIndex(next);
  }, [plot, selectedInitially]);

  if (!plot) return <View style={[styles.empty, { minHeight: height }]}><Text style={styles.emptyTitle}>{emptyTitle}</Text><Text style={styles.emptyBody}>{emptyBody}</Text></View>;

  const selectNearest = (locationX: number) => {
    let best = 0;
    let distance = Number.POSITIVE_INFINITY;
    plot.normalizedDates.forEach((point, index) => {
      const next = Math.abs(point.x - locationX);
      if (next < distance) { best = index; distance = next; }
    });
    if (selectedRef.current !== best) {
      selectedRef.current = best;
      setSelectedIndex(best);
    }
  };
  const selectedDate = selectedIndex == null ? null : plot.normalizedDates[selectedIndex] || null;
  const selection: AnalyticalSelection | null = selectedDate ? {
    date: selectedDate.date,
    index: selectedIndex!,
    values: plot.rows.flatMap((item) => {
      const point = item.points.find((row) => row.date === selectedDate.date);
      return point ? [{ key: item.key, label: item.label, color: item.color, value: point.value, meta: point.meta }] : [];
    }),
  } : null;
  const contextualRows = selection ? tooltipRows?.(selection) || [] : [];
  const tooltipWidth = Math.min(190, Math.max(142, width * 0.48));
  const tooltipLeft = selectedDate ? Math.min(Math.max(4, selectedDate.x - tooltipWidth / 2), Math.max(4, width - tooltipWidth - 4)) : 4;

  return <View
    accessibilityLabel={`${metric.label} analytical chart with ${plot.normalizedDates.length} dated observation${plot.normalizedDates.length === 1 ? '' : 's'}. Drag horizontally to inspect values.`}
    accessible
    onLayout={(event) => setWidth(Math.max(280, Math.round(event.nativeEvent.layout.width)))}
    onMoveShouldSetResponder={() => true}
    onResponderGrant={(event) => selectNearest(event.nativeEvent.locationX)}
    onResponderMove={(event) => selectNearest(event.nativeEvent.locationX)}
    style={[styles.frame, { minHeight: height }]}
    testID={testID}
  >
    <Svg height={height} width={width}>
      {plot.scale.ticks.map((tick) => {
        const y = plot.y(tick);
        const isZero = Math.abs(tick) < 1e-9;
        return <React.Fragment key={tick}>
          <Line x1={plot.left} x2={width - plot.right} y1={y} y2={y} stroke={isZero ? '#424654' : '#20242E'} strokeWidth={isZero ? 1.2 : 0.8} />
          <SvgText x={plot.left - 6} y={y + 3.5} textAnchor="end" fill="#858A97" fontSize="9">{formatAnalyticalValue(tick, metric, { axis: true, signed: metric.signed })}</SvgText>
        </React.Fragment>;
      })}
      {plot.bandPath ? <Path d={plot.bandPath} fill="rgba(151,105,255,0.13)" stroke="rgba(151,105,255,0.25)" strokeWidth={0.7} /> : null}
      {plot.rows.map((item) => <React.Fragment key={item.key}>
        {item.points.length > 1 ? <Path d={pathFor(item.points)} fill="none" stroke={item.color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.6} /> : null}
        {item.points.map((point) => {
          const isSelected = selectedDate?.date === point.date;
          return <Circle key={`${item.key}:${point.date}`} cx={point.x} cy={point.y} r={isSelected ? 6 : 3.4} fill={isSelected ? '#F7F2FF' : item.color} stroke={item.color} strokeWidth={isSelected ? 2.5 : 0} />;
        })}
      </React.Fragment>)}
      {selectedDate ? <Line x1={selectedDate.x} x2={selectedDate.x} y1={plot.top} y2={plot.top + plot.chartHeight} stroke="#B878FF" strokeDasharray="3 4" strokeWidth={1} /> : null}
      {plot.timeTicks.map((tick, index) => {
        const point = plot.normalizedDates[tick.index];
        const anchor = index === 0 ? 'start' : index === plot.timeTicks.length - 1 ? 'end' : 'middle';
        return point ? <SvgText key={`${tick.date}:${index}`} x={point.x} y={height - 8} textAnchor={anchor} fill="#858A97" fontSize="9">{tick.label}</SvgText> : null;
      })}
    </Svg>
    {selection ? <View pointerEvents="none" style={[styles.tooltip, { left: tooltipLeft, width: tooltipWidth }]}>
      <Text style={styles.tooltipDate}>{fullDate(selection.date).toUpperCase()}</Text>
      {selection.values.map((row) => <View key={row.key} style={styles.tooltipValueRow}><View style={[styles.tooltipDot, { backgroundColor: row.color }]} /><Text style={styles.tooltipLabel}>{row.label}</Text><Text style={styles.tooltipValue}>{formatSeriesValue?.(row.key, row.value) ?? formatAnalyticalValue(row.value, metric)}</Text></View>)}
      {contextualRows.map((row, index) => <Text key={`${row}:${index}`} numberOfLines={1} style={styles.tooltipMeta}>{row}</Text>)}
    </View> : null}
    {showLegend && (plot.rows.length > 1 || bandLabel) ? <View style={styles.legend}>{plot.rows.map((item) => <View key={item.key} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: item.color }]} /><Text style={styles.legendText}>{item.label}</Text></View>)}{bandLabel ? <View style={styles.legendItem}><View style={[styles.legendBand]} /><Text style={styles.legendText}>{bandLabel}</Text></View> : null}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  frame: { position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 12, backgroundColor: '#07090E' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#07090E' },
  emptyTitle: { color: '#E8E4ED', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptyBody: { marginTop: 5, color: '#858A97', fontSize: 10.5, lineHeight: 15, textAlign: 'center' },
  tooltip: { position: 'absolute', zIndex: 3, top: 5, minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: '#71439A', backgroundColor: 'rgba(12,13,20,0.96)', paddingHorizontal: 8, paddingVertical: 6 },
  tooltipDate: { color: '#C885FF', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  tooltipValueRow: { minHeight: 16, flexDirection: 'row', alignItems: 'center', gap: 5 },
  tooltipDot: { width: 6, height: 6, borderRadius: 3 },
  tooltipLabel: { flex: 1, color: '#A8A5B0', fontSize: 8.5 },
  tooltipValue: { color: '#F4F0F8', fontSize: 9, fontWeight: '800' },
  tooltipMeta: { color: '#858A97', fontSize: 7.8, lineHeight: 11 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 48, paddingBottom: 7 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendBand: { width: 13, height: 7, borderRadius: 2, backgroundColor: 'rgba(151,105,255,0.22)', borderWidth: 1, borderColor: 'rgba(151,105,255,0.5)' },
  legendText: { color: '#898D99', fontSize: 8 },
});
