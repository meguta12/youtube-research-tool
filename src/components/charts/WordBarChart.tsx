import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { CompetitorStats } from '../../lib/types';
import { formatNumber } from '../../lib/utils';

interface WordBarChartProps {
  words: CompetitorStats['topWords'];
}

/**
 * G3 頻出ワードチャート（ComposedChart 横向き）。
 * 上位10ワード。棒＝出現回数、線＋点＝平均再生数（第2軸）。
 * recharts の横向き棒は layout="vertical"（カテゴリを Y 軸に置く）で表現する。
 */
export function WordBarChart({ words }: WordBarChartProps) {
  const data = useMemo(
    () =>
      words.slice(0, 10).map((word) => ({
        word: word.word,
        count: word.count,
        averageViews: Math.round(word.averageViews)
      })),
    [words]
  );

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          layout="vertical"
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
        >
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis
            type="number"
            xAxisId="count"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickFormatter={(value) => formatNumber(value)}
          />
          <XAxis
            type="number"
            xAxisId="views"
            orientation="top"
            tick={{ fontSize: 11, fill: '#1a73e8' }}
            tickFormatter={(value) => formatNumber(value)}
          />
          <YAxis
            type="category"
            dataKey="word"
            width={88}
            tick={{ fontSize: 12, fill: '#334155' }}
          />
          <Tooltip
            formatter={(value, name) => [formatNumber(value as number), name]}
            labelStyle={{ color: '#334155' }}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            xAxisId="count"
            dataKey="count"
            name="出現回数"
            fill="#1a73e8"
            radius={[0, 4, 4, 0]}
            barSize={16}
          />
          <Line
            xAxisId="views"
            dataKey="averageViews"
            name="平均再生数"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 3, fill: '#f97316' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
