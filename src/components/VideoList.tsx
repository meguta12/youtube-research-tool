import { useMemo, useState } from 'react';
import { Video } from '../lib/types';
import { formatNumber } from '../lib/utils';

interface VideoListProps {
  videos: Video[];
}

type SortKey =
  | 'viewsPerDay'
  | 'viewCount'
  | 'subscriberRatio'
  | 'outlierMultiplier'
  | 'engagementRate'
  | 'publishedAt'
  | 'subscriberCount'
  | 'durationSeconds';

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
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
  const [sortKey, setSortKey] = useState<SortKey>('viewsPerDay');
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

  if (videos.length === 0) {
    return <EmptyState />;
  }

  return (
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
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th className="w-32">サムネ</th>
              <th>タイトル</th>
              <th>チャンネル</th>
              <th>国</th>
              <th>子ども向け</th>
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
            {sorted.map((v) => (
              <tr key={v.videoId} className="hover:bg-slate-50">
                <td>
                  {v.thumbnailUrl && (
                    <a href={v.videoUrl} target="_blank" rel="noreferrer">
                      <img
                        src={v.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="h-16 w-28 rounded object-cover"
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
                  {v.risingFlag && <span className="ml-1">{v.risingFlag}</span>}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
