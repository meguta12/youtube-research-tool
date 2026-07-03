import { useMemo } from 'react';
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Video } from '../../lib/types';
import { formatDate, formatNumber } from '../../lib/utils';
import { clampForLog, HEAT_TIER_COLORS, heatColorForScore } from './heatColors';

interface TimelineChartProps {
  videos: Video[];
}

interface TimelinePoint {
  x: number; // 公開日（epoch ms, 時間軸）
  y: number; // 1日平均再生数（log 用に 1 クランプ済み）
  color: string;
  video: Video;
}

const AXIS_TICKS = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000];

/**
 * G4 公開日タイムライン散布。X=公開日（時間軸）、Y=1日平均再生数（log, 1クランプ）、色=ヒートティア。
 * 「このジャンルの鮮度（最近の動画が伸びているか）」を見るためのグラフ。
 */
export function TimelineChart({ videos }: TimelineChartProps) {
  const points = useMemo<TimelinePoint[]>(
    () =>
      videos
        .map((video) => ({
          x: new Date(video.publishedAt).getTime(),
          y: clampForLog(video.viewsPerDay),
          color: heatColorForScore(video.heatScore),
          video
        }))
        // 公開日が不正な動画は除外（時間軸が壊れるのを防ぐ）。
        .filter((point) => Number.isFinite(point.x)),
    [videos]
  );

  return (
    <div>
      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name="公開日"
              scale="time"
              domain={['auto', 'auto']}
              tickFormatter={(value) => formatDate(new Date(value))}
              tick={{ fontSize: 11, fill: '#64748b' }}
              label={{ value: '公開日', position: 'insideBottom', offset: -12, fontSize: 12, fill: '#475569' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="1日平均再生数"
              scale="log"
              domain={['auto', 'auto']}
              ticks={AXIS_TICKS}
              tickFormatter={(value) => formatNumber(value)}
              tick={{ fontSize: 11, fill: '#64748b' }}
              width={64}
              label={{ value: '1日平均（log）', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#475569' }}
            />
            <Tooltip content={<TimelineTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={points}>
              {points.map((point) => (
                <Cell key={point.video.videoId} fill={point.color} fillOpacity={0.85} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <TimelineLegend />
    </div>
  );
}

// ツールチップ＝タイトル＋日付＋1日平均。
function TimelineTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TimelinePoint }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const video = payload[0].payload.video;
  return (
    <div className="max-w-[240px] rounded-lg border border-slate-200 bg-white p-2 shadow-md">
      <div className="line-clamp-2 text-xs font-medium text-slate-800">{video.title}</div>
      <div className="mt-1 text-xs text-slate-600">
        {video.publishedDate || formatDate(new Date(video.publishedAt))}
        <span className="mx-1 text-slate-300">·</span>
        1日平均{formatNumber(Math.round(video.viewsPerDay))}
      </div>
    </div>
  );
}

function TimelineLegend() {
  const items: Array<{ label: string; color: string }> = [
    { label: 'S', color: HEAT_TIER_COLORS.S },
    { label: 'A', color: HEAT_TIER_COLORS.A },
    { label: 'B', color: HEAT_TIER_COLORS.B },
    { label: 'なし', color: HEAT_TIER_COLORS.none }
  ];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
      <span>ヒートティア:</span>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
