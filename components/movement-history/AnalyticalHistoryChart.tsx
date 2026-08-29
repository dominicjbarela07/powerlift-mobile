import {
  Canvas,
  Circle,
  Line,
  Path,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import {
  buildAnalyticalXLayout,
  buildYAxisGutter,
  estimateAxisLabelWidth,
  type AnalyticalXDomainMode,
} from '@/lib/chart-fidelity';
import { formatCalculatedWeightValue, kilogramsToDisplayValue } from '@/lib/display-units';
import type {
  CanonicalHistoryPoint,
  MovementHistoryUnit,
} from '@/lib/canonical-movement-history';

type Metric = 'strength' | 'load';

type PlotPoint = CanonicalHistoryPoint & Readonly<{
  x: number;
  y: number;
  value: number;
}>;

const HEIGHT = 238;
const PLOT_TOP = 48;
const PLOT_BOTTOM = 205;
const RIGHT = 12;

function shortDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function displayValue(valueKg: number, unit: MovementHistoryUnit) {
  return kilogramsToDisplayValue(valueKg, unit);
}

function numberLabel(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString('en-US', { maximumFractionDigits });
}

function chartWeightLabel(valueKg: number, unit: MovementHistoryUnit, metric: Metric, digits = 1) {
  const displayed = displayValue(valueKg, unit);
  return metric === 'strength'
    ? formatCalculatedWeightValue(displayed, unit) ?? '—'
    : numberLabel(displayed, digits);
}

function effortLabel(point: CanonicalHistoryPoint) {
  if (point.rir != null) return `${numberLabel(Number(point.rir), 1)} RIR`;
  if (point.rpe != null) return `RPE ${numberLabel(Number(point.rpe), 1)}`;
  return 'Effort not recorded';
}

export function AnalyticalHistoryChart({
  points,
  metric,
  metricLabel,
  unit,
  color,
  xDomainMode = 'chronological',
  onOpenExposure,
}: {
  points: CanonicalHistoryPoint[];
  metric: Metric;
  metricLabel?: string;
  unit: MovementHistoryUnit;
  color: string;
  xDomainMode?: AnalyticalXDomainMode;
  onOpenExposure: (exposureId: string) => void;
}) {
  const [width, setWidth] = useState(340);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(points.length ? points.length - 1 : null);
  const selectedIndexRef = useRef<number | null>(points.length ? points.length - 1 : null);
  const gestureStartX = useRef<number | null>(null);
  const metricPoints = useMemo(() => points.filter((point) => (
    metric === 'strength' ? point.strength_metric_kg != null : point.weight_kg != null
  )), [metric, points]);
  useEffect(() => {
    const next = metricPoints.length ? metricPoints.length - 1 : null;
    selectedIndexRef.current = next;
    setSelectedIndex(next);
  }, [metricPoints.length]);

  const plot = useMemo(() => {
    const values = metricPoints.map((point) => Number(metric === 'strength' ? point.strength_metric_kg : point.weight_kg));
    const low = values.length ? Math.min(...values) : 0;
    const high = values.length ? Math.max(...values) : 1;
    const spread = Math.max(high - low, Math.max(high * 0.08, 1));
    const minY = Math.max(0, low - spread * 0.22);
    const maxY = high + spread * 0.22;
    const gridValues = [0, 0.25, 0.5, 0.75, 1].map((ratio) => minY + (maxY - minY) * ratio).reverse();
    const gridLabels = gridValues.map((value) => `${chartWeightLabel(value, unit, metric, 0)} ${unit}`);
    const left = buildYAxisGutter(gridLabels, 10);
    const xLayout = buildAnalyticalXLayout({
      observations: metricPoints.map((point) => ({ key: point.exposure_id, date: point.performed_at || point.date })),
      mode: xDomainMode,
      plotLeft: left,
      plotRight: RIGHT,
      width,
      fontSize: 10,
    });
    const pointById = new Map(metricPoints.map((point) => [point.exposure_id, point]));
    const valueById = new Map(metricPoints.map((point, index) => [point.exposure_id, values[index]]));
    const rows: PlotPoint[] = xLayout.observations.flatMap((position) => {
      const point = pointById.get(position.key);
      const value = valueById.get(position.key);
      if (!point || value == null) return [];
      const y = PLOT_BOTTOM - ((value - minY) / Math.max(maxY - minY, 1)) * (PLOT_BOTTOM - PLOT_TOP);
      return [{ ...point, x: position.x, y, value }];
    });
    return { rows, minY, maxY, gridValues, gridLabels, left, xTicks: xLayout.ticks };
  }, [metric, metricPoints, unit, width, xDomainMode]);

  const linePath = useMemo(() => {
    const path = Skia.Path.Make();
    plot.rows.forEach((point, index) => {
      if (index === 0) path.moveTo(point.x, point.y);
      else path.lineTo(point.x, point.y);
    });
    return path;
  }, [plot.rows]);

  const areaPath = useMemo(() => {
    const path = Skia.Path.Make();
    if (!plot.rows.length) return path;
    path.moveTo(plot.rows[0].x, PLOT_BOTTOM);
    plot.rows.forEach((point) => path.lineTo(point.x, point.y));
    path.lineTo(plot.rows.at(-1)!.x, PLOT_BOTTOM);
    path.close();
    return path;
  }, [plot.rows]);

  const selected = selectedIndex == null ? null : plot.rows[selectedIndex] || null;
  const nearest = (x: number) => {
    if (!plot.rows.length) return;
    let best = 0;
    let distance = Number.POSITIVE_INFINITY;
    plot.rows.forEach((point, index) => {
      const next = Math.abs(point.x - x);
      if (next < distance) {
        distance = next;
        best = index;
      }
    });
    selectedIndexRef.current = best;
    setSelectedIndex(best);
  };

  if (!plot.rows.length) {
    return <View style={styles.empty}><Text style={styles.emptyTitle}>No exact comparable history yet.</Text><Text style={styles.emptyBody}>A real observation is required before this plot can be drawn.</Text></View>;
  }

  return (
    <View
      accessibilityLabel={`${metric === 'strength' ? 'Estimated performance' : 'Load progression'} chart with ${plot.rows.length} real observation${plot.rows.length === 1 ? '' : 's'} in ${xDomainMode === 'chronological' ? 'time' : 'instance'} mode`}
      onLayout={(event) => setWidth(Math.max(280, Math.round(event.nativeEvent.layout.width)))}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => {
        gestureStartX.current = event.nativeEvent.locationX;
        nearest(event.nativeEvent.locationX);
      }}
      onResponderMove={(event) => nearest(event.nativeEvent.locationX)}
      onResponderRelease={(event) => {
        const moved = gestureStartX.current == null ? 0 : Math.abs(event.nativeEvent.locationX - gestureStartX.current);
        const tapped = selectedIndexRef.current == null ? null : plot.rows[selectedIndexRef.current] || null;
        if (moved <= 10 && tapped) onOpenExposure(tapped.exposure_id);
        gestureStartX.current = null;
      }}
      style={styles.frame}
    >
      {selected ? (
        <View style={styles.inspection} pointerEvents="none">
          <View>
            <Text style={[styles.inspectionValue, { color }]}>
              {chartWeightLabel(metric === 'strength' ? Number(selected.strength_metric_kg) : Number(selected.weight_kg), unit, metric)} {unit}
              {metric === 'strength' ? ` ${metricLabel || 'estimated strength'}` : ` × ${selected.reps ?? '—'}`}
            </Text>
            <Text style={styles.inspectionEvidence}>
              {numberLabel(displayValue(Number(selected.weight_kg || 0), unit), 1)} {unit} × {selected.reps ?? '—'} · {effortLabel(selected)}
            </Text>
          </View>
          <View style={styles.inspectionDateWrap}>
            <Text style={styles.inspectionDate}>{shortDate(selected.date)}</Text>
            <Text numberOfLines={1} style={styles.inspectionEquipment}>{selected.equipment?.label || 'Unknown'}</Text>
          </View>
        </View>
      ) : null}
      <Canvas style={{ width, height: HEIGHT }}>
        {plot.gridValues.map((_value, index) => {
          const y = PLOT_TOP + index * ((PLOT_BOTTOM - PLOT_TOP) / 4);
          return <Line key={index} p1={vec(plot.left, y)} p2={vec(width - RIGHT, y)} color={index === 4 ? '#343643' : '#1D2028'} strokeWidth={index === 4 ? 1.1 : 0.7} />;
        })}
        {plot.rows.length > 1 ? <Path path={areaPath} color={`${color}18`} style="fill" /> : null}
        {plot.rows.length > 1 ? <Path path={linePath} color={color} style="stroke" strokeCap="round" strokeJoin="round" strokeWidth={2.6} /> : null}
        {plot.rows.map((point, index) => (
          <Circle key={`${point.exposure_id}-${index}`} cx={point.x} cy={point.y} r={index === selectedIndex ? 7 : 4.2} color={index === selectedIndex ? '#F4E9FF' : color} />
        ))}
        {selected ? <Line p1={vec(selected.x, selected.y)} p2={vec(selected.x, PLOT_BOTTOM)} color={`${color}78`} strokeWidth={1} /> : null}
      </Canvas>
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        {plot.gridLabels.map((label, index) => (
          <Text key={index} style={[styles.yLabel, { top: PLOT_TOP - 7 + index * ((PLOT_BOTTOM - PLOT_TOP) / 4), width: plot.left - 7 }]}>
            {label}
          </Text>
        ))}
        {plot.rows.map((point, index) => metric === 'load' ? (
          <View key={`${point.exposure_id}-rep`} style={[styles.repMarker, { left: Math.max(plot.left, Math.min(width - RIGHT - 24, point.x - 12)), top: Math.max(PLOT_TOP, point.y - 30), borderColor: color }]}>
            <Text style={[styles.repMarkerText, { color }]}>{point.reps ?? '—'}</Text>
          </View>
        ) : null)}
        {plot.xTicks.map((tick) => {
          const labelWidth = estimateAxisLabelWidth(tick.label, 10) + 6;
          const naturalLeft = tick.textAnchor === 'start' ? tick.x : tick.textAnchor === 'end' ? tick.x - labelWidth : tick.x - labelWidth / 2;
          const left = Math.max(plot.left, Math.min(width - RIGHT - labelWidth, naturalLeft));
          return <Text key={`${tick.key}:${tick.index}`} style={[styles.xLabel, { left, width: labelWidth, textAlign: tick.textAnchor === 'middle' ? 'center' : tick.textAnchor === 'start' ? 'left' : 'right' }]}>{tick.label}</Text>;
        })}
      </View>
      {plot.rows.length === 1 ? <Text style={[styles.sparseNotice, { left: plot.left }]}>First exact observation · a trend is not established yet</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { minHeight: HEIGHT, overflow: 'hidden', borderRadius: 12, backgroundColor: '#07090E' },
  inspection: { position: 'absolute', zIndex: 3, top: 7, left: 10, right: 10, minHeight: 38, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  inspectionValue: { fontSize: 13, lineHeight: 16, fontWeight: '700' },
  inspectionEvidence: { marginTop: 1, color: '#9B9EAA', fontSize: 11, lineHeight: 15 },
  inspectionDateWrap: { maxWidth: '42%', alignItems: 'flex-end' },
  inspectionDate: { color: '#E7E4EA', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  inspectionEquipment: { color: '#777C88', fontSize: 10, lineHeight: 13, textAlign: 'right' },
  yLabel: { position: 'absolute', left: 3, color: '#777C87', fontSize: 10, lineHeight: 13, textAlign: 'right' },
  xLabel: { position: 'absolute', top: PLOT_BOTTOM + 7, color: '#858995', fontSize: 10, lineHeight: 13 },
  repMarker: { position: 'absolute', minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, backgroundColor: '#090A10' },
  repMarkerText: { fontSize: 11, fontWeight: '700' },
  sparseNotice: { position: 'absolute', bottom: 7, right: RIGHT, color: '#7F838D', fontSize: 10.5, textAlign: 'center' },
  empty: { minHeight: 174, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 22, borderRadius: 12, backgroundColor: '#07090E' },
  emptyTitle: { color: '#D5D2DA', fontSize: 16, lineHeight: 21, fontWeight: '600' },
  emptyBody: { color: '#777C87', fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
