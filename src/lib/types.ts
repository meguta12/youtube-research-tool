export type PeriodKey = '今日' | '今週' | '今月' | '3ヶ月' | '全期間';
export type DurationKey = '全て' | '4分未満（ショート寄り）' | '4-20分' | '20分以上';
export type OrderKey = '視聴回数' | '関連度' | '新着' | '評価';

export interface SearchParams {
  keyword: string;
  period: PeriodKey;
  duration: DurationKey;
  order: OrderKey;
  maxResults: number;
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
  subscriberCount: number;
  channelVideoCount: number;
  channelPublishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  publishedDate: string;
  elapsedDays: number;
  viewsPerDay: number;
  subscriberRatio: number | null;
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
  subscriberCount: number;
  totalVideoCount: number;
  channelPublishedDate: string;
  operationMonths: number;
  hitCount: number;
  averageViews: number;
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
}

export interface YouTubeChannelItem {
  id: string;
  snippet: {
    title: string;
    publishedAt: string;
  };
  statistics: {
    subscriberCount?: string;
    videoCount?: string;
  };
}
