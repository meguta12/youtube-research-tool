import { useEffect, useMemo, useState } from 'react';
import { getHeatTier } from '../lib/heat';
import { Video } from '../lib/types';
import { formatNumber, truncateText } from '../lib/utils';
import { downloadThumbnails } from '../lib/thumbnailDownload';

interface ThumbnailGalleryProps {
  videos: Video[];
}

type DownloadState = 'idle' | 'downloading' | 'done';
type SortKey = 'viewCount' | 'heatScore';

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'viewCount', label: '再生数' },
  { key: 'heatScore', label: 'ヒートスコア' }
];

export function ThumbnailGallery({ videos }: ThumbnailGalleryProps) {
  // 選択中の videoId 集合。検索結果が変わったらリセットする。
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('viewCount');

  const sorted = useMemo(() => {
    return [...videos].sort((a, b) => {
      if (sortKey === 'heatScore') return (b.heatScore ?? -1) - (a.heatScore ?? -1);
      return b.viewCount - a.viewCount;
    });
  }, [videos, sortKey]);

  // videos（検索結果）が変わったら選択と完了メッセージをリセットする。
  useEffect(() => {
    setSelected(new Set());
    setDownloadState('idle');
    setResultMessage('');
  }, [videos]);

  if (videos.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center text-slate-500">
          リサーチを実行すると、再生数順にサムネ一覧が並びます。
        </div>
      </div>
    );
  }

  const allSelected = selected.size === sorted.length && sorted.length > 0;

  function toggleOne(videoId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  }

  function toggleAll() {
    // 1件以上選択済みなら全解除、0件なら全選択にするトグル。
    if (selected.size > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((v) => v.videoId)));
    }
  }

  async function handleDownload() {
    const targets = sorted.filter((v) => selected.has(v.videoId));
    if (targets.length === 0) return;
    setDownloadState('downloading');
    setResultMessage('');
    try {
      const { successCount, failCount } = await downloadThumbnails(targets);
      if (successCount === 0) {
        setResultMessage('サムネイルの取得に失敗しました。時間をおいて、もう一度お試しください。');
      } else {
        const failNote = failCount > 0 ? `（${failCount}枚は取得に失敗しました）` : '';
        setResultMessage(`${successCount}枚ダウンロードしました${failNote}`);
      }
    } catch {
      setResultMessage('サムネイルの取得に失敗しました。時間をおいて、もう一度お試しください。');
    } finally {
      setDownloadState('done');
      // 完了メッセージは数秒後に消す。
      window.setTimeout(() => {
        setDownloadState('idle');
        setResultMessage('');
      }, 4000);
    }
  }

  const downloading = downloadState === 'downloading';

  return (
    <div className="card">
      <div className="card-header flex flex-wrap items-center justify-between gap-2">
        <span>サムネ一覧</span>
        <div className="flex flex-wrap items-center gap-2 text-sm font-normal">
          <select
            className="input w-40"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>並び順: {opt.label}</option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={toggleAll}>
            {selected.size > 0 ? '選択解除' : 'すべて選択'}
          </button>
          <span className="text-slate-600">{selected.size}件選択中</span>
          <button
            type="button"
            className="btn-primary"
            onClick={handleDownload}
            disabled={selected.size === 0 || downloading}
          >
            {downloading ? 'ダウンロード中...' : '選択したサムネイルをダウンロード'}
          </button>
          {resultMessage && (
            <span className={resultMessage.includes('失敗しました。') ? 'text-rose-700' : 'text-emerald-700'}>
              {resultMessage}
            </span>
          )}
        </div>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sorted.map((v) => {
            const isSelected = selected.has(v.videoId);
            return (
              <div key={v.videoId} className="group">
                <div
                  className={`relative overflow-hidden rounded-md bg-slate-100 ${
                    isSelected ? 'ring-2 ring-brand-500' : ''
                  }`}
                >
                  <a href={v.videoUrl} target="_blank" rel="noreferrer" className="block">
                    {v.thumbnailUrl && (
                      <img
                        src={v.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="w-full aspect-video object-cover group-hover:scale-105 transition-transform"
                      />
                    )}
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                      {v.duration}
                    </span>
                    {v.heatScore !== null && (
                      <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-heat-500">
                        {formatHeatBadge(v.heatScore)}
                      </span>
                    )}
                  </a>
                  {/* チェックボックスはリンク遷移を発火させないよう独立して配置する。 */}
                  <label
                    className="absolute left-1 top-1 flex cursor-pointer items-center justify-center rounded bg-black/50 p-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-brand-500"
                      checked={isSelected}
                      onChange={() => toggleOne(v.videoId)}
                    />
                  </label>
                </div>
                <a href={v.videoUrl} target="_blank" rel="noreferrer" className="block">
                  <div className="mt-1.5 text-xs">
                    <div className="font-semibold text-slate-800">
                      {formatNumber(v.viewCount)}回
                    </div>
                    <div className="text-slate-600 line-clamp-2">{truncateText(v.title, 40)}</div>
                  </div>
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// サムネカード右上のヒートバッジ。VideoList の🔥表記ルールに合わせる。
function formatHeatBadge(score: number): string {
  const tier = getHeatTier(score);
  const fire = tier === 'S' ? '🔥🔥🔥' : tier === 'A' ? '🔥🔥' : tier === 'B' ? '🔥' : '';
  return `${Math.round(score)}${fire}`;
}
