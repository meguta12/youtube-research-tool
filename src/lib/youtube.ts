import {
  AppConfig,
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
  全て: null,
  '4分未満（ショート寄り）': 'short',
  '4分未満': 'short',
  '4-20分': 'medium',
  '20分以上': 'long'
};

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

export async function searchVideos(params: SearchParams, config: AppConfig): Promise<string[]> {
  const ids: string[] = [];
  let pageToken = '';

  while (ids.length < params.maxResults) {
    const pageSize = Math.min(50, params.maxResults - ids.length);
    const query: Record<string, string | number | undefined> = {
      part: 'snippet',
      type: 'video',
      q: params.keyword,
      maxResults: pageSize,
      order: ORDER_MAP[params.order] || 'viewCount',
      regionCode: config.regionCode || 'JP',
      relevanceLanguage: config.language || 'ja',
      key: config.apiKey
    };

    const publishedAfter = getPublishedAfter(params.period);
    if (publishedAfter) query.publishedAfter = publishedAfter;
    const videoDuration = DURATION_MAP[params.duration];
    if (videoDuration) query.videoDuration = videoDuration;
    if (pageToken) query.pageToken = pageToken;

    const response = await fetchYouTubeApi<{ items: YouTubeSearchItem[]; nextPageToken?: string }>(
      'search',
      query
    );
    const pageIds = (response.items || [])
      .map((item) => item.id?.videoId)
      .filter((v): v is string => Boolean(v));
    ids.push(...pageIds);

    pageToken = response.nextPageToken || '';
    if (!pageToken || pageIds.length === 0) break;
  }

  return uniqueValues(ids).slice(0, params.maxResults);
}

export async function getVideoDetails(ids: string[], config: AppConfig): Promise<YouTubeVideoItem[]> {
  const items: YouTubeVideoItem[] = [];
  for (const chunk of chunkArray(ids, 50)) {
    const response = await fetchYouTubeApi<{ items: YouTubeVideoItem[] }>('videos', {
      part: 'snippet,statistics,contentDetails',
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
      part: 'snippet,statistics',
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
  return videoItems
    .map((item) => {
      const snippet = item.snippet;
      const statistics = item.statistics || {};
      const contentDetails = item.contentDetails || { duration: 'PT0S' };
      const channel = channelMap[snippet.channelId] || ({} as YouTubeChannelItem);
      const channelStats = channel.statistics || {};
      const channelSnippet = channel.snippet || ({ title: '', publishedAt: '' } as YouTubeChannelItem['snippet']);

      const publishedAt = new Date(snippet.publishedAt);
      const elapsedDays = Math.max(1, Math.ceil((now.getTime() - publishedAt.getTime()) / 86400000));
      const viewCount = toInteger(statistics.viewCount, 0);
      const subscriberCount = toInteger(channelStats.subscriberCount, 0);
      const viewsPerDay = viewCount / elapsedDays;
      const subscriberRatio = subscriberCount > 0 ? viewCount / subscriberCount : null;
      const durationSeconds = parseIsoDuration(contentDetails.duration || 'PT0S');
      const videoId = item.id;
      const channelId = snippet.channelId;

      return {
        videoId,
        channelId,
        title: snippet.title || '',
        channelTitle: channelSnippet.title || snippet.channelTitle || '',
        subscriberCount,
        channelVideoCount: toInteger(channelStats.videoCount, 0),
        channelPublishedAt: channelSnippet.publishedAt || '',
        viewCount,
        likeCount: toInteger(statistics.likeCount, 0),
        commentCount: toInteger(statistics.commentCount, 0),
        publishedAt: snippet.publishedAt || '',
        publishedDate: formatDate(publishedAt),
        elapsedDays,
        viewsPerDay,
        subscriberRatio,
        duration: formatDuration(durationSeconds),
        durationSeconds,
        tags: (snippet.tags || []).join(', '),
        thumbnailUrl: getBestThumbnailUrl(snippet.thumbnails),
        videoUrl: buildVideoUrl(videoId),
        channelUrl: buildChannelUrl(channelId),
        risingFlag: subscriberRatio !== null && subscriberRatio > 1 ? '🔥' : ''
      } satisfies Video;
    })
    .sort((a, b) => b.viewsPerDay - a.viewsPerDay);
}

export function estimateQuota(videoCount: number, channelCount: number): number {
  const videoCalls = Math.ceil(Math.max(videoCount || 0, 1) / 50);
  const channelCalls = Math.ceil(Math.max(channelCount || 0, 1) / 50);
  return 100 + videoCalls + channelCalls;
}
