export type PeriodKey = '今日' | '今週' | '今月' | '3ヶ月' | '全期間';
export type DurationKey = 'ショート動画' | '横長動画';
export type OrderKey = '視聴回数' | '関連度' | '新着' | '評価';
export type SearchRegionCode = 'JP' | 'US' | 'KR' | 'TW' | 'GB' | 'FR' | 'DE';
export type ChannelAgeKey = 'all' | 'within_6m' | 'within_1y' | 'within_3m' | 'within_1m';
export type KidsFilterKey = 'all' | 'made_for_kids' | 'not_made_for_kids';

export interface SearchRegion {
  code: SearchRegionCode;
  label: string;
  language: string;
}

export const SEARCH_REGIONS: SearchRegion[] = [
  { code: 'JP', label: '日本', language: 'ja' },
  { code: 'US', label: 'アメリカ', language: 'en' },
  { code: 'KR', label: '韓国', language: 'ko' },
  { code: 'TW', label: '台湾', language: 'zh' },
  { code: 'GB', label: 'イギリス', language: 'en' },
  { code: 'FR', label: 'フランス', language: 'fr' },
  { code: 'DE', label: 'ドイツ', language: 'de' }
];

export const MAX_RESULT_COUNTS = [10, 25, 50, 100, 200, 300] as const;

export interface ChannelAgeFilter {
  key: ChannelAgeKey;
  label: string;
  months: number | null; // null = 絞り込みなし
}

export const CHANNEL_AGE_FILTERS: ChannelAgeFilter[] = [
  { key: 'all', label: 'すべて', months: null },
  { key: 'within_6m', label: '半年以内', months: 6 },
  { key: 'within_1y', label: '1年以内', months: 12 },
  { key: 'within_3m', label: '3か月以内', months: 3 },
  { key: 'within_1m', label: '1か月以内', months: 1 }
];

export interface KidsFilter {
  key: KidsFilterKey;
  label: string;
}

export const KIDS_FILTERS: KidsFilter[] = [
  { key: 'all', label: 'すべて' },
  { key: 'made_for_kids', label: '子ども向けチャンネル' },
  { key: 'not_made_for_kids', label: '子ども向けではないチャンネル' }
];

export type SubscriberRangeKey =
  | 'all'
  | 'under_1k'
  | '1k_5k'
  | '5k_10k'
  | '10k_100k'
  | 'over_100k'
  | '1k_100k'
  | '100k_1m'
  | 'over_1m';

export interface SubscriberRange {
  key: SubscriberRangeKey;
  label: string;
  min: number;
  max: number | null; // null = 上限なし
  group?: string;
}

export const SUBSCRIBER_RANGES: SubscriberRange[] = [
  { key: 'all', label: '全て（絞り込みなし）', min: 0, max: null },
  { key: 'under_1k', label: '1,000人以下', min: 0, max: 1000, group: '細かく絞る' },
  { key: '1k_5k', label: '1,000〜5,000人', min: 1000, max: 5000, group: '細かく絞る' },
  { key: '5k_10k', label: '5,000〜10,000人', min: 5000, max: 10000, group: '細かく絞る' },
  { key: '10k_100k', label: '1万〜10万人', min: 10000, max: 100000, group: '細かく絞る' },
  { key: 'over_100k', label: '10万人以上', min: 100000, max: null, group: '細かく絞る' },
  { key: '1k_100k', label: '1,000〜10万人', min: 1000, max: 100000, group: '広めに絞る' },
  { key: '100k_1m', label: '10万〜100万人', min: 100000, max: 1000000, group: '広めに絞る' },
  { key: 'over_1m', label: '100万人以上', min: 1000000, max: null, group: '広めに絞る' }
];

export function getSubscriberRange(key: SubscriberRangeKey): SubscriberRange {
  return SUBSCRIBER_RANGES.find((r) => r.key === key) || SUBSCRIBER_RANGES[0];
}

export function getSearchRegion(code: string): SearchRegion {
  return SEARCH_REGIONS.find((r) => r.code === code) || SEARCH_REGIONS[0];
}

export function getChannelAgeFilter(key: string): ChannelAgeFilter {
  return CHANNEL_AGE_FILTERS.find((r) => r.key === key) || CHANNEL_AGE_FILTERS[0];
}

export function getKidsFilter(key: string): KidsFilter {
  return KIDS_FILTERS.find((r) => r.key === key) || KIDS_FILTERS[0];
}

export interface SearchParams {
  keyword: string;
  period: PeriodKey;
  duration: DurationKey;
  order: OrderKey;
  maxResults: number;
  subscriberRange: SubscriberRangeKey;
  ignoreSubscriberFilter: boolean;
  regionCode: SearchRegionCode;
  channelAge: ChannelAgeKey;
  ignoreChannelAgeFilter: boolean;
  kidsFilter: KidsFilterKey;
}

export function isSubscriberFilterActive(params: Pick<SearchParams, 'ignoreSubscriberFilter' | 'subscriberRange'>): boolean {
  return !params.ignoreSubscriberFilter && params.subscriberRange !== 'all';
}

export function isChannelAgeFilterActive(params: Pick<SearchParams, 'ignoreChannelAgeFilter' | 'channelAge'>): boolean {
  return !params.ignoreChannelAgeFilter && params.channelAge !== 'all';
}

export interface AppConfig {
  apiKey: string;
  excludeWords: string[];
  excludeChannelIds: string[];
  regionCode: string;
  language: string;
}

export interface Video {
  videoId: string;
  channelId: string;
  title: string;
  channelTitle: string;
  channelCountry: string;
  channelMadeForKids: boolean | null;
  subscriberCount: number;
  channelVideoCount: number;
  channelPublishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  engagementRate: number | null;
  publishedAt: string;
  publishedDate: string;
  elapsedDays: number;
  viewsPerDay: number;
  subscriberRatio: number | null;
  outlierMultiplier: number | null;
  duration: string;
  durationSeconds: number;
  tags: string;
  thumbnailUrl: string;
  videoUrl: string;
  channelUrl: string;
  risingFlag: string;
}

export interface ChannelRow {
  channelId: string;
  channelTitle: string;
  channelCountry: string;
  channelMadeForKids: boolean | null;
  subscriberCount: number;
  totalVideoCount: number;
  channelPublishedDate: string;
  operationMonths: number;
  hitCount: number;
  averageViews: number;
  medianViews: number;
  maxViews: number;
  reproducibilityScore: number;
  channelUrl: string;
  isOpportunity: boolean;
}

export interface CompetitorStats {
  topWords: Array<{ word: string; count: number; averageViews: number }>;
  titleLengthDistribution: Record<string, number>;
  weekdayDistribution: Record<string, number>;
  hourDistribution: Record<string, number>;
  durationDistribution: Record<string, number>;
}

export interface ResearchResult {
  searchedAt: string;
  params: SearchParams;
  videos: Video[];
  channels: ChannelRow[];
  competitorStats: CompetitorStats;
  estimatedQuota: number;
}

export interface YouTubeSearchItem {
  id: { videoId?: string };
  snippet: {
    channelId: string;
    title: string;
    channelTitle: string;
    thumbnails: Record<string, { url: string }>;
    publishedAt: string;
  };
}

export interface YouTubeVideoItem {
  id: string;
  snippet: {
    channelId: string;
    title: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: Record<string, { url: string }>;
    tags?: string[];
  };
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails: {
    duration: string;
  };
  status?: {
    madeForKids?: boolean;
  };
}

export interface YouTubeChannelItem {
  id: string;
  snippet: {
    title: string;
    publishedAt: string;
    country?: string;
  };
  statistics: {
    subscriberCount?: string;
    videoCount?: string;
  };
  status?: {
    madeForKids?: boolean;
  };
}
