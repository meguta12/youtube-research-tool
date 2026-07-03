import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

interface DistributionBarChartProps {
  labels: string[];
  data: Record<string, number>;
}

/**
 * G5 既存分布の Recharts 化（縦棒）。
 * 「タイトル文字数の分布」「動画尺の分布」の div 棒を置き換える。
 * ラベルはそのまま、各棒の上に件数を表示する。
 */
export function DistributionBarChart({ labels, data }: DistributionBarChartProps) {
  const chartData = useMemo(
    () => labels.map((label) => ({ label, count: data[label] || 0 })),
    [labels, data]
  );

  return (
    <div className="card-body">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 16, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} width={32} />
            <Tooltip
              formatter={(value) => [`${value}本`, '件数']}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
              cursor={{ fill: 'rgba(26, 115, 232, 0.06)' }}
            />
            <Bar dataKey="count" name="件数" fill="#1a73e8" radius={[4, 4, 0, 0]} barSize={40}>
              <LabelList
                dataKey="count"
                position="top"
                fontSize={11}
                fill="#334155"
                formatter={(value) => `${value}本`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
