import { CompetitorStats } from '../lib/types';
import { formatNumber } from '../lib/utils';

interface CompetitorAnalysisProps {
  stats: CompetitorStats;
  hasData: boolean;
}

export function CompetitorAnalysis({ stats, hasData }: CompetitorAnalysisProps) {
  if (!hasData) {
    return (
      <div className="card">
        <div className="card-body text-center text-slate-500">
          リサーチを実行すると、頻出ワードや投稿時間帯の傾向が表示されます。
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">タイトル頻出ワード TOP20</div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-16 text-right">順位</th>
                <th>ワード</th>
                <th className="text-right">出現回数</th>
                <th className="text-right">平均再生数</th>
              </tr>
            </thead>
            <tbody>
              {stats.topWords.map((w, i) => (
                <tr key={w.word} className="hover:bg-slate-50">
                  <td className="text-right">{i + 1}</td>
                  <td className="font-medium">{w.word}</td>
                  <td className="text-right">{w.count}回</td>
                  <td className="text-right">{formatNumber(Math.round(w.averageViews))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">よく使われる2語の組み合わせ TOP15</div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-16 text-right">順位</th>
                <th>2語の組み合わせ</th>
                <th className="text-right">出現回数</th>
                <th className="text-right">平均再生数</th>
              </tr>
            </thead>
            <tbody>
              {stats.topBigrams.map((b, i) => (
                <tr key={b.phrase} className="hover:bg-slate-50">
                  <td className="text-right">{i + 1}</td>
                  <td className="font-medium">{b.phrase}</td>
                  <td className="text-right">{b.count}回</td>
                  <td className="text-right">{formatNumber(Math.round(b.averageViews))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DistributionCard
          title="タイトル文字数の分布"
          labels={['10文字以下', '11-20文字', '21-30文字', '31文字以上']}
          data={stats.titleLengthDistribution}
        />
        <DistributionCard
          title="投稿曜日の分布（日本時間）"
          labels={['月', '火', '水', '木', '金', '土', '日']}
          data={stats.weekdayDistribution}
        />
        <DistributionCard
          title="投稿時間帯の分布（日本時間）"
          labels={['0-6時', '6-12時', '12-18時', '18-24時']}
          data={stats.hourDistribution}
        />
        <DistributionCard
          title="動画尺の分布"
          labels={['4分未満', '4-10分', '10-20分', '20分以上']}
          data={stats.durationDistribution}
        />
      </div>
    </div>
  );
}

function DistributionCard({
  title,
  labels,
  data
}: {
  title: string;
  labels: string[];
  data: Record<string, number>;
}) {
  const maxCount = Math.max(1, ...labels.map((l) => data[l] || 0));
  return (
    <div className="card">
      <div className="card-header">{title}</div>
      <div className="card-body space-y-2">
        {labels.map((label) => {
          const count = data[label] || 0;
          const pct = (count / maxCount) * 100;
          return (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="w-20 shrink-0 text-slate-600">{label}</span>
              <div className="flex-1 h-3 rounded bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-brand-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-12 text-right tabular-nums text-slate-700">{count}本</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
