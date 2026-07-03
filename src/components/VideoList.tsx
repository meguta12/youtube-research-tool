import { lazy, Suspense, useMemo, useState } from 'react';
import { getHeatTier } from '../lib/heat';
import { Video } from '../lib/types';
import { formatNumber } from '../lib/utils';

// 散布図（recharts 依存）は遅延読み込みして、メインチャンクから切り離す。
const ScatterHeatChart = lazy(() =>
  import('./charts/ScatterHeatChart').then((m) => ({ default: m.ScatterHeatChart }))
);

interface VideoListProps {
  videos: Video[];
}

type SortKey =
  | 'heatScore'
  | 'viewsPerDay'
  | 'viewCount'
  | 'subscriberRatio'
  | 'outlierMultiplier'
  | 'engagementRate'
  | 'publishedAt'
  | 'subscriberCount'
  | 'durationSeconds';

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'heatScore', label: 'ヒートスコア' },
  { key: 'viewsPerDay', label: '1日平均再生数' },
  { key: 'viewCount', label: '再生数' },
  { key: 'subscriberRatio', label: '登録者比' },
  { key: 'outlierMultiplier', label: 'アウトライアー倍率' },
  { key: 'engagementRate', label: 'エンゲージ率' },
  { key: 'publishedAt', label: '公開日（新しい順）' },
  { key: 'subscriberCount', label: '登録者数' },
  { key: 'durationSeconds', label: '動画尺' }
];

export function VideoList({ videos }: VideoListProps) {
  // ヒートスコアをデフォルトの並び順にする（今アツい順）。null は末尾。
  const [sortKey, setSortKey] = useState<SortKey>('heatScore');
  const [filter, setFilter] = useState('');

  const sorted = useMemo(() => {
    const filtered = filter.trim()
      ? videos.filter(
          (v) =>
            v.title.toLowerCase().includes(filter.toLowerCase()) ||
            v.channelTitle.toLowerCase().includes(filter.toLowerCase())
        )
      : videos;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'heatScore':
          return (b.heatScore ?? -1) - (a.heatScore ?? -1);
        case 'viewsPerDay':
          return b.viewsPerDay - a.viewsPerDay;
        case 'viewCount':
          return b.viewCount - a.viewCount;
        case 'subscriberRatio':
          return (b.subscriberRatio ?? -1) - (a.subscriberRatio ?? -1);
        case 'outlierMultiplier':
          return (b.outlierMultiplier ?? -1) - (a.outlierMultiplier ?? -1);
        case 'engagementRate':
          return (b.engagementRate ?? -1) - (a.engagementRate ?? -1);
        case 'publishedAt':
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        case 'subscriberCount':
          return b.subscriberCount - a.subscriberCount;
        case 'durationSeconds':
          return b.durationSeconds - a.durationSeconds;
      }
    });
  }, [videos, sortKey, filter]);

  // 「今アツい動画 TOP5」用に、heatScore がある動画をスコア降順で最大5件抜き出す。
  const heroVideos = useMemo(() => {
    return [...videos]
      .filter((v) => v.heatScore !== null)
      .sort((a, b) => (b.heatScore ?? -1) - (a.heatScore ?? -1))
      .slice(0, 5);
  }, [videos]);

  if (videos.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {heroVideos.length > 0 && <HeatHero videos={heroVideos} />}
      <ScatterMapCard videos={videos} />
      <div className="card">
        <div className="card-header flex flex-wrap items-center justify-between gap-2">
          <span>動画リスト（{videos.length}件）</span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="タイトル/チャンネル名で絞り込み"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input w-56"
            />
            <select
              className="input w-48"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>並び順: {opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        {videos.length < 5 && (
          <div className="px-5 pt-3 text-xs text-slate-500">
            ※ 件数が少ないためヒートスコアは参考値です
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="table-base table-wide">
            <thead>
              <tr>
                <th className="w-32 min-w-[128px]">サムネ</th>
                <th>タイトル</th>
                <th>チャンネル</th>
                <th>国</th>
                <th>子ども向け</th>
                <th className="text-right">ヒート</th>
                <th className="text-right">登録者</th>
                <th className="text-right">再生数</th>
                <th className="text-right">1日平均</th>
                <th className="text-right">登録者比</th>
                <th className="text-right">倍率</th>
                <th className="text-right">エンゲージ率</th>
                <th>動画尺</th>
                <th>公開日</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((v) => {
                const tier = getHeatTier(v.heatScore);
                // Sティアの行は温度感を出す（伸びチャンス緑と同系の手法）。それ以外は zebra。
                const rowClass =
                  tier === 'S' ? 'bg-amber-50 hover:bg-amber-100' : 'odd:bg-slate-50/50 hover:bg-slate-50';
                return (
                  <tr key={v.videoId} className={rowClass}>
                    <td className="min-w-[128px] overflow-visible">
                      {v.thumbnailUrl && (
                        <a href={v.videoUrl} target="_blank" rel="noreferrer">
                          <img
                            src={v.thumbnailUrl}
                            alt=""
                            loading="lazy"
                            className="h-16 w-28 rounded object-cover origin-left transition-transform hover:z-10 hover:scale-150"
                          />
                        </a>
                      )}
                    </td>
                    <td className="max-w-md">
                      <a
                        href={v.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-slate-800 hover:text-brand-600 line-clamp-2"
                      >
                        {v.title}
                      </a>
                      {v.elapsedDays <= 3 && (
                        <span className="ml-1 align-middle rounded bg-sky-100 px-1 py-0.5 text-[10px] font-medium text-sky-700">
                          新着
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs">
                      <a
                        href={v.channelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-700 hover:text-brand-600 line-clamp-2"
                      >
                        {v.channelTitle}
                      </a>
                    </td>
                    <td className="whitespace-nowrap">{v.channelCountry || '-'}</td>
                    <td className="whitespace-nowrap">{formatMadeForKids(v.channelMadeForKids)}</td>
                    <td className="text-right">{formatHeat(v.heatScore)}</td>
                    <td className="text-right">{formatNumber(v.subscriberCount)}</td>
                    <td className="text-right font-semibold">{formatNumber(v.viewCount)}</td>
                    <td className="text-right">{formatNumber(Math.round(v.viewsPerDay))}</td>
                    <td className="text-right">
                      {v.subscriberRatio !== null ? v.subscriberRatio.toFixed(2) : '-'}
                    </td>
                    <td className="text-right">{formatMultiplier(v.outlierMultiplier)}</td>
                    <td className="text-right">{formatEngagement(v.engagementRate)}</td>
                    <td>{v.duration}</td>
                    <td className="whitespace-nowrap">{v.publishedDate}</td>
                    <td>
                      <a
                        href={v.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-500 hover:underline text-xs"
                      >
                        開く
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ヒートスコア表示：整数 ＋ ティアに応じた炎（B=🔥 / A=🔥🔥 / S=🔥🔥🔥）。null は「-」。
function formatHeat(score: number | null) {
  if (score === null) return <span className="text-slate-400">-</span>;
  const tier = getHeatTier(score);
  const fire = tier === 'S' ? '🔥🔥🔥' : tier === 'A' ? '🔥🔥' : tier === 'B' ? '🔥' : '';
  return (
    <span className="whitespace-nowrap">
      <span className={tier ? 'font-semibold text-heat-600' : ''}>{Math.round(score)}</span>
      {fire && <span className="ml-0.5">{fire}</span>}
    </span>
  );
}

// 分布マップ（登録者数×勢い）の折りたたみカード。初期状態は開いた状態。
function ScatterMapCard({ videos }: { videos: Video[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="card-header flex w-full items-center justify-between text-left"
      >
        <span>分布マップ（登録者数×勢い）</span>
        <span className="text-xs text-slate-400">{open ? '▲ 閉じる' : '▼ 開く'}</span>
      </button>
      {open && (
        <div className="card-body">
          <Suspense fallback={<ChartLoading />}>
            <ScatterHeatChart videos={videos} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

// グラフ遅延読み込み中の小さなフォールバック。
function ChartLoading() {
  return (
    <div className="flex h-[360px] items-center justify-center text-sm text-slate-400">
      グラフを読み込み中…
    </div>
  );
}

// 「今アツい動画 TOP5」ヒーロー。heatScore 上位をカード横並びで表示する。
function HeatHero({ videos }: { videos: Video[] }) {
  return (
    <div className="card">
      <div className="card-header">🔥 今アツい動画 TOP5</div>
      <div className="card-body">
        <div className="flex gap-3 overflow-x-auto snap-x pb-1">
          {videos.map((v, index) => (
            <HeatHeroCard key={v.videoId} video={v} rank={index + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HeatHeroCard({ video, rank }: { video: Video; rank: number }) {
  const score = Math.round(video.heatScore ?? 0);
  return (
    <a
      href={video.videoUrl}
      target="_blank"
      rel="noreferrer"
      className="group relative w-52 shrink-0 snap-start rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-heat-500 text-xs font-bold text-white shadow">
        {rank}
      </span>
      <div className="aspect-video w-full overflow-hidden rounded-t-xl bg-slate-100">
        {video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="p-3">
        <div className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-slate-800 group-hover:text-brand-600">
          {video.title}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <HeatGauge score={score} />
          <div className="flex flex-wrap gap-1">
            {video.subscriberRatio !== null && (
              <span className="badge bg-heat-50 text-heat-600">比×{video.subscriberRatio.toFixed(1)}</span>
            )}
            {video.outlierMultiplier !== null && (
              <span className="badge bg-rose-50 text-rose-600">倍×{video.outlierMultiplier.toFixed(1)}</span>
            )}
            {video.engagementRate !== null && (
              <span className="badge bg-slate-100 text-slate-600">エ {(video.engagementRate * 100).toFixed(0)}%</span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

// SVG 円形ゲージ（ライブラリ不要）。stroke-dasharray でスコアを表現し中央に数値を置く。
function HeatGauge({ score }: { score: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
      <circle cx="26" cy="26" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="5" />
      <circle
        cx="26"
        cy="26"
        r={radius}
        fill="none"
        stroke="#f97316"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="30" textAnchor="middle" className="fill-slate-800 text-sm font-bold">
        {score}
      </text>
    </svg>
  );
}

function formatMadeForKids(value: boolean | null): string {
  if (value === true) return '子ども向け';
  if (value === false) return '対象外';
  return '不明';
}

// アウトライアー倍率：同じチャンネルの中央値に対する倍率。2倍以上は強い外れ値として強調。
function formatMultiplier(value: number | null) {
  if (value === null) return <span className="text-slate-400">-</span>;
  const text = `×${value.toFixed(1)}`;
  if (value >= 2) return <span className="font-semibold text-rose-600">{text}</span>;
  return text;
}

function formatEngagement(value: number | null): string {
  if (value === null) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

function EmptyState() {
  return (
    <div className="card">
      <div className="card-body text-center text-slate-500">
        まだリサーチを実行していません。ホームでキーワードを入力して「▶ リサーチ実行」を押してください。
      </div>
    </div>
  );
}
