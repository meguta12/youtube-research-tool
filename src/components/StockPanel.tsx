import { useMemo, useState } from 'react';
import { getHeatTier } from '../lib/heat';
import { StockedVideo } from '../lib/storage';
import { downloadStocksAsCsv } from '../lib/exporter';
import { formatDateTime, formatNumber } from '../lib/utils';
import {
  IconBookmark,
  IconDownload,
  IconExternal,
  IconPencil,
  IconRefresh,
  IconSearch,
  IconTag,
  IconTrash
} from './icons';

interface StockPanelProps {
  stocks: StockedVideo[];
  onRemove: (id: string) => void;
  onRemoveGroup: (keyword: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  onRerun: (keyword: string) => void;
  onGoHome: () => void;
}

type SortKey = 'stockedAt' | 'heatScore' | 'viewCount' | 'viewsPerDay' | 'subscriberRatio' | 'publishedAt';

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'stockedAt', label: '保存が新しい順' },
  { key: 'heatScore', label: 'ヒートスコア' },
  { key: 'viewCount', label: '再生数' },
  { key: 'viewsPerDay', label: '1日平均再生数' },
  { key: 'subscriberRatio', label: '登録者比' },
  { key: 'publishedAt', label: '公開日（新しい順）' }
];

interface StockGroup {
  keyword: string;
  count: number;
  latestStockedAt: string;
}

/**
 * ストック画面。検索キーワード（グループ）のチップで絞り込み、カードグリッドで一覧する。
 * データの読み書きは App 側（storage.ts）が担い、ここは表示と操作の呼び出しだけ。
 */
export function StockPanel({ stocks, onRemove, onRemoveGroup, onUpdateMemo, onRerun, onGoHome }: StockPanelProps) {
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('stockedAt');

  // キーワード別グループ。最後に保存した日時が新しい順に並べる。
  const groups = useMemo<StockGroup[]>(() => {
    const map = new Map<string, StockGroup>();
    for (const s of stocks) {
      const g = map.get(s.keyword);
      if (g) {
        g.count += 1;
        if (s.stockedAt > g.latestStockedAt) g.latestStockedAt = s.stockedAt;
      } else {
        map.set(s.keyword, { keyword: s.keyword, count: 1, latestStockedAt: s.stockedAt });
      }
    }
    return [...map.values()].sort((a, b) => (a.latestStockedAt < b.latestStockedAt ? 1 : -1));
  }, [stocks]);

  // 選択中のグループが（削除などで）消えたら「すべて」に戻す。
  const activeKeyword = selectedKeyword && groups.some((g) => g.keyword === selectedKeyword) ? selectedKeyword : null;
  const activeGroup = activeKeyword ? groups.find((g) => g.keyword === activeKeyword) ?? null : null;

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = stocks.filter((s) => {
      if (activeKeyword && s.keyword !== activeKeyword) return false;
      if (!q) return true;
      return (
        s.video.title.toLowerCase().includes(q) ||
        s.video.channelTitle.toLowerCase().includes(q) ||
        s.memo.toLowerCase().includes(q)
      );
    });
    return list.sort((a, b) => {
      switch (sortKey) {
        case 'stockedAt':
          return a.stockedAt < b.stockedAt ? 1 : -1;
        case 'heatScore':
          return (b.video.heatScore ?? -1) - (a.video.heatScore ?? -1);
        case 'viewCount':
          return b.video.viewCount - a.video.viewCount;
        case 'viewsPerDay':
          return b.video.viewsPerDay - a.video.viewsPerDay;
        case 'subscriberRatio':
          return (b.video.subscriberRatio ?? -1) - (a.video.subscriberRatio ?? -1);
        case 'publishedAt':
          return new Date(b.video.publishedAt).getTime() - new Date(a.video.publishedAt).getTime();
      }
    });
  }, [stocks, activeKeyword, filter, sortKey]);

  if (stocks.length === 0) {
    return <EmptyState onGoHome={onGoHome} />;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="section-icon bg-brand-50 text-brand-600">
              <IconBookmark size={16} filled />
            </span>
            <span>ストック</span>
            <span className="badge bg-slate-100 text-slate-600">{stocks.length}件</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-normal">
            <label className="relative">
              <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="タイトル・チャンネル・メモで絞り込み"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="input w-64 pl-8"
              />
            </label>
            <select className="input w-44" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>並び順: {opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary"
              disabled={visible.length === 0}
              onClick={() => downloadStocksAsCsv(visible, activeKeyword ? `stocks-${activeKeyword}.csv` : 'stocks.csv')}
              title="表示中のストックをCSVで保存"
            >
              <IconDownload size={15} />
              CSV
            </button>
          </div>
        </div>
        <div className="card-body space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <GroupChip active={activeKeyword === null} label="すべて" count={stocks.length} onClick={() => setSelectedKeyword(null)} />
            {groups.map((g) => (
              <GroupChip
                key={g.keyword}
                active={activeKeyword === g.keyword}
                label={g.keyword}
                count={g.count}
                onClick={() => setSelectedKeyword(g.keyword)}
              />
            ))}
          </div>
          {activeGroup && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
              <div className="text-slate-600">
                「<span className="font-semibold text-slate-800">{activeGroup.keyword}</span>」で検索して保存した動画
                <span className="ml-2 text-xs text-slate-400">最終保存 {formatDateTime(new Date(activeGroup.latestStockedAt))}</span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="btn-ghost text-xs" onClick={() => onRerun(activeGroup.keyword)}>
                  <IconRefresh size={14} />
                  このキーワードで再検索
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    if (confirm(`「${activeGroup.keyword}」のストック ${activeGroup.count}件 をすべて削除しますか？`)) {
                      onRemoveGroup(activeGroup.keyword);
                    }
                  }}
                >
                  <IconTrash size={14} />
                  グループごと削除
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <div className="card-body py-10 text-center text-sm text-slate-500">絞り込み条件に合うストックがありません。</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((s) => (
            <StockCard
              key={s.id}
              stock={s}
              showKeyword={activeKeyword === null}
              onRemove={() => onRemove(s.id)}
              onUpdateMemo={(memo) => onUpdateMemo(s.id, memo)}
              onSelectKeyword={() => setSelectedKeyword(s.keyword)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupChip({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`chip ${active ? 'chip-active' : ''}`}
    >
      {label !== 'すべて' && <IconTag size={13} className={active ? 'text-white/80' : 'text-slate-400'} />}
      <span className="max-w-[14rem] truncate">{label}</span>
      <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
        {count}
      </span>
    </button>
  );
}

function StockCard({
  stock,
  showKeyword,
  onRemove,
  onUpdateMemo,
  onSelectKeyword
}: {
  stock: StockedVideo;
  showKeyword: boolean;
  onRemove: () => void;
  onUpdateMemo: (memo: string) => void;
  onSelectKeyword: () => void;
}) {
  const v = stock.video;
  const tier = getHeatTier(v.heatScore);
  return (
    <article className="card flex flex-col overflow-hidden">
      <div className="relative aspect-video bg-slate-100">
        <a href={v.videoUrl} target="_blank" rel="noreferrer" className="block h-full w-full">
          {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
        </a>
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">{v.duration}</span>
        {v.heatScore !== null && (
          <span
            className={`absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white ${
              tier === 'S' ? 'bg-heat-500' : tier ? 'bg-heat-500/80' : 'bg-black/60'
            }`}
          >
            🔥 {Math.round(v.heatScore)}
          </span>
        )}
        {showKeyword && (
          <button
            type="button"
            onClick={onSelectKeyword}
            className="absolute left-1.5 top-1.5 inline-flex max-w-[80%] items-center gap-1 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-white"
            title="このキーワードだけ表示"
          >
            <IconTag size={12} className="text-brand-500" />
            <span className="truncate">{stock.keyword}</span>
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <a
          href={v.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 min-h-[2.6rem] text-sm font-medium leading-snug text-slate-800 hover:text-brand-600"
        >
          {v.title}
        </a>
        <a href={v.channelUrl} target="_blank" rel="noreferrer" className="truncate text-xs text-slate-500 hover:text-brand-600">
          {v.channelTitle}
        </a>
        <dl className="grid grid-cols-3 gap-1 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px]">
          <div>
            <dt className="text-slate-400">再生数</dt>
            <dd className="font-semibold tabular-nums text-slate-800">{formatNumber(v.viewCount)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">1日平均</dt>
            <dd className="font-semibold tabular-nums text-slate-800">{formatNumber(Math.round(v.viewsPerDay))}</dd>
          </div>
          <div>
            <dt className="text-slate-400">登録者比</dt>
            <dd className="font-semibold tabular-nums text-slate-800">{v.subscriberRatio !== null ? `×${v.subscriberRatio.toFixed(1)}` : '-'}</dd>
          </div>
        </dl>
        <MemoField memo={stock.memo} onSave={onUpdateMemo} />
        <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-slate-400">
          <span>保存 {formatDateTime(new Date(stock.stockedAt))}</span>
          <div className="flex items-center gap-0.5">
            <a href={v.videoUrl} target="_blank" rel="noreferrer" className="btn-icon" title="YouTubeで開く" aria-label="YouTubeで開く">
              <IconExternal size={15} />
            </a>
            <button type="button" className="btn-icon hover:bg-rose-50 hover:text-rose-600" title="ストックから外す" aria-label="ストックから外す" onClick={onRemove}>
              <IconTrash size={15} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

// メモ欄。クリックで編集に切り替え、フォーカスが外れるか Cmd/Ctrl+Enter で保存、Esc で取り消し。
function MemoField({ memo, onSave }: { memo: string; onSave: (memo: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next !== memo) onSave(next);
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        className="input h-20 resize-none text-xs"
        value={draft}
        placeholder="メモ（なぜ気になったか、参考にしたい点など）"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(memo);
            setEditing(false);
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            commit();
          }
        }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(memo);
        setEditing(true);
      }}
      className={`flex w-full items-start gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-left text-xs transition-colors ${
        memo
          ? 'border-transparent bg-amber-50/70 text-slate-700 hover:border-amber-200'
          : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
      }`}
    >
      <IconPencil size={13} className="mt-0.5 shrink-0 opacity-70" />
      <span className="line-clamp-3 whitespace-pre-wrap break-words">{memo || 'メモを追加'}</span>
    </button>
  );
}

function EmptyState({ onGoHome }: { onGoHome: () => void }) {
  return (
    <div className="card">
      <div className="card-body flex flex-col items-center py-14 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
          <IconBookmark size={30} />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-slate-800">まだストックがありません</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
          動画リストやサムネ一覧の
          <span className="mx-1 inline-flex h-6 w-6 translate-y-1 items-center justify-center rounded-md bg-slate-100 text-slate-500 align-middle">
            <IconBookmark size={14} />
          </span>
          を押すと、その動画がここに保存されます。保存した動画は「どのキーワードで検索したか」ごとに自動で分類されます。
        </p>
        <button type="button" className="btn-primary mt-6" onClick={onGoHome}>
          <IconSearch size={15} />
          ホームでリサーチする
        </button>
      </div>
    </div>
  );
}
