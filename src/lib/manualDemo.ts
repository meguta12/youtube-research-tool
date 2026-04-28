import { ResearchProgress } from './research';
import { HistoryEntry, QuotaDailyRecord, QuotaState } from './storage';
import { AppConfig, ChannelRow, CompetitorStats, ResearchResult, SearchParams, Video } from './types';

export type ManualDemoMode =
  | 'license'
  | 'home'
  | 'progress'
  | 'videos'
  | 'channels'
  | 'competitors'
  | 'thumbnails'
  | 'history';

const SVG_TEMPLATE = (title: string, accent: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" fill="#0f172a"/>
      <rect x="18" y="18" width="604" height="324" rx="18" fill="${accent}"/>
      <rect x="38" y="38" width="564" height="284" rx="14" fill="rgba(255,255,255,0.14)"/>
      <text x="42" y="78" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff">YouTube Research Tool</text>
      <text x="42" y="128" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#ffffff">${title}</text>
      <text x="42" y="298" font-family="Arial, sans-serif" font-size="18" fill="#e2e8f0">Manual demo thumbnail</text>
    </svg>`
  )}`;

const demoVideos: Video[] = [
  {
    videoId: 'demo-video-01',
    channelId: 'demo-channel-01',
    title: '【副業】会社員が月5万円を作るために最初にやること5選',
    channelTitle: '副業ラボ',
    subscriberCount: 82000,
    channelVideoCount: 164,
    channelPublishedAt: '2023-01-08T00:00:00.000Z',
    viewCount: 248000,
    likeCount: 5200,
    commentCount: 312,
    publishedAt: '2026-04-14T11:00:00.000Z',
    publishedDate: '2026/04/14',
    elapsedDays: 14,
    viewsPerDay: 17714,
    subscriberRatio: 3.02,
    duration: '12:44',
    durationSeconds: 764,
    tags: '副業, 在宅ワーク, お金',
    thumbnailUrl: SVG_TEMPLATE('副業で月5万円を作る', '#2563eb'),
    videoUrl: 'https://www.youtube.com/watch?v=demo-video-01',
    channelUrl: 'https://www.youtube.com/channel/demo-channel-01',
    risingFlag: '🔥'
  },
  {
    videoId: 'demo-video-02',
    channelId: 'demo-channel-02',
    title: '初心者向け 在宅ワークの始め方 2026年版',
    channelTitle: '在宅ワーク研究所',
    subscriberCount: 41000,
    channelVideoCount: 91,
    channelPublishedAt: '2024-06-12T00:00:00.000Z',
    viewCount: 118000,
    likeCount: 2100,
    commentCount: 104,
    publishedAt: '2026-04-20T12:00:00.000Z',
    publishedDate: '2026/04/20',
    elapsedDays: 8,
    viewsPerDay: 14750,
    subscriberRatio: 2.88,
    duration: '8:21',
    durationSeconds: 501,
    tags: '在宅ワーク, 初心者, 副業',
    thumbnailUrl: SVG_TEMPLATE('在宅ワークの始め方', '#059669'),
    videoUrl: 'https://www.youtube.com/watch?v=demo-video-02',
    channelUrl: 'https://www.youtube.com/channel/demo-channel-02',
    risingFlag: '🔥'
  },
  {
    videoId: 'demo-video-03',
    channelId: 'demo-channel-01',
    title: '副業で失敗しない人の共通点 ベスト7',
    channelTitle: '副業ラボ',
    subscriberCount: 82000,
    channelVideoCount: 164,
    channelPublishedAt: '2023-01-08T00:00:00.000Z',
    viewCount: 94000,
    likeCount: 1320,
    commentCount: 82,
    publishedAt: '2026-04-03T10:00:00.000Z',
    publishedDate: '2026/04/03',
    elapsedDays: 25,
    viewsPerDay: 3760,
    subscriberRatio: 1.15,
    duration: '16:18',
    durationSeconds: 978,
    tags: '副業, 失敗, 会社員',
    thumbnailUrl: SVG_TEMPLATE('副業で失敗しない人', '#7c3aed'),
    videoUrl: 'https://www.youtube.com/watch?v=demo-video-03',
    channelUrl: 'https://www.youtube.com/channel/demo-channel-01',
    risingFlag: '🔥'
  },
  {
    videoId: 'demo-video-04',
    channelId: 'demo-channel-03',
    title: '動画編集副業は今からでも遅くない？現実的な収益ライン',
    channelTitle: '編集者の働き方',
    subscriberCount: 126000,
    channelVideoCount: 286,
    channelPublishedAt: '2022-03-15T00:00:00.000Z',
    viewCount: 88000,
    likeCount: 1650,
    commentCount: 120,
    publishedAt: '2026-04-10T14:00:00.000Z',
    publishedDate: '2026/04/10',
    elapsedDays: 18,
    viewsPerDay: 4889,
    subscriberRatio: 0.7,
    duration: '21:05',
    durationSeconds: 1265,
    tags: '動画編集, 副業, フリーランス',
    thumbnailUrl: SVG_TEMPLATE('動画編集副業の現実', '#ea580c'),
    videoUrl: 'https://www.youtube.com/watch?v=demo-video-04',
    channelUrl: 'https://www.youtube.com/channel/demo-channel-03',
    risingFlag: ''
  }
];

const demoChannels: ChannelRow[] = [
  {
    channelId: 'demo-channel-01',
    channelTitle: '副業ラボ',
    subscriberCount: 82000,
    totalVideoCount: 164,
    channelPublishedDate: '2023/01/08',
    operationMonths: 39,
    hitCount: 2,
    averageViews: 171000,
    maxViews: 248000,
    reproducibilityScore: 0.0122,
    channelUrl: 'https://www.youtube.com/channel/demo-channel-01',
    isOpportunity: false
  },
  {
    channelId: 'demo-channel-02',
    channelTitle: '在宅ワーク研究所',
    subscriberCount: 41000,
    totalVideoCount: 91,
    channelPublishedDate: '2024/06/12',
    operationMonths: 22,
    hitCount: 1,
    averageViews: 118000,
    maxViews: 118000,
    reproducibilityScore: 0.011,
    channelUrl: 'https://www.youtube.com/channel/demo-channel-02',
    isOpportunity: false
  },
  {
    channelId: 'demo-channel-04',
    channelTitle: 'おうちで稼ぐ大学',
    subscriberCount: 9600,
    totalVideoCount: 24,
    channelPublishedDate: '2025/08/02',
    operationMonths: 9,
    hitCount: 2,
    averageViews: 14200,
    maxViews: 21000,
    reproducibilityScore: 0.0833,
    channelUrl: 'https://www.youtube.com/channel/demo-channel-04',
    isOpportunity: true
  }
];

const demoCompetitorStats: CompetitorStats = {
  topWords: [
    { word: '副業', count: 12, averageViews: 128000 },
    { word: '初心者', count: 9, averageViews: 84500 },
    { word: '在宅', count: 7, averageViews: 90200 },
    { word: '会社員', count: 5, averageViews: 73100 },
    { word: '月5万円', count: 4, averageViews: 166000 }
  ],
  titleLengthDistribution: {
    '10文字以下': 1,
    '11-20文字': 11,
    '21-30文字': 24,
    '31文字以上': 14
  },
  weekdayDistribution: {
    '月': 4,
    '火': 6,
    '水': 8,
    '木': 5,
    '金': 7,
    '土': 10,
    '日': 10
  },
  hourDistribution: {
    '0-6時': 1,
    '6-12時': 9,
    '12-18時': 21,
    '18-24時': 19
  },
  durationDistribution: {
    '4分未満': 2,
    '4-10分': 14,
    '10-20分': 23,
    '20分以上': 11
  }
};

export const MANUAL_DEMO_RESULT: ResearchResult = {
  searchedAt: '2026-04-28T09:15:00.000Z',
  params: {
    keyword: '副業',
    period: '今月',
    duration: '4-20分',
    order: '視聴回数',
    maxResults: 50
  } satisfies SearchParams,
  videos: demoVideos,
  channels: demoChannels,
  competitorStats: demoCompetitorStats,
  estimatedQuota: 132
};

export const MANUAL_DEMO_CONFIG: AppConfig = {
  apiKey: 'AIzaDemoManualKeyForScreensOnly123456789',
  excludeWords: ['切り抜き'],
  excludeChannelIds: ['UC_OFFICIAL_SAMPLE_001'],
  regionCode: 'JP',
  language: 'ja'
};

export const MANUAL_DEMO_QUOTA: QuotaState = {
  dateKey: '2026-04-28',
  used: 350,
  searchCount: 3
};

export const MANUAL_DEMO_HISTORY: HistoryEntry[] = [
  {
    searchedAt: '2026-04-28T09:15:00.000Z',
    keyword: '副業',
    count: 50,
    estimatedQuota: 132
  },
  {
    searchedAt: '2026-04-27T18:42:00.000Z',
    keyword: 'ダイエット',
    count: 25,
    estimatedQuota: 118
  },
  {
    searchedAt: '2026-04-26T14:10:00.000Z',
    keyword: '英語学習',
    count: 25,
    estimatedQuota: 100
  }
];

export const MANUAL_DEMO_QUOTA_DAYS: QuotaDailyRecord[] = [
  { dateKey: '2026-04-28', used: 350, searchCount: 3 },
  { dateKey: '2026-04-27', used: 820, searchCount: 6 },
  { dateKey: '2026-04-26', used: 1280, searchCount: 9 },
  { dateKey: '2026-04-25', used: 4500, searchCount: 21 },
  { dateKey: '2026-04-24', used: 7600, searchCount: 39 },
  { dateKey: '2026-04-23', used: 9200, searchCount: 47 },
  { dateKey: '2026-04-22', used: 1800, searchCount: 12 }
];

export const MANUAL_DEMO_PROGRESS: ResearchProgress = {
  step: 'fetching-channels',
  message: '③チャンネル詳細を取得中...'
};

export function getManualDemoMode(): ManualDemoMode | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('demo');
  const allowed: ManualDemoMode[] = [
    'license',
    'home',
    'progress',
    'videos',
    'channels',
    'competitors',
    'thumbnails',
    'history'
  ];
  return allowed.includes(raw as ManualDemoMode) ? (raw as ManualDemoMode) : null;
}
