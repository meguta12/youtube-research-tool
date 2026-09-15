import {
  AppConfig,
  ChannelAgeKey,
  CHANNEL_AGE_FILTERS,
  DurationKey,
  KidsFilterKey,
  KIDS_FILTERS,
  MAX_RESULT_COUNTS,
  normalizeKeyword,
  ResearchResult,
  SearchParams,
  SearchRegionCode,
  SEARCH_REGIONS,
  Video,
  VIDEO_CATEGORIES
} from './types';

const KEYS = {
  apiKey: 'yt-research:api-key',
  config: 'yt-research:config',
  lastParams: 'yt-research:last-params',
  history: 'yt-research:history',
  license: 'yt-research:license',
  onboarded: 'yt-research:onboarded',
  quota: 'yt-research:quota',
  presets: 'yt-research:presets',
  stocks: 'yt-research:stocks',
  myChannel: 'yt-research:my-channel',
  myChannelSnapshots: 'yt-research:my-channel-snapshots'
};

export const DAILY_QUOTA_LIMIT = 10000;

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // 容量超過（QuotaExceededError）やプライベートモードでは保存できないため false を返す。
    return false;
  }
}

export function getApiKey(): string {
  return safeRead<string>(KEYS.apiKey, '');
}

export function setApiKey(value: string): boolean {
  return safeWrite(KEYS.apiKey, value.trim());
}

export function clearApiKey(): void {
  localStorage.removeItem(KEYS.apiKey);
}

const DEFAULT_CONFIG: Omit<AppConfig, 'apiKey'> = {
  excludeWords: [],
  excludeChannelIds: [],
  regionCode: 'JP',
  language: 'ja'
};

export function getConfig(): AppConfig {
  const stored = safeRead(KEYS.config, DEFAULT_CONFIG);
  return {
    apiKey: getApiKey(),
    excludeWords: stored.excludeWords ?? [],
    excludeChannelIds: stored.excludeChannelIds ?? [],
    regionCode: stored.regionCode || 'JP',
    language: stored.language || 'ja'
  };
}

export function saveConfig(config: Omit<AppConfig, 'apiKey'>): boolean {
  return safeWrite(KEYS.config, config);
}

const DEFAULT_PARAMS: SearchParams = {
  keyword: '',
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
};

export function getLastParams(): SearchParams {
  return normalizeSearchParams({ ...DEFAULT_PARAMS, ...safeRead(KEYS.lastParams, {}) });
}

export function saveLastParams(params: SearchParams): void {
  safeWrite(KEYS.lastParams, params);
}

function normalizeSearchParams(raw: SearchParams): SearchParams {
  return {
    ...raw,
    duration: normalizeDuration(raw.duration),
    maxResults: normalizeMaxResults(raw.maxResults),
    regionCode: normalizeRegionCode(raw.regionCode),
    channelAge: normalizeChannelAge(raw.channelAge),
    ignoreSubscriberFilter: normalizeBoolean(raw.ignoreSubscriberFilter, false),
    ignoreChannelAgeFilter: normalizeBoolean(raw.ignoreChannelAgeFilter, false),
    kidsFilter: normalizeKidsFilter(raw.kidsFilter),
    regionStrict: normalizeBoolean(raw.regionStrict, false),
    titleMustContain: normalizeBoolean(raw.titleMustContain, false),
    includeLive: normalizeBoolean(raw.includeLive, false),
    economyMode: normalizeBoolean(raw.economyMode, false),
    categoryId: normalizeCategoryId(raw.categoryId),
    broadSearch: normalizeBoolean(raw.broadSearch, false)
  };
}

function normalizeDuration(value: unknown): DurationKey {
  if (value === 'ショート動画' || value === '4分未満（ショート寄り）' || value === '4分未満') {
    return 'ショート動画';
  }
  // 単一バケット（節約用）はそのまま保持する。
  if (value === '4-20分' || value === '20分以上') return value;
  return '横長動画';
}

function normalizeMaxResults(value: unknown): number {
  const n = Number(value) || DEFAULT_PARAMS.maxResults;
  const allowed = [...MAX_RESULT_COUNTS];
  if (allowed.includes(n as (typeof MAX_RESULT_COUNTS)[number])) return n;
  return allowed.reduce((closest, current) => (
    Math.abs(current - n) < Math.abs(closest - n) ? current : closest
  ), DEFAULT_PARAMS.maxResults);
}

function normalizeRegionCode(value: unknown): SearchRegionCode {
  const code = String(value || '').toUpperCase();
  return SEARCH_REGIONS.some((r) => r.code === code) ? (code as SearchRegionCode) : 'JP';
}

function normalizeChannelAge(value: unknown): ChannelAgeKey {
  const key = String(value || '');
  return CHANNEL_AGE_FILTERS.some((r) => r.key === key) ? (key as ChannelAgeKey) : 'all';
}

function normalizeKidsFilter(value: unknown): KidsFilterKey {
  const key = String(value || '');
  return KIDS_FILTERS.some((r) => r.key === key) ? (key as KidsFilterKey) : 'all';
}

function normalizeCategoryId(value: unknown): string {
  const id = String(value || '');
  return VIDEO_CATEGORIES.some((c) => c.id === id) ? id : '';
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export interface HistoryEntry {
  searchedAt: string;
  keyword: string;
  count: number;
  estimatedQuota: number;
  // ---- トレンド比較用のコンパクトなスナップショット（後方互換のため任意）----
  // 古い履歴エントリにはこれらが無いため、比較側は undefined を安全に扱うこと。
  topVideoIds?: string[]; // 上位〜30件の videoId
  topChannels?: Array<{ id: string; title: string }>; // 上位〜20チャンネル
}

export function getHistory(): HistoryEntry[] {
  return safeRead<HistoryEntry[]>(KEYS.history, []);
}

export function pushHistory(entry: HistoryEntry): void {
  const list = getHistory();
  list.unshift(entry);
  safeWrite(KEYS.history, list.slice(0, 50));
}

export function clearHistory(): void {
  localStorage.removeItem(KEYS.history);
}

/**
 * クォータの「YouTube日付」を返す。
 * YouTube Data API のクォータは太平洋時間（PT）の0時にリセットされる。
 * PTは UTC-8（標準時）/ UTC-7（夏時間）で切り替わるため、Intl でタイムゾーンを指定して
 * 太平洋日付の 'YYYY-MM-DD' を得る（DSTは自動で考慮される）。en-CA は既定で 'YYYY-MM-DD' 形式。
 */
const PACIFIC_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function currentQuotaDateKey(now: Date = new Date()): string {
  return PACIFIC_DATE_FORMAT.format(now);
}

export interface QuotaState {
  dateKey: string;
  used: number;
  searchCount: number;
}

interface StoredQuota {
  byDate: Record<string, { used: number; searchCount: number }>;
}

function readStoredQuota(): StoredQuota {
  return safeRead<StoredQuota>(KEYS.quota, { byDate: {} });
}

export function getQuotaUsage(): QuotaState {
  const data = readStoredQuota();
  const dateKey = currentQuotaDateKey();
  const today = data.byDate[dateKey] || { used: 0, searchCount: 0 };
  return { dateKey, used: today.used, searchCount: today.searchCount };
}

export function addQuotaUsage(amount: number): QuotaState {
  const data = readStoredQuota();
  const dateKey = currentQuotaDateKey();
  const prev = data.byDate[dateKey] || { used: 0, searchCount: 0 };
  const next = { used: prev.used + Math.max(0, amount), searchCount: prev.searchCount + 1 };
  data.byDate[dateKey] = next;
  // 90日以上前のレコードは破棄
  const cutoff = new Date(Date.now() - 90 * 86400000);
  const cutoffKey = currentQuotaDateKey(cutoff);
  Object.keys(data.byDate).forEach((key) => {
    if (key < cutoffKey) delete data.byDate[key];
  });
  safeWrite(KEYS.quota, data);
  return { dateKey, used: next.used, searchCount: next.searchCount };
}

export interface QuotaDailyRecord {
  dateKey: string;
  used: number;
  searchCount: number;
}

export function getQuotaHistory(days: number = 7): QuotaDailyRecord[] {
  const data = readStoredQuota();
  const records: QuotaDailyRecord[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 86400000);
    const key = currentQuotaDateKey(date);
    const entry = data.byDate[key] || { used: 0, searchCount: 0 };
    records.push({ dateKey: key, used: entry.used, searchCount: entry.searchCount });
  }
  return records;
}

export function clearQuotaHistory(): void {
  localStorage.removeItem(KEYS.quota);
}

export function getLicense(): string {
  return safeRead<string>(KEYS.license, '');
}

export function setLicense(value: string): void {
  safeWrite(KEYS.license, value.trim());
}

export function clearLicense(): void {
  localStorage.removeItem(KEYS.license);
}

export function isOnboarded(): boolean {
  return safeRead<boolean>(KEYS.onboarded, false);
}

export function markOnboarded(): void {
  safeWrite(KEYS.onboarded, true);
}

export function resetOnboarded(): void {
  localStorage.removeItem(KEYS.onboarded);
}

// ---- 設定・履歴のバックアップ（エクスポート/インポート） ----

// バックアップ対象の localStorage キー一覧（このツールが使う既知キーのみ）。
// import 時はこの一覧にあるキーだけを復元し、未知キーは書き込まない。
const BACKUP_KEYS: string[] = [
  KEYS.apiKey,
  KEYS.config,
  KEYS.lastParams,
  KEYS.history,
  KEYS.license,
  KEYS.onboarded,
  KEYS.quota,
  KEYS.presets,
  KEYS.stocks,
  KEYS.myChannel,
  KEYS.myChannelSnapshots
];

interface BackupFile {
  type: 'yt-research-backup';
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
}

/**
 * 既知キーの生の値（localStorage の文字列そのまま）を1つのJSONにまとめて返す。
 * includeApiKey が false のときは apiKey を除外する（安全側の既定は呼び出し側で選択）。
 */
export function exportBackup(includeApiKey: boolean): string {
  const data: Record<string, string> = {};
  BACKUP_KEYS.forEach((key) => {
    if (!includeApiKey && key === KEYS.apiKey) return;
    const raw = localStorage.getItem(key);
    if (raw !== null) data[key] = raw;
  });
  const backup: BackupFile = {
    type: 'yt-research-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * JSON文字列を受けて各キーを復元する。
 * - パース失敗や想定外の形式は復元せず message で理由を返す。
 * - data 内の既知キーだけを書き込み、未知キーは無視する（安全側）。
 */
export function importBackup(json: string): { ok: boolean; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, message: 'バックアップファイルの読み込みに失敗しました（JSONの形式が正しくありません）。' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, message: 'バックアップファイルの形式が正しくありません。' };
  }
  const file = parsed as Partial<BackupFile>;
  if (file.type !== 'yt-research-backup' || !file.data || typeof file.data !== 'object') {
    return { ok: false, message: 'このツールのバックアップファイルではないようです。' };
  }
  const source = file.data as Record<string, unknown>;
  const knownKeys = new Set(BACKUP_KEYS);
  let restored = 0;
  try {
    knownKeys.forEach((key) => {
      const value = source[key];
      if (typeof value !== 'string') return; // 未知キー・不正な値は書かない
      localStorage.setItem(key, value);
      restored += 1;
    });
  } catch {
    return { ok: false, message: '復元中にエラーが発生しました（ブラウザの保存容量やプライベートモードをご確認ください）。' };
  }
  if (restored === 0) {
    return { ok: false, message: '復元できるデータが含まれていませんでした。' };
  }
  return { ok: true, message: `復元が完了しました（${restored}件の設定を反映）。` };
}

// ---- 検索条件プリセット ----

export interface SearchPreset {
  id: string;
  name: string;
  params: SearchParams;
}

// プリセットidの一意化: 乱数・Date.now を使わず、名前を正規化した安定スラッグにする。
// 同名は同じidになるため上書きされる。
function buildPresetId(name: string): string {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^0-9a-z぀-ヿ一-龯-]/g, '');
  return `p_${slug || 'preset'}`;
}

export function getPresets(): SearchPreset[] {
  const list = safeRead<SearchPreset[]>(KEYS.presets, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && p.params)
    // 古い/インポート由来のプリセットは新フィールドが欠けていることがあるため、
    // DEFAULT_PARAMS 上にマージして正規化し、未定義フィールドを残さない。
    .map((p) => ({ ...p, params: normalizeSearchParams({ ...DEFAULT_PARAMS, ...p.params }) }));
}

export function savePreset(name: string, params: SearchParams): SearchPreset[] {
  const trimmed = String(name || '').trim();
  if (!trimmed) return getPresets();
  const id = buildPresetId(trimmed);
  const list = getPresets().filter((p) => p.id !== id); // 同名（同id）は上書き
  list.push({ id, name: trimmed, params });
  safeWrite(KEYS.presets, list);
  return list;
}

export function deletePreset(id: string): SearchPreset[] {
  const list = getPresets().filter((p) => p.id !== id);
  safeWrite(KEYS.presets, list);
  return list;
}

// ---- マイチャンネル分析（入力の保存・成長記録スナップショット） ----

export interface MyChannelInput {
  input: string; // 最後に入力したチャンネル入力文字列
  maxVideos: number; // 選択した取得本数
}

const DEFAULT_MY_CHANNEL_INPUT: MyChannelInput = { input: '', maxVideos: 300 };

export function getMyChannelInput(): MyChannelInput {
  const stored = safeRead<Partial<MyChannelInput>>(KEYS.myChannel, {});
  return {
    input: typeof stored.input === 'string' ? stored.input : DEFAULT_MY_CHANNEL_INPUT.input,
    maxVideos: Number(stored.maxVideos) || DEFAULT_MY_CHANNEL_INPUT.maxVideos
  };
}

export function saveMyChannelInput(value: MyChannelInput): void {
  safeWrite(KEYS.myChannel, value);
}

// 成長記録の1点。dateKey は日本時間の 'YYYY-MM-DD'（1日1点）。
export interface Snapshot {
  dateKey: string;
  subscriberCount: number;
  totalViewCount: number;
  videoCount: number;
}

// チャンネルごとに保持するスナップショットの上限（古いものから破棄）。
const MAX_SNAPSHOTS_PER_CHANNEL = 365;

interface StoredSnapshots {
  byChannel: Record<string, Snapshot[]>;
}

/**
 * スナップショットの日付キー（日本時間の 'YYYY-MM-DD'）。
 * クォータの太平洋日付（currentQuotaDateKey）とは別物なので流用しない。
 * 日本はサマータイムがないため Asia/Tokyo 固定で問題ない。en-CA は既定で 'YYYY-MM-DD' 形式。
 */
const TOKYO_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function currentTokyoDateKey(now: Date = new Date()): string {
  return TOKYO_DATE_FORMAT.format(now);
}

function readStoredSnapshots(): StoredSnapshots {
  const data = safeRead<StoredSnapshots>(KEYS.myChannelSnapshots, { byChannel: {} });
  return { byChannel: data.byChannel || {} };
}

/**
 * チャンネルの成長記録を1点追加する。
 * 同じ日付キーは上書き（1日1点）。日付昇順に保ち、365点を超えたら古いものから破棄する。
 */
export function recordChannelSnapshot(
  channelId: string,
  snapshot: Snapshot
): void {
  if (!channelId) return;
  const data = readStoredSnapshots();
  const list = (data.byChannel[channelId] || []).filter((s) => s.dateKey !== snapshot.dateKey);
  list.push(snapshot);
  list.sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));
  // 上限超過分は先頭（古い側）から破棄する。
  data.byChannel[channelId] = list.slice(Math.max(0, list.length - MAX_SNAPSHOTS_PER_CHANNEL));
  safeWrite(KEYS.myChannelSnapshots, data);
}

// 指定チャンネルのスナップショット（日付昇順）。
export function getChannelSnapshots(channelId: string): Snapshot[] {
  if (!channelId) return [];
  const data = readStoredSnapshots();
  return (data.byChannel[channelId] || []).slice();
}

// ---- ストック（気になる動画の保存。検索キーワード別にグループ化） ----

/**
 * ストック1件。「どのキーワードで検索したときに見つけた動画か」を残すため、
 * 同じ動画でもキーワードが違えば別エントリとして保存する（id = videoId + keyword）。
 * video は保存時点のスナップショット（再生数などはストックした時の値）。
 */
export interface StockedVideo {
  id: string;
  videoId: string;
  keyword: string; // グループ名（検索キーワード。正規化済み）
  searchedAt: string; // 元になった検索の実行日時
  stockedAt: string; // ストックした日時
  memo: string;
  video: Video;
}

// キーワードが空の結果（通常は起こらない）をまとめるためのグループ名。
const STOCK_GROUP_FALLBACK = '（キーワードなし）';

// グループ名は表記ゆれ（前後空白・連続空白）で分かれないよう正規化する。
export function buildStockKeyword(keyword: string): string {
  return normalizeKeyword(keyword) || STOCK_GROUP_FALLBACK;
}

export function buildStockId(videoId: string, keyword: string): string {
  return `${videoId}::${buildStockKeyword(keyword)}`;
}

export function getStocks(): StockedVideo[] {
  const list = safeRead<StockedVideo[]>(KEYS.stocks, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (s) =>
        s &&
        typeof s.id === 'string' &&
        typeof s.videoId === 'string' &&
        typeof s.keyword === 'string' &&
        s.video &&
        typeof s.video === 'object'
    )
    .map((s) => ({ ...s, memo: typeof s.memo === 'string' ? s.memo : '' }));
}

/**
 * ストックに追加する。同じ（動画×キーワード）が既にあれば何もしない。
 * localStorage への書き込みに失敗（容量超過など）したときだけ false を返す。
 */
export function addStock(video: Video, keyword: string, searchedAt: string): boolean {
  const groupKeyword = buildStockKeyword(keyword);
  const id = buildStockId(video.videoId, groupKeyword);
  const list = getStocks();
  if (list.some((s) => s.id === id)) return true;
  list.unshift({
    id,
    videoId: video.videoId,
    keyword: groupKeyword,
    searchedAt,
    stockedAt: new Date().toISOString(),
    memo: '',
    video
  });
  return safeWrite(KEYS.stocks, list);
}

export function removeStock(id: string): StockedVideo[] {
  const list = getStocks().filter((s) => s.id !== id);
  safeWrite(KEYS.stocks, list);
  return list;
}

// キーワード（グループ）単位でまとめて削除する。
export function removeStocksByKeyword(keyword: string): StockedVideo[] {
  const list = getStocks().filter((s) => s.keyword !== keyword);
  safeWrite(KEYS.stocks, list);
  return list;
}

export function updateStockMemo(id: string, memo: string): StockedVideo[] {
  const list = getStocks().map((s) => (s.id === id ? { ...s, memo } : s));
  safeWrite(KEYS.stocks, list);
  return list;
}

export function clearStocks(): void {
  localStorage.removeItem(KEYS.stocks);
}

export type { ResearchResult };
