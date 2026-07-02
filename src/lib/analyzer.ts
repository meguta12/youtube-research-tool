import { tokenizeJapanese } from './tokenizer';
import { AppConfig, ChannelRow, CompetitorStats, Video, YouTubeChannelItem } from './types';
import { formatDate, getMonthDiff, median, uniqueValues } from './utils';

export function aggregateChannels(videos: Video[], _channelMap: Record<string, YouTubeChannelItem>): ChannelRow[] {
  const grouped: Record<string, {
    channelId: string;
    channelTitle: string;
    channelCountry: string;
    channelMadeForKids: boolean | null;
    subscriberCount: number;
    totalVideoCount: number;
    channelPublishedAt: string;
    hitCount: number;
    totalViews: number;
    maxViews: number;
    views: number[];
    channelUrl: string;
  }> = {};

  videos.forEach((video) => {
    if (!grouped[video.channelId]) {
      grouped[video.channelId] = {
        channelId: video.channelId,
        channelTitle: video.channelTitle,
        channelCountry: video.channelCountry,
        channelMadeForKids: video.channelMadeForKids,
        subscriberCount: video.subscriberCount,
        totalVideoCount: video.channelVideoCount,
        channelPublishedAt: video.channelPublishedAt,
        hitCount: 0,
        totalViews: 0,
        maxViews: 0,
        views: [],
        channelUrl: video.channelUrl
      };
    }
    const group = grouped[video.channelId];
    group.hitCount += 1;
    group.totalViews += video.viewCount;
    group.maxViews = Math.max(group.maxViews, video.viewCount);
    group.views.push(video.viewCount);
  });

  return Object.keys(grouped)
    .map<ChannelRow>((channelId) => {
      const group = grouped[channelId];
      const averageViews = group.hitCount > 0 ? group.totalViews / group.hitCount : 0;
      const medianViews = median(group.views);
      const reproducibilityScore =
        group.totalVideoCount > 0 ? group.hitCount / group.totalVideoCount : 0;
      const operationMonths = group.channelPublishedAt
        ? getMonthDiff(new Date(group.channelPublishedAt), new Date())
        : 0;
      return {
        channelId,
        channelTitle: group.channelTitle,
        channelCountry: group.channelCountry,
        channelMadeForKids: group.channelMadeForKids,
        subscriberCount: group.subscriberCount,
        totalVideoCount: group.totalVideoCount,
        channelPublishedDate: group.channelPublishedAt
          ? formatDate(new Date(group.channelPublishedAt))
          : '',
        operationMonths,
        hitCount: group.hitCount,
        averageViews,
        medianViews,
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
    topBigrams: analyzeBigrams(videos, stopWords),
    titleLengthDistribution: countByBuckets(videos, getTitleLengthBucket),
    weekdayDistribution: countByBuckets(videos, getWeekdayBucket),
    hourDistribution: countByBuckets(videos, getHourBucket),
    durationDistribution: countByBuckets(videos, getDurationBucket)
  };
}

/**
 * 頻出「2語の組み合わせ」（隣接バイグラム）分析。
 * 各タイトルのトークン列からストップワード・ノイズを除いたうえで、
 * 隣り合う2語のペアを作り、出現回数×平均再生数で上位を出す。
 * 語順・隣接が意味を持つため、単語頻度と違い1タイトル内の重複や順序は保持する。
 */
function analyzeBigrams(
  videos: Video[],
  stopWords: string[]
): Array<{ phrase: string; count: number; averageViews: number }> {
  const bigramStats: Record<string, { phrase: string; count: number; totalViews: number }> = {};

  videos.forEach((video) => {
    const sequence = extractTitleWordSequence(video.title, stopWords);
    for (let i = 0; i + 1 < sequence.length; i++) {
      const phrase = `${sequence[i]} ${sequence[i + 1]}`;
      if (!bigramStats[phrase]) bigramStats[phrase] = { phrase, count: 0, totalViews: 0 };
      bigramStats[phrase].count += 1;
      bigramStats[phrase].totalViews += video.viewCount;
    }
  });

  return Object.keys(bigramStats)
    .map((phrase) => ({
      phrase,
      count: bigramStats[phrase].count,
      averageViews: bigramStats[phrase].totalViews / bigramStats[phrase].count
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.averageViews - a.averageViews;
    })
    .slice(0, 15);
}

// ストップワード・ノイズを除いたトークン判定。単語頻度とバイグラムで共通利用する。
function isMeaningfulToken(token: string, stopWordMap: Record<string, boolean>): boolean {
  if (token.length < 2) return false;
  if (/^[0-9０-９]+$/.test(token)) return false;
  if (/^[ぁ-ん]+$/.test(token) && token.length <= 2) return false;
  if (stopWordMap[token]) return false;
  return true;
}

function buildStopWordMap(stopWords: string[]): Record<string, boolean> {
  const stopWordMap: Record<string, boolean> = {};
  stopWords.forEach((word) => {
    const normalizedWord = String(word || '').toLowerCase().trim();
    if (normalizedWord) stopWordMap[normalizedWord] = true;
  });
  return stopWordMap;
}

function extractTitleWords(title: string, stopWords: string[]): string[] {
  const stopWordMap = buildStopWordMap(stopWords);
  const tokens = tokenizeJapanese(title);
  return uniqueValues(
    tokens
      .map((token) => token.toLowerCase())
      .filter((token) => isMeaningfulToken(token, stopWordMap))
  );
}

// バイグラム用: 隣接関係を保つため重複除去せず、順序を保ったフィルタ済みトークン列を返す。
function extractTitleWordSequence(title: string, stopWords: string[]): string[] {
  const stopWordMap = buildStopWordMap(stopWords);
  return tokenizeJapanese(title)
    .map((token) => token.toLowerCase())
    .filter((token) => isMeaningfulToken(token, stopWordMap));
}

export function getDefaultStopWords(): string[] {
  return [
    'youtube', 'youtu', 'shorts', 'short', 'video', 'official', '公式',
    'する', 'した', 'して', 'です', 'ます', 'これ', 'それ', 'あれ',
    'この', 'その', 'ある', 'ない', 'ため', 'こと', 'もの', 'よう',
    'から', 'まで', 'だけ', 'とは', 'なぜ', '解説', '完全', '保存版',
    // タイトルに頻出する文法的なひらがな断片（単語頻度・バイグラム双方のノイズ低減）。
    'なる', 'なった', 'いる', 'できる', 'やる', 'みる', 'かも', 'けど',
    'たい', 'たら', 'なら', 'ので', 'のに', 'より', 'など', 'って',
    'ましょう', 'ください', 'しない', 'くない', 'までの', 'にやること',
    'るために', 'からでも', 'ていく', 'ておく'
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

// 日本はサマータイムがないので UTC+9h 固定で日本時間に変換してよい。
function toJst(publishedAt: string): Date {
  return new Date(new Date(publishedAt).getTime() + 9 * 3600 * 1000);
}

function getWeekdayBucket(video: Video): string {
  const labels = ['日', '月', '火', '水', '木', '金', '土'];
  return labels[toJst(video.publishedAt).getUTCDay()];
}

function getHourBucket(video: Video): string {
  const hour = toJst(video.publishedAt).getUTCHours();
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
