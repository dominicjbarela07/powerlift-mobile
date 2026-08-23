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
import { formatCalculatedWeightValue, kilogramsToDisplayValue } from '@/lib/display-units';
import type {
  CanonicalHistoryPoint,
  MovementHistoryUnit,
} from '@/lib/canonical-movement-history';

type Metric = 'e10rm' | 'load';

type PlotPoint = CanonicalHistoryPoint & Readonly<{
  x: number;
  y: number;
  value: number;
}>;

const HEIGHT = 238;
const PLOT_TOP = 48;
const PLOT_BOTTOM = 205;
const LEFT = 42;
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
  return metric === 'e10rm'
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
  unit,
  color,
  onOpenExposure,
}: {
  points: CanonicalHistoryPoint[];
  metric: Metric;
  unit: MovementHistoryUnit;
  color: string;
  onOpenExposure: (exposureId: string) => void;
}) {
  const [width, setWidth] = useState(340);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(points.length ? points.length - 1 : null);
  const selectedIndexRef = useRef<number | null>(points.length ? points.length - 1 : null);
  const gestureStartX = useRef<number | null>(null);
  const metricPoints = useMemo(() => points.filter((point) => (
    metric === 'e10rm' ? point.e10rm_kg != null : point.weight_kg != null
  )), [metric, points]);
  useEffect(() => {
    const next = metricPoints.length ? metricPoints.length - 1 : null;
    selectedIndexRef.current = next;
    setSelectedIndex(next);
  }, [metricPoints.length]);

  const plot = useMemo(() => {
    const values = metricPoints.map((point) => Number(metric === 'e10rm' ? point.e10rm_kg : point.weight_kg));
    const timestamps = metricPoints.map((point) => new Date(point.performed_at || `${point.date}T12:00:00`).getTime());
    const low = values.length ? Math.min(...values) : 0;
    const high = values.length ? Math.max(...values) : 1;
    const spread = Math.max(high - low, Math.max(high * 0.08, 1));
    const minY = Math.max(0, low - spread * 0.22);
    const maxY = high + spread * 0.22;
    const minTime = timestamps.length ? Math.min(...timestamps) : 0;
    const maxTime = timestamps.length ? Math.max(...timestamps) : 1;
    const span = Math.max(maxTime - minTime, 1);
    const plotWidth = Math.max(1, width - LEFT - RIGHT);
    const rows: PlotPoint[] = metricPoints.map((point, index) => {
      const value = values[index];
      const x = metricPoints.length === 1
        ? LEFT + plotWidth / 2
        : LEFT + ((timestamps[index] - minTime) / span) * plotWidth;
      const y = PLOT_BOTTOM - ((value - minY) / Math.max(maxY - minY, 1)) * (PLOT_BOTTOM - PLOT_TOP);
      return { ...point, x, y, value };
    });
    const gridValues = [0, 0.25, 0.5, 0.75, 1].map((ratio) => minY + (maxY - minY) * ratio).reverse();
    return { rows, minY, maxY, gridValues };
  }, [metric, metricPoints, width]);

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
      accessibilityLabel={`${metric === 'e10rm' ? 'Estimated performance' : 'Load progression'} chart with ${plot.rows.length} real observation${plot.rows.length === 1 ? '' : 's'}`}
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
              {chartWeightLabel(metric === 'e10rm' ? Number(selected.e10rm_kg) : Number(selected.weight_kg), unit, metric)} {unit}
              {metric === 'e10rm' ? ' e10RM' : ` × ${selected.reps ?? '—'}`}
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
          return <Line key={index} p1={vec(LEFT, y)} p2={vec(width - RIGHT, y)} color={index === 4 ? '#343643' : '#1D2028'} strokeWidth={index === 4 ? 1.1 : 0.7} />;
        })}
        {plot.rows.length > 1 ? <Path path={areaPath} color={`${color}18`} style="fill" /> : null}
        {plot.rows.length > 1 ? <Path path={linePath} color={color} style="stroke" strokeCap="round" strokeJoin="round" strokeWidth={2.6} /> : null}
        {plot.rows.map((point, index) => (
          <Circle key={`${point.exposure_id}-${index}`} cx={point.x} cy={point.y} r={index === selectedIndex ? 7 : 4.2} color={index === selectedIndex ? '#F4E9FF' : color} />
        ))}
        {selected ? <Line p1={vec(selected.x, selected.y)} p2={vec(selected.x, PLOT_BOTTOM)} color={`${color}78`} strokeWidth={1} /> : null}
      </Canvas>
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        {plot.gridValues.map((value, index) => (
          <Text key={index} style={[styles.yLabel, { top: PLOT_TOP - 7 + index * ((PLOT_BOTTOM - PLOT_TOP) / 4) }]}>
            {chartWeightLabel(value, unit, metric, 0)}
          </Text>
        ))}
        {plot.rows.map((point, index) => metric === 'load' ? (
          <View key={`${point.exposure_id}-rep`} style={[styles.repMarker, { left: Math.max(LEFT, Math.min(width - RIGHT - 24, point.x - 12)), top: Math.max(PLOT_TOP, point.y - 30), borderColor: color }]}>
            <Text style={[styles.repMarkerText, { color }]}>{point.reps ?? '—'}</Text>
          </View>
        ) : null)}
        <Text style={[styles.xLabel, { left: LEFT }]}>{shortDate(plot.rows[0].date)}</Text>
        {plot.rows.length > 2 ? <Text style={[styles.xLabel, styles.xLabelMiddle]}>{shortDate(plot.rows[Math.floor((plot.rows.length - 1) / 2)].date)}</Text> : null}
        <Text style={[styles.xLabel, styles.xLabelRight]}>{shortDate(plot.rows.at(-1)!.date)}</Text>
      </View>
      {plot.rows.length === 1 ? <Text style={styles.sparseNotice}>First exact observation · a trend is not established yet</Text> : null}
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
  yLabel: { position: 'absolute', left: 3, width: 35, color: '#777C87', fontSize: 10, lineHeight: 13, textAlign: 'right' },
  xLabel: { position: 'absolute', top: PLOT_BOTTOM + 7, color: '#858995', fontSize: 10, lineHeight: 13 },
  xLabelMiddle: { left: '48%', transform: [{ translateX: -18 }] },
  xLabelRight: { right: RIGHT, textAlign: 'right' },
  repMarker: { position: 'absolute', minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, backgroundColor: '#090A10' },
  repMarkerText: { fontSize: 11, fontWeight: '700' },
  sparseNotice: { position: 'absolute', bottom: 7, left: LEFT, right: RIGHT, color: '#7F838D', fontSize: 10.5, textAlign: 'center' },
  empty: { minHeight: 174, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 22, borderRadius: 12, backgroundColor: '#07090E' },
  emptyTitle: { color: '#D5D2DA', fontSize: 16, lineHeight: 21, fontWeight: '600' },
  emptyBody: { color: '#777C87', fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
