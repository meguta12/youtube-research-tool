import {
  AppConfig,
  getSearchRegion,
  isChannelAgeFilterActive,
  isSubscriberFilterActive,
  normalizeKeyword,
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
  partial?: boolean;
}

/**
 * HTTPステータスを持つAPIエラー。4xx/5xx を区別してリトライ要否を判断するために status を保持する。
 */
class YouTubeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'YouTubeApiError';
    this.status = status;
  }
}

// バックオフの待機時間（ネットワーク例外 / 5xx のときのみ使用）。最大2回リトライ。
const RETRY_DELAYS_MS = [500, 1000];

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException ? err.name === 'AbortError' : (err as any)?.name === 'AbortError';
}

async function fetchYouTubeApi<T>(
  endpoint: string,
  params: Record<string, string | number | undefined | null>,
  signal?: AbortSignal
): Promise<T> {
  const url = YOUTUBE_API_BASE + endpoint + '?' + buildQuery(params);
  // 試行回数 = 初回 + リトライ回数。ネットワーク例外・5xx のときだけ再試行する。
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(url, { method: 'GET', signal });
      let json: any = {};
      try {
        json = await response.json();
      } catch {
        /* ignore parse error */
      }
      if (!response.ok || json?.error) {
        const message = json?.error?.message || `HTTP ${response.status}`;
        // 4xx（403 quotaExceeded / keyInvalid 等）は回復しないので即throw。5xx はリトライ対象。
        const err = new YouTubeApiError(`YouTube APIエラー: ${message}`, response.status);
        if (response.status >= 500 && attempt < RETRY_DELAYS_MS.length) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          continue;
        }
        throw err;
      }
      return json as T;
    } catch (err) {
      // 中止は回復対象ではないので即座に投げ直す（項目2）。
      if (isAbortError(err)) throw err;
      // 上の分岐で作った 4xx エラーはそのまま投げる（リトライしない）。
      if (err instanceof YouTubeApiError) throw err;
      // ここに来るのはネットワーク例外（fetch 失敗）。回数が残っていればリトライ。
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw err;
    }
  }
  // ループは必ず return / throw で抜けるが、型のために保険を置く。
  throw new Error('YouTube APIエラー: リトライに失敗しました');
}

export async function testApiKey(apiKey: string, signal?: AbortSignal): Promise<void> {
  await fetchYouTubeApi('search', {
    part: 'snippet',
    q: 'test',
    type: 'video',
    maxResults: 1,
    key: apiKey
  }, signal);
}

export async function searchVideoIds(params: SearchParams, config: AppConfig, signal?: AbortSignal): Promise<SearchVideoResult> {
  const ids: string[] = [];
  const seen = new Set<string>();
  const keyword = normalizeKeyword(params.keyword);
  const candidateLimit = getSearchCandidateLimit(params);
  const durationFilters = getDurationFilters(params.duration);
  // 網羅性UP: broadSearch のときは指定orderに加えて relevance でも取得しIDを統合する。
  // duration バケットとの掛け算になるため検索回数が増える点に注意（見積りも2倍側に振る）。
  const orders = getSearchOrders(params);
  const states = orders.flatMap((order) =>
    durationFilters.map((duration) => ({
      order,
      duration,
      pageToken: '',
      exhausted: false
    }))
  );
  let searchCallCount = 0;
  let partial = false;
  // 検索回数の上限。推定消費（estimateQuotaBeforeRun）と同じ式で、実消費が推定を超えないようにする。
  const maxSearchCalls = getMaxSearchCalls(params);

  while (ids.length < candidateLimit && searchCallCount < maxSearchCalls && states.some((state) => !state.exhausted)) {
    for (const state of states) {
      if (state.exhausted || ids.length >= candidateLimit || searchCallCount >= maxSearchCalls) continue;

      const pageSize = Math.min(50, candidateLimit - ids.length);
      const regionCode = params.regionCode || config.regionCode || 'JP';
      const query: Record<string, string | number | undefined> = {
        part: 'snippet',
        type: 'video',
        q: keyword,
        maxResults: pageSize,
        order: state.order,
        regionCode,
        relevanceLanguage: getRelevanceLanguage(regionCode, config.language),
        key: config.apiKey
      };

      const publishedAfter = getPublishedAfter(params.period);
      if (publishedAfter) query.publishedAfter = publishedAfter;
      // カテゴリ指定（videoCategoryId）は type=video のとき有効。空でないときのみ付与する。
      if (params.categoryId) query.videoCategoryId = params.categoryId;
      query.videoDuration = state.duration;
      if (state.pageToken) query.pageToken = state.pageToken;

      let response: { items: YouTubeSearchItem[]; nextPageToken?: string };
      try {
        response = await fetchYouTubeApi<{ items: YouTubeSearchItem[]; nextPageToken?: string }>(
          'search',
          query,
          signal
        );
      } catch (err) {
        // 中止はそのまま伝播（呼び出し側で「中止しました」表示にする）。
        if (isAbortError(err)) throw err;
        // 1件も取れずに最初のページで失敗したときだけ throw（何が起きたか伝えるため）。
        if (ids.length === 0) throw err;
        // それ以外は例外を投げず、集まった ids で部分結果として抜ける。
        partial = true;
        return { ids, searchCallCount, partial };
      }
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

  return { ids, searchCallCount, partial };
}

export async function searchVideos(params: SearchParams, config: AppConfig): Promise<string[]> {
  const result = await searchVideoIds(params, config);
  return result.ids;
}

export interface DetailFetchResult<T> {
  items: T[];
  partial: boolean;
}

export async function getVideoDetails(ids: string[], config: AppConfig, signal?: AbortSignal): Promise<DetailFetchResult<YouTubeVideoItem>> {
  const items: YouTubeVideoItem[] = [];
  let partial = false;
  for (const chunk of chunkArray(ids, 50)) {
    try {
      const response = await fetchYouTubeApi<{ items: YouTubeVideoItem[] }>('videos', {
        part: 'snippet,statistics,contentDetails,status',
        id: chunk.join(','),
        maxResults: 50,
        key: config.apiKey
      }, signal);
      items.push(...(response.items || []));
    } catch (err) {
      // 中止は伝播。それ以外はそのchunkをスキップして続行し、部分結果として印を付ける。
      if (isAbortError(err)) throw err;
      partial = true;
    }
  }
  return { items, partial };
}

export async function getChannelDetails(ids: string[], config: AppConfig, signal?: AbortSignal): Promise<DetailFetchResult<YouTubeChannelItem>> {
  const items: YouTubeChannelItem[] = [];
  let partial = false;
  for (const chunk of chunkArray(uniqueValues(ids), 50)) {
    try {
      const response = await fetchYouTubeApi<{ items: YouTubeChannelItem[] }>('channels', {
        part: 'snippet,statistics,status',
        id: chunk.join(','),
        maxResults: 50,
        key: config.apiKey
      }, signal);
      items.push(...(response.items || []));
    } catch (err) {
      // 中止は伝播。それ以外はそのchunkをスキップして続行し、部分結果として印を付ける。
      if (isAbortError(err)) throw err;
      partial = true;
    }
  }
  return { items, partial };
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
      // 高評価が非公開（likeCount 欠落）のときは分子を過小評価してしまうため算出不能（null）とする。
      const likeHidden = statistics.likeCount === undefined;
      const engagementRate =
        viewCount > 0 && !likeHidden ? (likeCount + commentCount) / viewCount : null;
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
  // 節約モード: 地域補正・advanced補正による候補の水増しをスキップし、要求件数のみで取得する。
  if (params.economyMode) return requested;

  const hasAdvancedPostFilter =
    isSubscriberFilterActive(params) ||
    isChannelAgeFilterActive(params) ||
    params.kidsFilter !== 'all' ||
    params.titleMustContain;

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
  const videoCalls = Math.ceil(safeMax / 50);
  const channelCalls = Math.ceil(safeMax / 50);
  // search.list は実行側の上限（order数 × durationバケット数 × ceil(候補/50)）と同じ式で見積もる。
  // 実行側が同じ上限で打ち切るため、推定消費 ≥ 実消費 が常に成り立つ。
  const searchCalls = getMaxSearchCalls(params);
  return searchCalls * 100 + videoCalls + channelCalls;
}

/**
 * 実行する search.list 呼び出しの上限回数。
 * order数（broadSearchで2）× durationバケット数（横長で2）× ceil(候補上限 / 50)。
 * searchVideoIds はこの回数で打ち切るので、estimateQuotaBeforeRun と一致し、
 * 重複が多くて候補が埋まらないケースでも実消費が推定を超えない。
 */
export function getMaxSearchCalls(params: SearchParams): number {
  const orderCount = getSearchOrders(params).length;
  const durationCount = getDurationFilters(params.duration).length;
  return orderCount * durationCount * Math.ceil(getSearchCandidateLimit(params) / 50);
}

/**
 * 実行する search の order コード一覧を返す。
 * 通常は指定order（例: viewCount）1つ。broadSearch のときは relevance も加えて
 * 網羅性を上げる（既に関連度を選んでいる場合は重複しないよう1つにまとめる）。
 */
function getSearchOrders(params: Pick<SearchParams, 'order' | 'broadSearch'>): string[] {
  const primary = ORDER_MAP[params.order] || 'viewCount';
  if (!params.broadSearch) return [primary];
  return primary === 'relevance' ? [primary] : [primary, 'relevance'];
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
