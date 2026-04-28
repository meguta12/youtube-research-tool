import { aggregateChannels, analyzeTitles } from './analyzer';
import { AppConfig, ResearchResult, SearchParams } from './types';
import {
  estimateQuota,
  filterExcludedVideos,
  getChannelDetails,
  getVideoDetails,
  normalizeVideos,
  searchVideos
} from './youtube';
import { mapById, uniqueValues } from './utils';

export interface ResearchProgress {
  step: 'searching' | 'fetching-videos' | 'fetching-channels' | 'analyzing' | 'done';
  message: string;
}

export async function runResearch(
  params: SearchParams,
  config: AppConfig,
  onProgress?: (p: ResearchProgress) => void
): Promise<ResearchResult> {
  if (!config.apiKey) throw new Error('YouTube APIキーが未設定です。');
  if (!params.keyword.trim()) throw new Error('キーワードを入力してください。');

  onProgress?.({ step: 'searching', message: '動画IDを検索中...' });
  const ids = await searchVideos(params, config);
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
      estimatedQuota: 100
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
  const videos = normalizeVideos(videoItems, channelMap);
  const channels = aggregateChannels(videos, channelMap);
  const competitorStats = analyzeTitles(videos, config);
  const quota = estimateQuota(ids.length, channelIds.length);

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
