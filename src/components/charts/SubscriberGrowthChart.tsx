import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Snapshot } from '../../lib/storage';
import { formatNumber } from '../../lib/utils';

interface SubscriberGrowthChartProps {
  snapshots: Snapshot[];
}

interface GrowthPoint {
  dateKey: string;
  subscriberCount: number;
}

/**
 * 成長記録（登録者数の推移）。X=日付, Y=登録者数の折れ線。
 * スナップショットが2点以上あるときだけ呼ばれる想定（1点以下は呼び出し側で案内表示）。
 * D2 の charts/ パターン（lazy 読み込み・Recharts・ブランド青系）に合わせている。
 */
export function SubscriberGrowthChart({ snapshots }: SubscriberGrowthChartProps) {
  const points = useMemo<GrowthPoint[]>(
    () =>
      snapshots.map((s) => ({
        dateKey: s.dateKey,
        subscriberCount: s.subscriberCount
      })),
    [snapshots]
  );

  return (
    <div className="card-body">
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dateKey" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
            <YAxis
              allowDecimals={false}
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: '#64748b' }}
              width={56}
              tickFormatter={(value) => formatNumber(value)}
            />
            <Tooltip
              formatter={(value) => [`${formatNumber(Number(value))}人`, '登録者数']}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
              cursor={{ stroke: '#1a73e8', strokeDasharray: '3 3' }}
            />
            <Line
              type="monotone"
              dataKey="subscriberCount"
              name="登録者数"
              stroke="#1a73e8"
              strokeWidth={2}
              dot={{ r: 3, fill: '#1a73e8' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
