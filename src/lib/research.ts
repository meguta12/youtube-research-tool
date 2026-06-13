import { aggregateChannels, analyzeTitles } from './analyzer';
import {
  AppConfig,
  getChannelAgeFilter,
  getKidsFilter,
  getSearchRegion,
  getSubscriberRange,
  isChannelAgeFilterActive,
  isSubscriberFilterActive,
  ResearchResult,
  SearchParams,
  Video
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
 */
export function applyRegionFilter(videos: Video[], regionCode: SearchParams['regionCode']): Video[] {
  const targetRegion = getSearchRegion(regionCode).code;

  return videos.filter((v) => {
    const country = String(v.channelCountry || '').toUpperCase();
    if (country) return country === targetRegion;
    return matchesRegionTextFallback(v, targetRegion);
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
  onProgress?: (p: ResearchProgress) => void
): Promise<ResearchResult> {
  if (!config.apiKey) throw new Error('YouTube APIキーが未設定です。');
  if (!params.keyword.trim()) throw new Error('キーワードを入力してください。');

  onProgress?.({ step: 'searching', message: '動画IDを検索中...' });
  const searchResult = await searchVideoIds(params, config);
  const ids = searchResult.ids;
  if (ids.length === 0) {
    return {
      searchedAt: new Date().toISOString(),
      params,
      videos: [],
      channels: [],
      competitorStats: {
        topWords: [],
        titleLengthDistribution: {},
        weekdayDistribution: {},
        hourDistribution: {},
        durationDistribution: {}
      },
      estimatedQuota: Math.max(1, searchResult.searchCallCount) * 100
    };
  }

  onProgress?.({ step: 'fetching-videos', message: '動画詳細を取得中...' });
  let videoItems = await getVideoDetails(ids, config);
  videoItems = filterExcludedVideos(videoItems, config);

  onProgress?.({ step: 'fetching-channels', message: 'チャンネル詳細を取得中...' });
  const channelIds = uniqueValues(videoItems.map((item) => item.snippet.channelId));
  const channelItems = await getChannelDetails(channelIds, config);
  const channelMap = mapById(channelItems);

  onProgress?.({ step: 'analyzing', message: '分析中...' });
  const allVideos = normalizeVideos(videoItems, channelMap);
  const regionFilteredVideos = applyRegionFilter(allVideos, params.regionCode);
  const ageFilteredVideos = isChannelAgeFilterActive(params)
    ? applyChannelAgeFilter(regionFilteredVideos, params.channelAge)
    : regionFilteredVideos;
  const kidsFilteredVideos = applyKidsFilter(ageFilteredVideos, params.kidsFilter);
  const subscriberFilteredVideos = isSubscriberFilterActive(params)
    ? applySubscriberFilter(kidsFilteredVideos, params.subscriberRange)
    : kidsFilteredVideos;
  const videos = subscriberFilteredVideos.slice(0, params.maxResults);
  const channels = aggregateChannels(videos, channelMap);
  const competitorStats = analyzeTitles(videos, config);
  const quota = estimateQuota(ids.length, channelIds.length, searchResult.searchCallCount);

  onProgress?.({ step: 'done', message: '完了' });

  return {
    searchedAt: new Date().toISOString(),
    params,
    videos,
    channels,
    competitorStats,
    estimatedQuota: quota
  };
}
