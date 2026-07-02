import { HistoryEntry } from './storage';
import { normalizeKeyword, ResearchResult } from './types';

// スナップショットに保持する上限。履歴の肥大化を避けつつ比較に十分な件数を確保する。
const TOP_VIDEO_LIMIT = 30;
const TOP_CHANNEL_LIMIT = 20;
// 比較パネルに列挙する新規チャンネルの最大表示数。
const NEW_CHANNEL_DISPLAY_LIMIT = 10;

export interface TrendSnapshot {
  topVideoIds: string[];
  topChannels: Array<{ id: string; title: string }>;
}

/**
 * ResearchResult から比較用のコンパクトなスナップショットを生成する。
 * 上位動画IDと上位チャンネル（重複排除）を先頭から一定件数だけ保持する。
 */
export function buildTrendSnapshot(result: ResearchResult): TrendSnapshot {
  const topVideoIds = result.videos
    .map((v) => v.videoId)
    .filter((id) => Boolean(id))
    .slice(0, TOP_VIDEO_LIMIT);

  const topChannels: Array<{ id: string; title: string }> = [];
  const seen = new Set<string>();
  for (const v of result.videos) {
    if (!v.channelId || seen.has(v.channelId)) continue;
    seen.add(v.channelId);
    topChannels.push({ id: v.channelId, title: v.channelTitle });
    if (topChannels.length >= TOP_CHANNEL_LIMIT) break;
  }

  return { topVideoIds, topChannels };
}

export interface TrendComparison {
  hasPrev: boolean;
  prevDate?: string;
  newVideoCount: number;
  newChannels: Array<{ id: string; title: string }>;
  goneChannelCount: number;
}

/**
 * 現在の結果と履歴一覧から、同一キーワード（正規化一致）かつ現在より前の
 * 最新エントリを1件探して差分を返す。該当が無ければ hasPrev=false。
 *
 * 履歴は pushHistory で先頭が最新のため、先頭から順に探すと最初に見つかった
 * ものが「今より前の最新」になる。古いエントリはスナップショットが undefined の
 * ことがあるため、その場合は比較対象にせず次を探す。
 */
export function compareWithPrevious(result: ResearchResult, history: HistoryEntry[]): TrendComparison {
  const empty: TrendComparison = {
    hasPrev: false,
    newVideoCount: 0,
    newChannels: [],
    goneChannelCount: 0
  };

  const currentKeyword = normalizeKeyword(result.params.keyword);
  if (!currentKeyword) return empty;

  const prev = history.find((h) => {
    if (normalizeKeyword(h.keyword) !== currentKeyword) return false;
    // 今回の実行より前のエントリのみを対象にする。
    if (h.searchedAt >= result.searchedAt) return false;
    // スナップショットが無い古いエントリは比較できないため除外する。
    return Array.isArray(h.topVideoIds) || Array.isArray(h.topChannels);
  });
  if (!prev) return empty;

  const current = buildTrendSnapshot(result);
  const prevVideoIds = new Set(prev.topVideoIds ?? []);
  const prevChannelIds = new Set((prev.topChannels ?? []).map((c) => c.id));
  const currentChannelIds = new Set(current.topChannels.map((c) => c.id));

  const newVideoCount = current.topVideoIds.filter((id) => !prevVideoIds.has(id)).length;
  const newChannels = current.topChannels
    .filter((c) => !prevChannelIds.has(c.id))
    .slice(0, NEW_CHANNEL_DISPLAY_LIMIT);
  const goneChannelCount = (prev.topChannels ?? []).filter((c) => !currentChannelIds.has(c.id)).length;

  return {
    hasPrev: true,
    prevDate: prev.searchedAt,
    newVideoCount,
    newChannels,
    goneChannelCount
  };
}
