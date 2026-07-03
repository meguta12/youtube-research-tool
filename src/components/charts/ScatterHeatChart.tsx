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
import { getHeatTier } from '../../lib/heat';
import { Video } from '../../lib/types';
import { formatNumber } from '../../lib/utils';
import { clampForLog, HEAT_TIER_COLORS, heatColorForScore } from './heatColors';

interface ScatterHeatChartProps {
  videos: Video[];
}

interface ScatterPoint {
  x: number; // 登録者数（log 用に 1 クランプ済み）
  y: number; // 1日平均再生数（log 用に 1 クランプ済み）
  color: string;
  video: Video;
}

// log 軸の目盛りを人が読める丸い値に固定する（10, 100, 1千, ...）。
const AXIS_TICKS = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000];

/**
 * G1 散布図「登録者数 × 1日平均再生数」。
 * 「熱い動画＝左上（登録者少×再生多）」を一目で見せる主役グラフ。両軸 log スケール。
 * 0 以下の値はデータ整形時に 1 へクランプして log(0) を回避する。
 */
export function ScatterHeatChart({ videos }: ScatterHeatChartProps) {
  const points = useMemo<ScatterPoint[]>(
    () =>
      videos.map((video) => ({
        x: clampForLog(video.subscriberCount),
        y: clampForLog(video.viewsPerDay),
        color: heatColorForScore(video.heatScore),
        video
      })),
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
              name="登録者数"
              scale="log"
              domain={['auto', 'auto']}
              ticks={AXIS_TICKS}
              tickFormatter={(value) => formatNumber(value)}
              tick={{ fontSize: 11, fill: '#64748b' }}
              label={{ value: '登録者数（log）', position: 'insideBottom', offset: -12, fontSize: 12, fill: '#475569' }}
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
            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter
              data={points}
              // 点クリックで動画URLを新規タブで開く。
              onClick={(entry: unknown) => {
                const point = entry as ScatterPoint | undefined;
                if (point?.video?.videoUrl) {
                  window.open(point.video.videoUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              className="cursor-pointer"
            >
              {points.map((point) => (
                <Cell key={point.video.videoId} fill={point.color} fillOpacity={0.85} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ScatterLegend />
    </div>
  );
}

// カスタムツールチップ：サムネ小＋タイトル（2行clamp）＋「ヒートNN・比×N・1日平均N」。
function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterPoint }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const video = payload[0].payload.video;
  const tier = getHeatTier(video.heatScore);
  return (
    <div className="max-w-[240px] rounded-lg border border-slate-200 bg-white p-2 shadow-md">
      <div className="flex gap-2">
        {video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
        )}
        <div className="line-clamp-2 text-xs font-medium text-slate-800">{video.title}</div>
      </div>
      <div className="mt-1 text-xs text-slate-600">
        ヒート{video.heatScore !== null ? Math.round(video.heatScore) : '-'}
        {tier && <span className="ml-1 text-heat-600">{tier}</span>}
        <span className="mx-1 text-slate-300">·</span>
        比×{video.subscriberRatio !== null ? video.subscriberRatio.toFixed(1) : '-'}
        <span className="mx-1 text-slate-300">·</span>
        1日平均{formatNumber(Math.round(video.viewsPerDay))}
      </div>
    </div>
  );
}

function ScatterLegend() {
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
      <span className="text-slate-400">点をクリックで動画を開く</span>
    </div>
  );
}
