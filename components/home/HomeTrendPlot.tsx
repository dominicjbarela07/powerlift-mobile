import {
  Canvas,
  Circle,
  Line,
  Path,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import {
  buildHomeBarPlot,
  buildHomeLinePlot,
  compactPlotDate,
  type HomePlotDatum,
} from '@/lib/home-trend-plot';

type Props = {
  accent: string;
  emptyLabel: string;
  kind?: 'line' | 'bar';
  metric: string;
  points: HomePlotDatum[];
};

export function HomeTrendPlot({ accent, emptyLabel, kind = 'line', metric, points }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => current.width === width && current.height === height ? current : { width, height });
  };
  const line = useMemo(
    () => buildHomeLinePlot(points, size.width, size.height),
    [points, size.height, size.width],
  );
  const bars = useMemo(
    () => buildHomeBarPlot(points, size.width, size.height),
    [points, size.height, size.width],
  );
  const active = kind === 'bar' ? bars : line;
  const path = useMemo(() => {
    const output = Skia.Path.Make();
    line.points.forEach((point, index) => {
      if (index === 0) output.moveTo(point.x, point.y);
      else output.lineTo(point.x, point.y);
    });
    return output;
  }, [line.points]);
  const accessibilityLabel = active.points.length
    ? `${metric}. ${active.points.length} observations from ${compactPlotDate(active.firstDate)} to ${compactPlotDate(active.lastDate)}. Latest ${active.points[active.points.length - 1].value}.`
    : `${metric}. ${emptyLabel}.`;

  return (
    <View accessible accessibilityLabel={accessibilityLabel} onLayout={onLayout} style={styles.root}>
      {active.points.length && size.width > 0 ? (
        <>
          <Canvas pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            {[0.25, 0.7].map((ratio) => (
              <Line
                color="rgba(151,145,164,0.18)"
                key={ratio}
                p1={vec(3, ratio * (size.height - 12))}
                p2={vec(size.width - 3, ratio * (size.height - 12))}
                strokeWidth={1}
              />
            ))}
            {kind === 'bar' ? bars.bars.map((bar, index) => (
              <Rect
                color={accent}
                height={bar.height}
                key={`${bar.date}-${index}`}
                opacity={0.45 + ((index + 1) / bars.bars.length) * 0.55}
                width={bar.width}
                x={bar.x}
                y={bar.y}
              />
            )) : (
              <>
                {line.points.length > 1 ? <Path color={accent} path={path} style="stroke" strokeCap="round" strokeJoin="round" strokeWidth={2} /> : null}
                {line.points.map((point, index) => (
                  <Circle
                    color={accent}
                    cx={point.x}
                    cy={point.y}
                    key={`${point.date}-${index}`}
                    r={index === line.points.length - 1 ? 3.2 : 1.8}
                  />
                ))}
              </>
            )}
          </Canvas>
          <View pointerEvents="none" style={styles.axisLabels}>
            <Text style={styles.axisLabel}>{compactPlotDate(active.firstDate)}</Text>
            <Text style={styles.axisLabel}>{active.state === 'first_observation' ? 'FIRST' : compactPlotDate(active.lastDate)}</Text>
          </View>
        </>
      ) : (
        <View style={styles.empty}><Text numberOfLines={2} style={styles.emptyText}>{emptyLabel}</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 42, marginTop: 4, overflow: 'hidden' },
  axisLabels: { position: 'absolute', left: 2, right: 2, bottom: 0, flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { color: '#686472', fontSize: 5.5, lineHeight: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  emptyText: { color: '#77737D', fontSize: 7, lineHeight: 10, textAlign: 'center' },
});
