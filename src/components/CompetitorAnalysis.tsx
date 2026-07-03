import { lazy, Suspense } from 'react';
import { CompetitorStats, Video } from '../lib/types';
import { formatNumber } from '../lib/utils';

// グラフ群（recharts 依存）は遅延読み込みして、メインチャンクから切り離す。
const PostingHeatmap = lazy(() =>
  import('./charts/PostingHeatmap').then((m) => ({ default: m.PostingHeatmap }))
);
const WordBarChart = lazy(() =>
  import('./charts/WordBarChart').then((m) => ({ default: m.WordBarChart }))
);
const TimelineChart = lazy(() =>
  import('./charts/TimelineChart').then((m) => ({ default: m.TimelineChart }))
);
const DistributionBarChart = lazy(() =>
  import('./charts/DistributionBarChart').then((m) => ({ default: m.DistributionBarChart }))
);

interface CompetitorAnalysisProps {
  videos: Video[];
  stats: CompetitorStats;
  hasData: boolean;
}

export function CompetitorAnalysis({ videos, stats, hasData }: CompetitorAnalysisProps) {
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
        <div className="card-body">
          <Suspense fallback={<ChartLoading />}>
            <WordBarChart words={stats.topWords} />
          </Suspense>
        </div>
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

      <div className="card">
        <div className="card-header">投稿の曜日×時間帯マップ（日本時間）</div>
        <Suspense fallback={<ChartLoading />}>
          <PostingHeatmap matrix={stats.weekdayHourMatrix} />
        </Suspense>
      </div>

      <div className="card">
        <div className="card-header">このジャンルの鮮度（最近の動画が伸びているか）</div>
        <div className="card-body">
          <Suspense fallback={<ChartLoading />}>
            <TimelineChart videos={videos} />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">タイトル文字数の分布</div>
          <Suspense fallback={<ChartLoading />}>
            <DistributionBarChart
              labels={['10文字以下', '11-20文字', '21-30文字', '31文字以上']}
              data={stats.titleLengthDistribution}
            />
          </Suspense>
        </div>
        <div className="card">
          <div className="card-header">動画尺の分布</div>
          <Suspense fallback={<ChartLoading />}>
            <DistributionBarChart
              labels={['4分未満', '4-10分', '10-20分', '20分以上']}
              data={stats.durationDistribution}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

// グラフ遅延読み込み中の小さなフォールバック。
function ChartLoading() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">
      グラフを読み込み中…
    </div>
  );
}
