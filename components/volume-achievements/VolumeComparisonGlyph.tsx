import React from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

import type { VolumeComparisonGlyph as VolumeComparisonGlyphName } from '@/lib/volume-achievements';

type Props = {
  glyph: VolumeComparisonGlyphName;
  tone: string;
  width?: number;
  height?: number;
};

const strokeProps = (tone: string) => ({
  fill: 'none' as const,
  stroke: tone,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: 2.2,
});

/** Lightweight original technical line art; surrounding text owns accessibility. */
export function VolumeComparisonGlyph({ glyph, tone, width = 116, height = 64 }: Props) {
  const line = strokeProps(tone);
  return <Svg pointerEvents="none" accessible={false} width={width} height={height} viewBox="0 0 120 64">
    {glyph === 'airliner' ? <G {...line}>
      <Path d="M7 34 L45 29 L62 8 L69 8 L64 28 L102 27 Q112 28 116 32 Q111 36 102 37 L64 36 L69 55 L62 55 L45 37 L7 33 Z" />
      <Line x1="22" y1="31" x2="15" y2="20" /><Line x1="22" y1="35" x2="15" y2="45" />
    </G> : null}
    {glyph === 'shuttle' ? <G {...line}>
      <Path d="M58 5 Q66 12 69 24 L73 47 L62 59 L51 47 L55 24 Q57 12 58 5 Z" />
      <Path d="M54 29 L34 47 L51 43 M70 29 L90 47 L73 43" />
      <Line x1="58" y1="18" x2="66" y2="18" /><Line x1="62" y1="8" x2="62" y2="51" />
      <Path d="M55 48 L49 57 M69 48 L75 57" />
    </G> : null}
    {glyph === 'locomotive' ? <G {...line}>
      <Circle cx="32" cy="50" r="9" /><Circle cx="58" cy="50" r="9" /><Circle cx="87" cy="50" r="7" />
      <Rect x="25" y="25" width="45" height="19" rx="8" /><Path d="M67 44 L76 19 L96 19 L102 44 Z" />
      <Rect x="34" y="15" width="24" height="10" /><Line x1="42" y1="15" x2="39" y2="7" /><Line x1="18" y1="44" x2="107" y2="44" />
      <Path d="M17 44 L10 38 M17 44 L10 50" />
    </G> : null}
    {glyph === 'station' ? <G {...line}>
      <Rect x="50" y="20" width="20" height="24" rx="3" /><Rect x="7" y="16" width="34" height="32" /><Rect x="79" y="16" width="34" height="32" />
      <Line x1="41" y1="32" x2="50" y2="32" /><Line x1="70" y1="32" x2="79" y2="32" />
      <Line x1="18" y1="16" x2="18" y2="48" /><Line x1="30" y1="16" x2="30" y2="48" /><Line x1="90" y1="16" x2="90" y2="48" /><Line x1="102" y1="16" x2="102" y2="48" />
      <Line x1="7" y1="27" x2="41" y2="27" /><Line x1="7" y1="38" x2="41" y2="38" /><Line x1="79" y1="27" x2="113" y2="27" /><Line x1="79" y1="38" x2="113" y2="38" />
      <Circle cx="60" cy="32" r="4" />
    </G> : null}
    {glyph === 'tug' ? <G {...line}>
      <Path d="M8 44 L105 44 L94 56 L27 56 Q15 54 8 44 Z" />
      <Path d="M37 44 L43 23 L73 23 L82 44 Z" /><Rect x="49" y="13" width="18" height="10" />
      <Line x1="58" y1="13" x2="58" y2="6" /><Line x1="58" y1="7" x2="77" y2="16" />
      <Line x1="20" y1="50" x2="96" y2="50" /><Path d="M107 43 Q114 39 116 33" />
    </G> : null}
    {glyph === 'mining-shovel' ? <G {...line}>
      <Rect x="17" y="45" width="57" height="11" rx="5" /><Line x1="25" y1="50" x2="67" y2="50" />
      <Rect x="34" y="25" width="34" height="20" rx="3" /><Rect x="42" y="18" width="19" height="7" />
      <Path d="M63 28 L86 13 L94 17 L77 39" /><Path d="M91 16 L108 38 L97 47 L78 39" />
      <Line x1="34" y1="34" x2="23" y2="34" /><Line x1="23" y1="34" x2="18" y2="45" />
    </G> : null}
    {glyph === 'liner' ? <G {...line}>
      <Path d="M7 43 L113 43 L99 57 L28 57 Q15 54 7 43 Z" />
      <Path d="M24 43 L30 27 L90 27 L101 43 Z" /><Path d="M38 27 L42 17 L82 17 L88 27" />
      <Rect x="46" y="8" width="9" height="9" /><Rect x="66" y="8" width="9" height="9" />
      <Line x1="16" y1="49" x2="104" y2="49" />
      <Ellipse cx="50" cy="32" rx="2" ry="2" /><Ellipse cx="61" cy="32" rx="2" ry="2" /><Ellipse cx="72" cy="32" rx="2" ry="2" />
    </G> : null}
    <Polygon points="4,61 116,61" stroke={`${tone}42`} strokeWidth="1" />
  </Svg>;
}
