import { aggregateChannels, analyzeTitles } from './analyzer';
import {
  AppConfig,
  getChannelAgeFilter,
  getKidsFilter,
  getSearchRegion,
  getSubscriberRange,
  isChannelAgeFilterActive,
  isSubscriberFilterActive,
  normalizeKeyword,
  ResearchResult,
  SearchParams,
  Video,
  YouTubeVideoItem
} from './types';
import {
  estimateQuota,
  filterExcludedVideos,
  getChannelDetails,
  getVideoDetails,
  normalizeVideos,
  searchVideoIds
} from './youtube';
import { mapById, uniqueValues } from './utils';

export interface ResearchProgress {
  step: 'searching' | 'fetching-videos' | 'fetching-channels' | 'analyzing' | 'done';
  message: string;
}

/**
 * 登録者数による絞り込み（クライアント側のpost-filter）。
 * YouTube Data API は登録者数での検索が不可能なため、
 * 検索結果取得後に動画リストから条件外を除外する。
 */
export function applySubscriberFilter(videos: Video[], rangeKey: SearchParams['subscriberRange']): Video[] {
  const range = getSubscriberRange(rangeKey);
  if (range.key === 'all') return videos;
  return videos.filter((v) => {
    const count = v.subscriberCount;
    if (count < range.min) return false;
    if (range.max !== null && count >= range.max) return false;
    return true;
  });
}

/**
 * 地域による絞り込み（クライアント側のpost-filter）。
 * search.list の regionCode は「その国で視聴できる動画」寄りの指定で、
 * 投稿者やチャンネル所在地の厳密な絞り込みではないため、
 * チャンネルの country 情報も使って検索地域に近づける。
 *
 * strict=false（既定）: 国一致、または国情報が無い動画は含める。
 *   （country が空の US/GB/FR/DE 等が全滅する過剰除外を防ぐ）
 * strict=true: 国一致、または国情報が無い場合はテキストフォールバック一致のみ。
 */
export function applyRegionFilter(
  videos: Video[],
  regionCode: SearchParams['regionCode'],
  strict = false
): Video[] {
  const targetRegion = getSearchRegion(regionCode).code;

  return videos.filter((v) => {
    const country = String(v.channelCountry || '').toUpperCase();
    if (country) return country === targetRegion;
    if (!strict) return true;
    return matchesRegionTextFallback(v, targetRegion);
  });
}

/**
 * タイトル必含フィルタ（クライアント側のpost-filter）。
 * 正規化キーワードを空白で分割し、全トークンがタイトルに含まれる動画のみ残す。
 * 大文字小文字は無視し、両辺を NFKC 正規化して全角半角の差を吸収する。
 */
export function applyTitleMustContainFilter(videos: Video[], keyword: string): Video[] {
  const tokens = normalizeKeyword(keyword)
    .split(' ')
    .map((t) => t.normalize('NFKC').toLowerCase())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return videos;

  return videos.filter((v) => {
    const title = String(v.title || '').normalize('NFKC').toLowerCase();
    return tokens.every((token) => title.includes(token));
  });
}

/**
 * ライブ配信・配信予定の除外（クライアント側のpre-filter）。
 * liveBroadcastContent が 'live' / 'upcoming' の動画を落とす。
 * 'none' と欠落は残す（配信アーカイブは 'none' なので残る＝正しい）。
 */
export function filterOutLiveVideos(items: YouTubeVideoItem[]): YouTubeVideoItem[] {
  return items.filter((item) => {
    const state = item.snippet.liveBroadcastContent;
    return state !== 'live' && state !== 'upcoming';
  });
}

/**
 * チャンネル開設日による絞り込み（クライアント側のpost-filter）。
 * YouTube Data API はチャンネル開設日での動画検索ができないため、
 * チャンネル詳細取得後に動画リストから条件外を除外する。
 */
export function applyChannelAgeFilter(videos: Video[], ageKey: SearchParams['channelAge'], now = new Date()): Video[] {
  const filter = getChannelAgeFilter(ageKey);
  if (filter.months === null) return videos;

  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - filter.months);

  return videos.filter((v) => {
    if (!v.channelPublishedAt) return false;
    const publishedAt = new Date(v.channelPublishedAt);
    if (Number.isNaN(publishedAt.getTime())) return false;
    return publishedAt >= cutoff;
  });
}

/**
 * 子ども向けチャンネルによる絞り込み（クライアント側のpost-filter）。
 * YouTube API の madeForKids 情報が取れないチャンネルは、
 * 明示的な条件指定時には混ぜずに除外する。
 */
export function applyKidsFilter(videos: Video[], filterKey: SearchParams['kidsFilter']): Video[] {
  const filter = getKidsFilter(filterKey);
  if (filter.key === 'all') return videos;

  const expected = filter.key === 'made_for_kids';
  return videos.filter((v) => v.channelMadeForKids === expected);
}

function matchesRegionTextFallback(video: Video, regionCode: SearchParams['regionCode']): boolean {
  const text = `${video.title} ${video.channelTitle} ${video.tags}`;
  switch (regionCode) {
    case 'JP':
      return /[ぁ-んァ-ヶ一-龠々]/.test(text);
    case 'KR':
      return /[가-힣]/.test(text);
    case 'TW':
      return /[\u4e00-\u9fff]/.test(text);
    default:
      return false;
  }
}

export async function runResearch(
  params: SearchParams,
  config: AppConfig,
  onProgress?: (p: ResearchProgress) => void,
  signal?: AbortSignal
): Promise<ResearchResult> {
  if (!config.apiKey) throw new Error('YouTube APIキーが未設定です。');
  if (!params.keyword.trim()) throw new Error('キーワードを入力してください。');

  onProgress?.({ step: 'searching', message: '動画IDを検索中...' });
  const searchResult = await searchVideoIds(params, config, signal);
  const ids = searchResult.ids;
  if (ids.length === 0) {
    return {
      searchedAt: new Date().toISOString(),
      params,
      videos: [],
      channels: [],
      competitorStats: {
        topWords: [],
        topBigrams: [],
        titleLengthDistribution: {},
        weekdayDistribution: {},
        hourDistribution: {},
        durationDistribution: {}
      },
      estimatedQuota: Math.max(1, searchResult.searchCallCount) * 100,
      // 検索が途中失敗して0件になった場合も部分的だった旨を伝える。
      partial: searchResult.partial
    };
  }

  onProgress?.({ step: 'fetching-videos', message: '動画詳細を取得中...' });
  const videoDetail = await getVideoDetails(ids, config, signal);
  let videoItems = videoDetail.items;
  videoItems = filterExcludedVideos(videoItems, config);
  if (!params.includeLive) videoItems = filterOutLiveVideos(videoItems);

  onProgress?.({ step: 'fetching-channels', message: 'チャンネル詳細を取得中...' });
  const channelIds = uniqueValues(videoItems.map((item) => item.snippet.channelId));
  const channelDetail = await getChannelDetails(channelIds, config, signal);
  const channelItems = channelDetail.items;
  const channelMap = mapById(channelItems);

  onProgress?.({ step: 'analyzing', message: '分析中...' });
  const allVideos = normalizeVideos(videoItems, channelMap);
  const regionFilteredVideos = applyRegionFilter(allVideos, params.regionCode, params.regionStrict);
  const titleFilteredVideos = params.titleMustContain
    ? applyTitleMustContainFilter(regionFilteredVideos, params.keyword)
    : regionFilteredVideos;
  const ageFilteredVideos = isChannelAgeFilterActive(params)
    ? applyChannelAgeFilter(titleFilteredVideos, params.channelAge)
    : titleFilteredVideos;
  const kidsFilteredVideos = applyKidsFilter(ageFilteredVideos, params.kidsFilter);
  const subscriberFilteredVideos = isSubscriberFilterActive(params)
    ? applySubscriberFilter(kidsFilteredVideos, params.subscriberRange)
    : kidsFilteredVideos;
  const videos = subscriberFilteredVideos.slice(0, params.maxResults);
  const channels = aggregateChannels(videos, channelMap);
  const competitorStats = analyzeTitles(videos, config);
  const quota = estimateQuota(ids.length, channelIds.length, searchResult.searchCallCount);
  // 検索の部分終了、または動画・チャンネル詳細のchunkスキップがあれば「部分的」とする。
  const partial = Boolean(searchResult.partial) || videoDetail.partial || channelDetail.partial;

  onProgress?.({ step: 'done', message: '完了' });

  return {
    searchedAt: new Date().toISOString(),
    params,
    videos,
    channels,
    competitorStats,
    estimatedQuota: quota,
    partial
  };
}
