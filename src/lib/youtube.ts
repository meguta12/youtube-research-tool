import {
  AppConfig,
  getSearchRegion,
  isChannelAgeFilterActive,
  isSubscriberFilterActive,
  SearchParams,
  Video,
  YouTubeChannelItem,
  YouTubeSearchItem,
  YouTubeVideoItem
} from './types';
import {
  buildChannelUrl,
  buildQuery,
  buildVideoUrl,
  chunkArray,
  formatDate,
  formatDuration,
  getBestThumbnailUrl,
  getPublishedAfter,
  median,
  parseIsoDuration,
  toInteger,
  uniqueValues
} from './utils';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3/';

const ORDER_MAP: Record<string, string> = {
  視聴回数: 'viewCount',
  関連度: 'relevance',
  新着: 'date',
  評価: 'rating'
};

const DURATION_MAP: Record<string, string | null> = {
  ショート動画: 'short',
  横長動画: null,
  '4分未満（ショート寄り）': 'short',
  '4分未満': 'short',
  '4-20分': 'medium',
  '20分以上': 'long'
};

type YouTubeDurationFilter = 'short' | 'medium' | 'long';

export interface SearchVideoResult {
  ids: string[];
  searchCallCount: number;
}

async function fetchYouTubeApi<T>(endpoint: string, params: Record<string, string | number | undefined | null>): Promise<T> {
  const url = YOUTUBE_API_BASE + endpoint + '?' + buildQuery(params);
  const response = await fetch(url, { method: 'GET' });
  let json: any = {};
  try {
    json = await response.json();
  } catch {
    /* ignore parse error */
  }
  if (!response.ok || json?.error) {
    const message = json?.error?.message || `HTTP ${response.status}`;
    throw new Error(`YouTube APIエラー: ${message}`);
  }
  return json as T;
}

export async function testApiKey(apiKey: string): Promise<void> {
  await fetchYouTubeApi('search', {
    part: 'snippet',
    q: 'test',
    type: 'video',
    maxResults: 1,
    key: apiKey
  });
}

export async function searchVideoIds(params: SearchParams, config: AppConfig): Promise<SearchVideoResult> {
  const ids: string[] = [];
  const seen = new Set<string>();
  const candidateLimit = getSearchCandidateLimit(params);
  const durationFilters = getDurationFilters(params.duration);
  const states = durationFilters.map((duration) => ({
    duration,
    pageToken: '',
    exhausted: false
  }));
  let searchCallCount = 0;

  while (ids.length < candidateLimit && states.some((state) => !state.exhausted)) {
    for (const state of states) {
      if (state.exhausted || ids.length >= candidateLimit) continue;

      const pageSize = Math.min(50, candidateLimit - ids.length);
      const regionCode = params.regionCode || config.regionCode || 'JP';
      const query: Record<string, string | number | undefined> = {
        part: 'snippet',
        type: 'video',
        q: params.keyword,
        maxResults: pageSize,
        order: ORDER_MAP[params.order] || 'viewCount',
        regionCode,
        relevanceLanguage: getRelevanceLanguage(regionCode, config.language),
        key: config.apiKey
      };

      const publishedAfter = getPublishedAfter(params.period);
      if (publishedAfter) query.publishedAfter = publishedAfter;
      query.videoDuration = state.duration;
      if (state.pageToken) query.pageToken = state.pageToken;

      const response = await fetchYouTubeApi<{ items: YouTubeSearchItem[]; nextPageToken?: string }>(
        'search',
        query
      );
      searchCallCount += 1;

      const pageIds = (response.items || [])
        .map((item) => item.id?.videoId)
        .filter((v): v is string => Boolean(v));
      pageIds.forEach((id) => {
        if (!seen.has(id) && ids.length < candidateLimit) {
          seen.add(id);
          ids.push(id);
        }
      });

      state.pageToken = response.nextPageToken || '';
      if (!state.pageToken || pageIds.length === 0) state.exhausted = true;
    }
  }

  return { ids, searchCallCount };
}

export async function searchVideos(params: SearchParams, config: AppConfig): Promise<string[]> {
  const result = await searchVideoIds(params, config);
  return result.ids;
}

export async function getVideoDetails(ids: string[], config: AppConfig): Promise<YouTubeVideoItem[]> {
  const items: YouTubeVideoItem[] = [];
  for (const chunk of chunkArray(ids, 50)) {
    const response = await fetchYouTubeApi<{ items: YouTubeVideoItem[] }>('videos', {
      part: 'snippet,statistics,contentDetails,status',
      id: chunk.join(','),
      maxResults: 50,
      key: config.apiKey
    });
    items.push(...(response.items || []));
  }
  return items;
}

export async function getChannelDetails(ids: string[], config: AppConfig): Promise<YouTubeChannelItem[]> {
  const items: YouTubeChannelItem[] = [];
  for (const chunk of chunkArray(uniqueValues(ids), 50)) {
    const response = await fetchYouTubeApi<{ items: YouTubeChannelItem[] }>('channels', {
      part: 'snippet,statistics,status',
      id: chunk.join(','),
      maxResults: 50,
      key: config.apiKey
    });
    items.push(...(response.items || []));
  }
  return items;
}

export function filterExcludedVideos(items: YouTubeVideoItem[], config: AppConfig): YouTubeVideoItem[] {
  const excludeWords = config.excludeWords.map((word) => word.toLowerCase());
  const excludeChannelIds = config.excludeChannelIds;
  return items.filter((item) => {
    const title = String(item.snippet.title || '').toLowerCase();
    const channelId = String(item.snippet.channelId || '');
    const hasExcludedWord = excludeWords.some((word) => word && title.indexOf(word) !== -1);
    const hasExcludedChannel = excludeChannelIds.indexOf(channelId) !== -1;
    return !hasExcludedWord && !hasExcludedChannel;
  });
}

export function normalizeVideos(
  videoItems: YouTubeVideoItem[],
  channelMap: Record<string, YouTubeChannelItem>
): Video[] {
  const now = new Date();
  const videos: Video[] = videoItems
    .map((item) => {
      const snippet = item.snippet;
      const statistics = item.statistics || {};
      const contentDetails = item.contentDetails || { duration: 'PT0S' };
      const channel = channelMap[snippet.channelId] || ({} as YouTubeChannelItem);
      const channelStats = channel.statistics || {};
      const channelSnippet = channel.snippet || ({ title: '', publishedAt: '' } as YouTubeChannelItem['snippet']);
      const channelStatus = channel.status || {};
      const videoStatus = item.status || {};
      const channelMadeForKids =
        typeof channelStatus.madeForKids === 'boolean'
          ? channelStatus.madeForKids
          : typeof videoStatus.madeForKids === 'boolean'
            ? videoStatus.madeForKids
            : null;

      const publishedAt = new Date(snippet.publishedAt);
      const elapsedDays = Math.max(1, Math.ceil((now.getTime() - publishedAt.getTime()) / 86400000));
      const viewCount = toInteger(statistics.viewCount, 0);
      const likeCount = toInteger(statistics.likeCount, 0);
      const commentCount = toInteger(statistics.commentCount, 0);
      const subscriberCount = toInteger(channelStats.subscriberCount, 0);
      const viewsPerDay = viewCount / elapsedDays;
      const subscriberRatio = subscriberCount > 0 ? viewCount / subscriberCount : null;
      // エンゲージメント率 =（高評価＋コメント）÷ 再生数。視聴者の反応の濃さを測る。
      const engagementRate = viewCount > 0 ? (likeCount + commentCount) / viewCount : null;
      const durationSeconds = parseIsoDuration(contentDetails.duration || 'PT0S');
      const videoId = item.id;
      const channelId = snippet.channelId;

      return {
        videoId,
        channelId,
        title: snippet.title || '',
        channelTitle: channelSnippet.title || snippet.channelTitle || '',
        channelCountry: String(channelSnippet.country || '').toUpperCase(),
        channelMadeForKids,
        subscriberCount,
        channelVideoCount: toInteger(channelStats.videoCount, 0),
        channelPublishedAt: channelSnippet.publishedAt || '',
        viewCount,
        likeCount,
        commentCount,
        engagementRate,
        publishedAt: snippet.publishedAt || '',
        publishedDate: formatDate(publishedAt),
        elapsedDays,
        viewsPerDay,
        subscriberRatio,
        outlierMultiplier: null, // チャンネル別の中央値を後段で計算してから埋める
        duration: formatDuration(durationSeconds),
        durationSeconds,
        tags: (snippet.tags || []).join(', '),
        thumbnailUrl: getBestThumbnailUrl(snippet.thumbnails),
        videoUrl: buildVideoUrl(videoId),
        channelUrl: buildChannelUrl(channelId),
        risingFlag: subscriberRatio !== null && subscriberRatio > 1 ? '🔥' : ''
      } satisfies Video;
    });

  // アウトライアー倍率 = その動画の再生数 ÷ 同じチャンネルの中央値再生数（この取得結果内）。
  // 登録者数に依存しないので「大手でも跳ねた動画」を見つけられる。
  // ただし基準を作るにはそのチャンネルの動画が2本以上必要。1本だけなら null（判定不能）。
  // 基準はあえて絞り込み前の全取得動画で取る（サンプルが多いほど中央値が安定するため）。
  const viewsByChannel: Record<string, number[]> = {};
  videos.forEach((v) => {
    (viewsByChannel[v.channelId] ||= []).push(v.viewCount);
  });
  // 中央値はチャンネルごとに1回だけ計算（動画ごとに呼ぶと同じ配列を何度もソートしてしまう）。
  const medianByChannel: Record<string, number> = {};
  Object.keys(viewsByChannel).forEach((channelId) => {
    medianByChannel[channelId] = median(viewsByChannel[channelId]);
  });
  videos.forEach((v) => {
    const channelViews = viewsByChannel[v.channelId];
    if (!channelViews || channelViews.length < 2) return;
    const base = medianByChannel[v.channelId];
    v.outlierMultiplier = base > 0 ? v.viewCount / base : null;
  });

  return videos.sort((a, b) => b.viewsPerDay - a.viewsPerDay);
}

export function estimateQuota(videoCount: number, channelCount: number, searchCallCount: number = 1): number {
  const videoCalls = videoCount > 0 ? Math.ceil(videoCount / 50) : 0;
  const channelCalls = channelCount > 0 ? Math.ceil(channelCount / 50) : 0;
  return Math.max(1, searchCallCount) * 100 + videoCalls + channelCalls;
}

export function getSearchCandidateLimit(params: SearchParams): number {
  const requested = Math.max(1, Math.min(300, Number(params.maxResults) || 0));
  const hasAdvancedPostFilter =
    isSubscriberFilterActive(params) ||
    isChannelAgeFilterActive(params) ||
    params.kidsFilter !== 'all';

  if (hasAdvancedPostFilter) return getAdvancedCandidateLimit(requested);
  if (params.regionCode) return getRegionCandidateLimit(requested);
  return requested;
}

function getRegionCandidateLimit(requested: number): number {
  if (requested <= 10) return 50;
  if (requested <= 25) return 150;
  if (requested <= 50) return 250;
  return 300;
}

function getAdvancedCandidateLimit(requested: number): number {
  if (requested <= 10) return 150;
  if (requested <= 25) return 250;
  return 300;
}

/**
 * リサーチ実行前の "推定" 消費ユニット。
 * 実際の消費量はチャンネル重複の有無で多少前後しますが、
 * 上振れの最悪ケースで見積もります（ユーザーの予測に対する安全側）。
 *
 * 内訳:
 *   - search.list: 100 units × ceil(maxResults / 50)  ← 一番重い
 *   - videos.list:   1 unit  × ceil(maxResults / 50)
 *   - channels.list: 1 unit  × ceil(maxResults / 50)  ← 重複でもっと少なくなる事が多い
 */
export function estimateQuotaBeforeRun(params: SearchParams): number {
  const safeMax = getSearchCandidateLimit(params);
  const searchCalls = Math.ceil(safeMax / 50);
  const videoCalls = Math.ceil(safeMax / 50);
  const channelCalls = Math.ceil(safeMax / 50);
  const durationCount = getDurationFilters(params.duration || '横長動画').length;
  const sparseDurationBuffer = durationCount > 1 && safeMax > 50 ? 1 : 0;
  return (searchCalls + sparseDurationBuffer) * 100 + videoCalls + channelCalls;
}

function getDurationFilters(duration: SearchParams['duration'] | string): YouTubeDurationFilter[] {
  if (duration === 'ショート動画' || DURATION_MAP[duration] === 'short') return ['short'];
  if (DURATION_MAP[duration] === 'medium') return ['medium'];
  if (DURATION_MAP[duration] === 'long') return ['long'];
  return ['medium', 'long'];
}

function getRelevanceLanguage(regionCode: string, fallbackLanguage: string): string {
  const region = getSearchRegion(regionCode);
  return region.language || fallbackLanguage || 'ja';
}
