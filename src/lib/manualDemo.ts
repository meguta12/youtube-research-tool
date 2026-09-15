import { applyHeatScores } from './heat';
import { MyChannelData } from './myChannel';
import { ResearchProgress } from './research';
import { HistoryEntry, QuotaDailyRecord, QuotaState, Snapshot } from './storage';
import { AppConfig, ChannelRow, CompetitorStats, ResearchResult, SearchParams, Video } from './types';

export type ManualDemoMode =
  | 'license'
  | 'home'
  | 'progress'
  | 'videos'
  | 'channels'
  | 'competitors'
  | 'thumbnails'
  | 'history'
  | 'mychannel'
  | 'stocks';

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
    channelCountry: 'JP',
    channelMadeForKids: false,
    subscriberCount: 82000,
    channelVideoCount: 164,
    channelPublishedAt: '2023-01-08T00:00:00.000Z',
    viewCount: 248000,
    likeCount: 5200,
    commentCount: 312,
    engagementRate: 0.0222,
    publishedAt: '2026-04-14T11:00:00.000Z',
    publishedDate: '2026/04/14',
    elapsedDays: 14,
    viewsPerDay: 17714,
    subscriberRatio: 3.02,
    outlierMultiplier: 1.45,
    heatScore: null,
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
    channelCountry: 'JP',
    channelMadeForKids: false,
    subscriberCount: 41000,
    channelVideoCount: 91,
    channelPublishedAt: '2024-06-12T00:00:00.000Z',
    viewCount: 118000,
    likeCount: 2100,
    commentCount: 104,
    engagementRate: 0.0187,
    publishedAt: '2026-04-20T12:00:00.000Z',
    publishedDate: '2026/04/20',
    elapsedDays: 8,
    viewsPerDay: 14750,
    subscriberRatio: 2.88,
    outlierMultiplier: null,
    heatScore: null,
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
    channelCountry: 'JP',
    channelMadeForKids: false,
    subscriberCount: 82000,
    channelVideoCount: 164,
    channelPublishedAt: '2023-01-08T00:00:00.000Z',
    viewCount: 94000,
    likeCount: 1320,
    commentCount: 82,
    engagementRate: 0.0149,
    publishedAt: '2026-04-03T10:00:00.000Z',
    publishedDate: '2026/04/03',
    elapsedDays: 25,
    viewsPerDay: 3760,
    subscriberRatio: 1.15,
    outlierMultiplier: 0.55,
    heatScore: null,
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
    channelCountry: 'JP',
    channelMadeForKids: false,
    subscriberCount: 126000,
    channelVideoCount: 286,
    channelPublishedAt: '2022-03-15T00:00:00.000Z',
    viewCount: 88000,
    likeCount: 1650,
    commentCount: 120,
    engagementRate: 0.0201,
    publishedAt: '2026-04-10T14:00:00.000Z',
    publishedDate: '2026/04/10',
    elapsedDays: 18,
    viewsPerDay: 4889,
    subscriberRatio: 0.7,
    outlierMultiplier: null,
    heatScore: null,
    duration: '21:05',
    durationSeconds: 1265,
    tags: '動画編集, 副業, フリーランス',
    thumbnailUrl: SVG_TEMPLATE('動画編集副業の現実', '#ea580c'),
    videoUrl: 'https://www.youtube.com/watch?v=demo-video-04',
    channelUrl: 'https://www.youtube.com/channel/demo-channel-03',
    risingFlag: ''
  }
];

// デモの heatScore は本番と同じ式で埋める（手書きの値にしないことで式とのドリフトを防ぐ）。
applyHeatScores(demoVideos);

const demoChannels: ChannelRow[] = [
  {
    channelId: 'demo-channel-01',
    channelTitle: '副業ラボ',
    channelCountry: 'JP',
    channelMadeForKids: false,
    subscriberCount: 82000,
    totalVideoCount: 164,
    channelPublishedDate: '2023/01/08',
    operationMonths: 39,
    hitCount: 2,
    averageViews: 171000,
    medianViews: 171000,
    maxViews: 248000,
    reproducibilityScore: 0.0122,
    channelUrl: 'https://www.youtube.com/channel/demo-channel-01',
    isOpportunity: false
  },
  {
    channelId: 'demo-channel-02',
    channelTitle: '在宅ワーク研究所',
    channelCountry: 'JP',
    channelMadeForKids: false,
    subscriberCount: 41000,
    totalVideoCount: 91,
    channelPublishedDate: '2024/06/12',
    operationMonths: 22,
    hitCount: 1,
    averageViews: 118000,
    medianViews: 118000,
    maxViews: 118000,
    reproducibilityScore: 0.011,
    channelUrl: 'https://www.youtube.com/channel/demo-channel-02',
    isOpportunity: false
  },
  {
    channelId: 'demo-channel-04',
    channelTitle: 'おうちで稼ぐ大学',
    channelCountry: 'JP',
    channelMadeForKids: false,
    subscriberCount: 9600,
    totalVideoCount: 24,
    channelPublishedDate: '2025/08/02',
    operationMonths: 9,
    hitCount: 2,
    averageViews: 14200,
    medianViews: 14200,
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
  topBigrams: [
    { phrase: '在宅 ワーク', count: 6, averageViews: 96500 },
    { phrase: '副業 初心者', count: 5, averageViews: 88200 },
    { phrase: '会社員 副業', count: 4, averageViews: 79400 },
    { phrase: '動画 編集', count: 3, averageViews: 84000 }
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
  },
  // 行=月〜日 / 列=0-6/6-12/12-18/18-24時。行の和は weekdayDistribution、
  // 列の和は hourDistribution と一致させてある（辻褄合わせ済み）。
  weekdayHourMatrix: [
    [0, 1, 2, 1], // 月 = 4
    [0, 1, 3, 2], // 火 = 6
    [1, 1, 3, 3], // 水 = 8
    [0, 1, 2, 2], // 木 = 5
    [0, 2, 3, 2], // 金 = 7
    [0, 2, 4, 4], // 土 = 10
    [0, 1, 4, 5]  // 日 = 10
  ]
};

export const MANUAL_DEMO_RESULT: ResearchResult = {
  searchedAt: '2026-04-28T09:15:00.000Z',
  params: {
    keyword: '副業',
    period: '今月',
    duration: '横長動画',
    order: '視聴回数',
    maxResults: 50,
    subscriberRange: 'all',
    ignoreSubscriberFilter: false,
    regionCode: 'JP',
    regionStrict: false,
    channelAge: 'all',
    ignoreChannelAgeFilter: false,
    kidsFilter: 'all',
    titleMustContain: false,
    includeLive: false,
    economyMode: false,
    categoryId: '',
    broadSearch: false
  } satisfies SearchParams,
  videos: demoVideos,
  channels: demoChannels,
  competitorStats: demoCompetitorStats,
  estimatedQuota: 610
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
    estimatedQuota: 610
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

// ---- マイチャンネル分析デモ（?demo=mychannel） ----

// 自分のチャンネル1件分の動画6本。全て同一チャンネル（demo-my-channel）に属する。
const demoMyVideos: Video[] = [
  {
    videoId: 'demo-my-01',
    channelId: 'demo-my-channel',
    title: '【伸びた動画】初心者がまず見るべき副業ロードマップ完全版',
    channelTitle: 'めぐペン副業ラボ',
    channelCountry: 'JP',
    channelMadeForKids: false,
    subscriberCount: 12400,
    channelVideoCount: 48,
    channelPublishedAt: '2024-09-01T00:00:00.000Z',
    viewCount: 82000,
    likeCount: 2100,
    commentCount: 180,
    engagementRate: 0.0278,
    publishedAt: '2026-04-12T19:00:00.000Z',
    publishedDate: '2026-04-12',
    elapsedDays: 16,
    viewsPerDay: 5125,
    subscriberRatio: 6.61,
    outlierMultiplier: 3.42,
    heatScore: null,
    duration: '14:20',
    durationSeconds: 860,
    tags: '副業, 初心者, ロードマップ',
    thumbnailUrl: SVG_TEMPLATE('副業ロードマップ', '#2563eb'),
    videoUrl: 'https://www.youtube.com/watch?v=demo-my-01',
    channelUrl: 'https://www.youtube.com/channel/demo-my-channel',
    risingFlag: '🔥'
  },
  {
    videoId: 'demo-my-02',
    channelId: 'demo-my-channel',
    title: '在宅ワークで月10万円までの現実的な手順を全部話します',
    channelTitle: 'めぐペン副業ラボ',
    channelCountry: 'JP',
    channelMadeForKids: false,
    subscriberCount: 12400,
    channelVideoCount: 48,
    channelPublishedAt: '2024-09-01T00:00:00.000Z',
    viewCount: 41000,
    likeCount: 880,
    commentCount: 92,
    engagementRate: 0.0237,
    publishedAt: '2026-04-05T20:00:00.000Z',
    publishedDate: '2026-04-05',
    elapsedDays: 23,
    viewsPerDay: 1783,
    subscriberRatio: 3.31,
    outlierMultiplier: 1.71,
    heatScore: null,
    duration: '11:45',
    durationSeconds: 705,
    tags: '在宅ワーク, 副業, 月10万円',
    thumbnailUrl: SVG_TEMPLATE('在宅で月10万円', '#059669'),
    videoUrl: 'https://www.youtube.com/watch?v=demo-my-02',
    channelUrl: 'https://www.youtube.com/channel/demo-my-channel',
    risingFlag: '🔥'
  },
  {
    videoId: 'demo-my-03',
    channelId: 'demo-my-channel',
    title: '会社員が副業でやりがちな失敗トップ5と回避法',
    channelTitle: 'めぐペン副業ラボ',
    channelCountry: 'JP',
    channelMadeForKids: false,
    subscriberCount: 12400,
    channelVideoCount: 48,
    channelPublishedAt: '2024-09-01T00:00:00.000Z',
    viewCount: 23500,
    likeCount: 410,
    commentCount: 51,
    engagementRate: 0.0196,
    publishedAt: '2026-03-28T18:00:00.000Z',
    publishedDate: '2026-03-28',
    elapsedDays: 31,
    viewsPerDay: 758,
    subscriberRatio: 1.9,
    outlierMultiplier: 0.98,
    heatScore: null,
    duration: '9:32',
    durationSeconds: 572,
    tags: '会社員, 副業, 失敗',
    thumbnailUrl: SVG_TEMPLATE('副業の失敗5選', '#7c3aed'),
    videoUrl: 'https://www.youtube.com/watch?v=demo-my-03',
    channelUrl: 'https://www.youtube.com/channel/demo-my-channel',
    risingFlag: '🔥'
  },
  {
    videoId: 'demo-my-04',
    channelId: 'demo-my-channel',
    title: 'ブログ副業は2026年でも稼げるのか正直に検証した',
    channelTitle: 'めぐペン副業ラボ',
    channelCountry: 'JP',
    channelMadeForKids: false,
    subscriberCount: 12400,
    channelVideoCount: 48,
    channelPublishedAt: '2024-09-01T00:00:00.000Z',
    viewCount: 18800,
    likeCount: 300,
    commentCount: 40,
    engagementRate: 0.0181,
    publishedAt: '2026-03-15T12:00:00.000Z',
    publishedDate: '2026-03-15',
    elapsedDays: 44,
    viewsPerDay: 427,
    subscriberRatio: 1.52,
    outlierMultiplier: 0.78,
    heatScore: null,
    duration: '13:08',
    durationSeconds: 788,
    tags: 'ブログ, 副業, 検証',
    thumbnailUrl: SVG_TEMPLATE('ブログ副業の今', '#ea580c'),
    videoUrl: 'https://www.youtube.com/watch?v=demo-my-04',
    channelUrl: 'https://www.youtube.com/channel/demo-my-channel',
    risingFlag: '🔥'
  },
  {
    videoId: 'demo-my-05',
    channelId: 'demo-my-channel',
    title: '動画編集の副業を3ヶ月やってみた結果を全公開',
    channelTitle: 'めぐペン副業ラボ',
    channelCountry: 'JP',
    channelMadeForKids: false,
    subscriberCount: 12400,
    channelVideoCount: 48,
    channelPublishedAt: '2024-09-01T00:00:00.000Z',
    viewCount: 12100,
    likeCount: 160,
    commentCount: 22,
    engagementRate: 0.015,
    publishedAt: '2026-02-28T21:00:00.000Z',
    publishedDate: '2026-02-28',
    elapsedDays: 59,
    viewsPerDay: 205,
    subscriberRatio: 0.98,
    outlierMultiplier: 0.5,
    heatScore: null,
    duration: '16:44',
    durationSeconds: 1004,
    tags: '動画編集, 副業, 実践',
    thumbnailUrl: SVG_TEMPLATE('動画編集3ヶ月', '#0891b2'),
    videoUrl: 'https://www.youtube.com/watch?v=demo-my-05',
    channelUrl: 'https://www.youtube.com/channel/demo-my-channel',
    risingFlag: ''
  },
  {
    videoId: 'demo-my-06',
    channelId: 'demo-my-channel',
    title: '副業初心者が最初の1円を稼ぐまでにやったこと',
    channelTitle: 'めぐペン副業ラボ',
    channelCountry: 'JP',
    channelMadeForKids: false,
    subscriberCount: 12400,
    channelVideoCount: 48,
    channelPublishedAt: '2024-09-01T00:00:00.000Z',
    viewCount: 7600,
    likeCount: 95,
    commentCount: 14,
    engagementRate: 0.0143,
    publishedAt: '2026-02-10T17:00:00.000Z',
    publishedDate: '2026-02-10',
    elapsedDays: 77,
    viewsPerDay: 99,
    subscriberRatio: 0.61,
    outlierMultiplier: 0.32,
    heatScore: null,
    duration: '8:12',
    durationSeconds: 492,
    tags: '副業, 初心者, 最初の1円',
    thumbnailUrl: SVG_TEMPLATE('最初の1円', '#be123c'),
    videoUrl: 'https://www.youtube.com/watch?v=demo-my-06',
    channelUrl: 'https://www.youtube.com/channel/demo-my-channel',
    risingFlag: ''
  }
];

// デモの heatScore は本番と同じ式で埋める（手書きの値にしないことで式とのドリフトを防ぐ）。
applyHeatScores(demoMyVideos);

export const MANUAL_DEMO_MY_CHANNEL: MyChannelData = {
  channel: {
    id: 'demo-my-channel',
    title: 'めぐペン副業ラボ',
    thumbnailUrl: SVG_TEMPLATE('めぐペン副業ラボ', '#1a73e8'),
    subscriberCount: 12400,
    totalViewCount: 1840000,
    videoCount: 48,
    publishedAt: '2024-09-01T00:00:00.000Z'
  },
  videos: demoMyVideos,
  partial: false,
  fetchedVideoCount: demoMyVideos.length,
  estimatedQuota: 13
};

// 成長記録7日分（日本時間の 'YYYY-MM-DD'・日付昇順・登録者数が右肩上がり）。
export const MANUAL_DEMO_MY_CHANNEL_SNAPSHOTS: Snapshot[] = [
  { dateKey: '2026-04-22', subscriberCount: 11200, totalViewCount: 1698000, videoCount: 45 },
  { dateKey: '2026-04-23', subscriberCount: 11400, totalViewCount: 1715000, videoCount: 45 },
  { dateKey: '2026-04-24', subscriberCount: 11650, totalViewCount: 1732000, videoCount: 46 },
  { dateKey: '2026-04-25', subscriberCount: 11800, totalViewCount: 1758000, videoCount: 46 },
  { dateKey: '2026-04-26', subscriberCount: 12000, totalViewCount: 1786000, videoCount: 47 },
  { dateKey: '2026-04-27', subscriberCount: 12200, totalViewCount: 1812000, videoCount: 47 },
  { dateKey: '2026-04-28', subscriberCount: 12400, totalViewCount: 1840000, videoCount: 48 }
];

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
    'history',
    'mychannel',
    'stocks'
  ];
  return allowed.includes(raw as ManualDemoMode) ? (raw as ManualDemoMode) : null;
}
