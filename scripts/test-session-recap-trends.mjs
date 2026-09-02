import assert from 'node:assert/strict';

const {
  buildSessionRecapTrendPlot,
  chronologicalTrendPoints,
  formatSessionRecapTrendDelta,
  formatSessionRecapTrendValue,
} = await import('../lib/session-recap-trend.ts');

const unordered = [
  { date: '2026-08-10', set_log_id: 3, metric_value: 52 },
  { date: '2026-07-20', set_log_id: 1, metric_value: 45 },
  { date: '2026-08-01', set_log_id: 2, metric_value: 48 },
  { date: '2026-08-12', set_log_id: 4, metric_value: 55, current: true },
];
assert.deepEqual(
  chronologicalTrendPoints(unordered).map((point) => point.metric_value),
  [45, 48, 52, 55],
  'trend points must be chronological with current evidence last',
);

const plot = buildSessionRecapTrendPlot({ points: unordered, width: 100, height: 40 });
assert.equal(plot.points.length, 4);
assert.ok(plot.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
assert.ok(plot.points[0].x < plot.points.at(-1).x);
assert.equal(plot.gridY.length, 3);

assert.equal(formatSessionRecapTrendValue(45, 'kg', 'kg'), '45 kg');
assert.equal(formatSessionRecapTrendValue(45, 'kg', 'lb'), '99.2 lb');
assert.equal(
  formatSessionRecapTrendDelta({ delta_value: 2.5, metric_unit: 'kg', direction: 'higher_is_better' }, 'kg'),
  '↑ 2.5 kg',
);
assert.equal(
  formatSessionRecapTrendDelta({ delta_value: -2.5, metric_unit: 'kg', direction: 'lower_is_better' }, 'lb'),
  '↑ 5.5 lb',
);

const sparse = buildSessionRecapTrendPlot({ points: [{ current: true, metric_value: 30 }], width: 96, height: 38 });
assert.equal(sparse.points.length, 1);
assert.ok(Number.isFinite(sparse.points[0].y));

const nullMetric = buildSessionRecapTrendPlot({ points: [{ current: true, metric_value: null, score: null, weight_kg: null }], width: 96, height: 38 });
assert.equal(nullMetric.points.length, 0, 'null metric fields must not become fabricated zero chart points');

console.log('session recap trend tests passed');
