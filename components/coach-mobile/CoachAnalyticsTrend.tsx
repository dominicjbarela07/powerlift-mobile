import React from 'react';

import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import { analyticalMetricDefinition, formatAnalyticalValue } from '@/lib/chart-fidelity';
import type { CoachAnalyticsMetricKey } from '@/lib/coach-mobile';

type TeamPoint = { date: string; team_average?: number | null; low?: number | null; high?: number | null; n?: number };
type AthletePoint = { date: string; value?: number | null };

export function CoachAnalyticsTrend({ athlete = [], metric, team = [] }: { athlete?: AthletePoint[]; metric: CoachAnalyticsMetricKey; team?: TeamPoint[] }) {
  const definition = analyticalMetricDefinition(metric);
  return (
    <AnalyticalTimeSeriesChart
      band={team.map((point) => ({ date: point.date, low: point.low, high: point.high }))}
      bandLabel="Normal cohort band"
      emptyBody="Two real comparable observations are required before this chart is established."
      emptyTitle="Not enough comparable history"
      height={224}
      metric={definition}
      series={[
        { key: 'athlete', label: 'Athlete', color: COACH_V2.magenta, points: athlete },
        { key: 'team', label: 'Team average', color: COACH_V2.violetBright, points: team.map((point) => ({ date: point.date, value: point.team_average })) },
      ]}
      testID={`coach-analytics-${metric}-chart`}
      tooltipRows={(selection) => {
        const athleteValue = selection.values.find((row) => row.key === 'athlete')?.value;
        const teamValue = selection.values.find((row) => row.key === 'team')?.value;
        return athleteValue != null && teamValue != null
          ? [`${formatAnalyticalValue(athleteValue - teamValue, definition, { signed: true })} vs team`]
          : [];
      }}
    />
  );
}
