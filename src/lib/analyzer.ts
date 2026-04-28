import { AppConfig, ChannelRow, CompetitorStats, Video, YouTubeChannelItem } from './types';
import { formatDate, getMonthDiff, uniqueValues } from './utils';

export function aggregateChannels(videos: Video[], _channelMap: Record<string, YouTubeChannelItem>): ChannelRow[] {
  const grouped: Record<string, {
    channelId: string;
    channelTitle: string;
    subscriberCount: number;
    totalVideoCount: number;
    channelPublishedAt: string;
    hitCount: number;
    totalViews: number;
    maxViews: number;
    channelUrl: string;
  }> = {};

  videos.forEach((video) => {
    if (!grouped[video.channelId]) {
      grouped[video.channelId] = {
        channelId: video.channelId,
        channelTitle: video.channelTitle,
        subscriberCount: video.subscriberCount,
        totalVideoCount: video.channelVideoCount,
        channelPublishedAt: video.channelPublishedAt,
        hitCount: 0,
        totalViews: 0,
        maxViews: 0,
        channelUrl: video.channelUrl
      };
    }
    const group = grouped[video.channelId];
    group.hitCount += 1;
    group.totalViews += video.viewCount;
    group.maxViews = Math.max(group.maxViews, video.viewCount);
  });

  return Object.keys(grouped)
    .map<ChannelRow>((channelId) => {
      const group = grouped[channelId];
      const averageViews = group.hitCount > 0 ? group.totalViews / group.hitCount : 0;
      const reproducibilityScore =
        group.totalVideoCount > 0 ? group.hitCount / group.totalVideoCount : 0;
      const operationMonths = group.channelPublishedAt
        ? getMonthDiff(new Date(group.channelPublishedAt), new Date())
        : 0;
      return {
        channelId,
        channelTitle: group.channelTitle,
        subscriberCount: group.subscriberCount,
        totalVideoCount: group.totalVideoCount,
        channelPublishedDate: group.channelPublishedAt
          ? formatDate(new Date(group.channelPublishedAt))
          : '',
        operationMonths,
        hitCount: group.hitCount,
        averageViews,
        maxViews: group.maxViews,
        reproducibilityScore,
        channelUrl: group.channelUrl,
        isOpportunity: operationMonths < 12 && averageViews > 10000
      };
    })
    .sort((a, b) => b.reproducibilityScore - a.reproducibilityScore);
}

export function analyzeTitles(videos: Video[], config: AppConfig): CompetitorStats {
  const wordStats: Record<string, { word: string; count: number; totalViews: number }> = {};
  const stopWords = getDefaultStopWords().concat(config.excludeWords || []);

  videos.forEach((video) => {
    const words = extractTitleWords(video.title, stopWords);
    words.forEach((word) => {
      if (!wordStats[word]) wordStats[word] = { word, count: 0, totalViews: 0 };
      wordStats[word].count += 1;
      wordStats[word].totalViews += video.viewCount;
    });
  });

  const topWords = Object.keys(wordStats)
    .map((word) => ({
      word,
      count: wordStats[word].count,
      averageViews: wordStats[word].totalViews / wordStats[word].count
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.averageViews - a.averageViews;
    })
    .slice(0, 20);

  return {
    topWords,
    titleLengthDistribution: countByBuckets(videos, getTitleLengthBucket),
    weekdayDistribution: countByBuckets(videos, getWeekdayBucket),
    hourDistribution: countByBuckets(videos, getHourBucket),
    durationDistribution: countByBuckets(videos, getDurationBucket)
  };
}

function extractTitleWords(title: string, stopWords: string[]): string[] {
  const normalized = String(title || '')
    .replace(
      /[【】「」『』（）()\[\]{}<>＜＞!！?？:：;；,，.。/／\\|｜"“”'’`~〜\-ー_＿+＋=＝*&％%$＄#＃@＠^＾]/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];

  const stopWordMap: Record<string, boolean> = {};
  stopWords.forEach((word) => {
    const normalizedWord = String(word || '').toLowerCase().trim();
    if (normalizedWord) stopWordMap[normalizedWord] = true;
  });

  const tokens = normalized.match(/[A-Za-z0-9０-９Ａ-Ｚａ-ｚぁ-んァ-ン一-龠々]+/g) || [];
  return uniqueValues(
    tokens
      .map((token) => token.toLowerCase())
      .filter((token) => {
        if (token.length < 2) return false;
        if (/^[0-9０-９]+$/.test(token)) return false;
        if (/^[ぁ-ん]+$/.test(token) && token.length <= 2) return false;
        if (stopWordMap[token]) return false;
        return true;
      })
  );
}

export function getDefaultStopWords(): string[] {
  return [
    'youtube', 'youtu', 'shorts', 'short', 'video', 'official', '公式',
    'する', 'した', 'して', 'です', 'ます', 'これ', 'それ', 'あれ',
    'この', 'その', 'ある', 'ない', 'ため', 'こと', 'もの', 'よう',
    'から', 'まで', 'だけ', 'とは', 'なぜ', '解説', '完全', '保存版'
  ];
}

function countByBuckets<T>(items: T[], bucketFn: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  items.forEach((item) => {
    const bucket = bucketFn(item);
    result[bucket] = (result[bucket] || 0) + 1;
  });
  return result;
}

function getTitleLengthBucket(video: Video): string {
  const length = String(video.title || '').length;
  if (length <= 10) return '10文字以下';
  if (length <= 20) return '11-20文字';
  if (length <= 30) return '21-30文字';
  return '31文字以上';
}

function getWeekdayBucket(video: Video): string {
  const labels = ['日', '月', '火', '水', '木', '金', '土'];
  return labels[new Date(video.publishedAt).getDay()];
}

function getHourBucket(video: Video): string {
  const hour = new Date(video.publishedAt).getHours();
  if (hour < 6) return '0-6時';
  if (hour < 12) return '6-12時';
  if (hour < 18) return '12-18時';
  return '18-24時';
}

function getDurationBucket(video: Video): string {
  const seconds = video.durationSeconds || 0;
  if (seconds < 240) return '4分未満';
  if (seconds < 600) return '4-10分';
  if (seconds < 1200) return '10-20分';
  return '20分以上';
}
