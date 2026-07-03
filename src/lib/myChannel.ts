import { applyHeatScores } from './heat';
import { AppConfig, Video, YouTubeChannelItem } from './types';
import { chunkArray, toInteger } from './utils';
import { fetchYouTubeApi, getVideoDetails, normalizeVideos } from './youtube';

// マイチャンネル分析の取得結果。channel は表示用サマリー、videos は既存 Video 型（heatScore 適用済み）。
export interface MyChannelData {
  channel: {
    id: string;
    title: string;
    thumbnailUrl: string;
    subscriberCount: number;
    totalViewCount: number;
    videoCount: number;
    publishedAt: string;
  };
  videos: Video[];
  partial: boolean;
  fetchedVideoCount: number;
  estimatedQuota: number; // 実測ベース（呼び出し回数から算出）
}

// channels.list のレスポンス（マイチャンネル取得で使う part=snippet,statistics,contentDetails）。
interface MyChannelApiItem {
  id: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    country?: string;
    thumbnails?: Record<string, { url: string }>;
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
  };
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
}

interface PlaylistItemsResponse {
  items?: Array<{ contentDetails?: { videoId?: string } }>;
  nextPageToken?: string;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException ? err.name === 'AbortError' : (err as any)?.name === 'AbortError';
}

/**
 * 入力（チャンネルURL / @ハンドル / チャンネルID）から channels.list のクエリを組み立てる。
 * - `UC...`（チャンネルID）→ id=
 * - `youtube.com/channel/UC...` → URL から id 抽出
 * - `@handle` または `youtube.com/@handle` → forHandle=
 * 解決できない入力は null を返す（呼び出し側で日本語エラーにする）。
 */
export function resolveChannelQuery(input: string): { id?: string; forHandle?: string } | null {
  const raw = String(input || '').trim();
  if (!raw) return null;

  // URL の場合はパス部分を優先的に見る（channel/... と @handle の両方に対応）。
  const channelUrlMatch = raw.match(/(?:youtube\.com\/channel\/)(UC[0-9A-Za-z_-]{20,})/i);
  if (channelUrlMatch) return { id: channelUrlMatch[1] };

  const handleUrlMatch = raw.match(/youtube\.com\/@([0-9A-Za-z_.-]+)/i);
  if (handleUrlMatch) return { forHandle: `@${handleUrlMatch[1]}` };

  // 素の @handle。
  if (raw.startsWith('@')) {
    const handle = raw.slice(1).trim();
    return handle ? { forHandle: `@${handle}` } : null;
  }

  // 素のチャンネルID（UC で始まる 22文字前後）。
  if (/^UC[0-9A-Za-z_-]{20,}$/.test(raw)) return { id: raw };

  return null;
}

/**
 * 自分のチャンネルの公開データを APIキーだけで取得する。
 * search.list を使わないため消費は約13ユニット/300本と激安（1 + playlistItems + videos.list）。
 */
export async function fetchMyChannel(
  input: string,
  maxVideos: number,
  config: AppConfig,
  signal?: AbortSignal,
  onProgress?: (msg: string) => void
): Promise<MyChannelData> {
  if (!config.apiKey) throw new Error('YouTube APIキーが未設定です。');
  const query = resolveChannelQuery(input);
  if (!query) {
    throw new Error(
      'チャンネルを特定できませんでした。チャンネルID（UCで始まる文字列）・@ハンドル・チャンネルのURLのいずれかを入力してください。'
    );
  }

  // ① channels.list（1ユニット）でチャンネル情報とアップロード用プレイリストIDを取得。
  onProgress?.('チャンネル情報を取得中...');
  let channelsCallCount = 0;
  const channelResponse = await fetchYouTubeApi<{ items?: MyChannelApiItem[] }>(
    'channels',
    {
      part: 'snippet,statistics,contentDetails',
      id: query.id,
      forHandle: query.forHandle,
      maxResults: 1,
      key: config.apiKey
    },
    signal
  );
  channelsCallCount += 1;

  const channelItem = (channelResponse.items || [])[0];
  if (!channelItem) {
    throw new Error(
      'チャンネルが見つかりませんでした。入力したチャンネルID・@ハンドル・URLをご確認ください。'
    );
  }

  const uploadsPlaylistId = channelItem.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    throw new Error('このチャンネルのアップロード動画一覧を取得できませんでした。');
  }

  // ② playlistItems.list（1ユニット/回）でアップロード動画IDを新しい順に maxVideos 件まで収集。
  onProgress?.('動画一覧を取得中...');
  const safeMax = Math.max(1, Math.min(500, Number(maxVideos) || 0));
  const videoIds: string[] = [];
  const seen = new Set<string>();
  let pageToken = '';
  let playlistItemsCallCount = 0;
  let partial = false;
  while (videoIds.length < safeMax) {
    const pageSize = Math.min(50, safeMax - videoIds.length);
    let response: PlaylistItemsResponse;
    try {
      response = await fetchYouTubeApi<PlaylistItemsResponse>(
        'playlistItems',
        {
          part: 'contentDetails',
          playlistId: uploadsPlaylistId,
          maxResults: pageSize,
          pageToken: pageToken || undefined,
          key: config.apiKey
        },
        signal
      );
    } catch (err) {
      // 中止は伝播。それ以外は集まった分で部分結果として抜ける（既存 chunkスキップ・partial 踏襲）。
      if (isAbortError(err)) throw err;
      if (videoIds.length === 0) throw err;
      partial = true;
      break;
    }
    playlistItemsCallCount += 1;

    const pageIds = (response.items || [])
      .map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id));
    pageIds.forEach((id) => {
      if (!seen.has(id) && videoIds.length < safeMax) {
        seen.add(id);
        videoIds.push(id);
      }
    });

    pageToken = response.nextPageToken || '';
    if (!pageToken || pageIds.length === 0) break;
  }

  // ③ videos.list（既存 getVideoDetails を再利用）で詳細取得。1ユニット/50件。
  onProgress?.('動画の詳細を取得中...');
  const videoDetail = await getVideoDetails(videoIds, config, signal);
  if (videoDetail.partial) partial = true;
  const videosListCallCount = chunkArray(videoIds, 50).length;

  // 取得済みチャンネル1件で channelMap を構成し、既存 normalizeVideos で Video[] へ変換。
  const channelMapItem: YouTubeChannelItem = {
    id: channelItem.id,
    snippet: {
      title: channelItem.snippet?.title || '',
      publishedAt: channelItem.snippet?.publishedAt || '',
      country: channelItem.snippet?.country
    },
    statistics: {
      subscriberCount: channelItem.statistics?.subscriberCount,
      videoCount: channelItem.statistics?.videoCount
    }
  };
  const channelMap: Record<string, YouTubeChannelItem> = { [channelItem.id]: channelMapItem };
  const videos = normalizeVideos(videoDetail.items, channelMap);
  // 「自分の中で熱い動画」が分かるよう、取得した全動画セットでヒートスコアを計算する。
  applyHeatScores(videos);

  // 実測ベースの消費: channels.list（1）＋ playlistItems の実呼び出し回数 ＋ videos.list の実呼び出し回数。
  const estimatedQuota = channelsCallCount + playlistItemsCallCount + videosListCallCount;

  const bestThumb = pickBestThumbnail(channelItem.snippet?.thumbnails);

  return {
    channel: {
      id: channelItem.id,
      title: channelItem.snippet?.title || '',
      thumbnailUrl: bestThumb,
      subscriberCount: toInteger(channelItem.statistics?.subscriberCount, 0),
      totalViewCount: toInteger(channelItem.statistics?.viewCount, 0),
      videoCount: toInteger(channelItem.statistics?.videoCount, 0),
      publishedAt: channelItem.snippet?.publishedAt || ''
    },
    videos,
    partial,
    fetchedVideoCount: videos.length,
    estimatedQuota
  };
}

// チャンネルアイコンは high/medium/default の順で一番大きいものを選ぶ（動画サムネの getBestThumbnailUrl と別系統のため個別実装）。
function pickBestThumbnail(thumbnails: Record<string, { url: string }> | undefined): string {
  const t = thumbnails || {};
  return t.high?.url || t.medium?.url || t.default?.url || '';
}
