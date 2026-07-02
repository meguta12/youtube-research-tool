import {
  AppConfig,
  ChannelAgeKey,
  CHANNEL_AGE_FILTERS,
  DurationKey,
  KidsFilterKey,
  KIDS_FILTERS,
  MAX_RESULT_COUNTS,
  ResearchResult,
  SearchParams,
  SearchRegionCode,
  SEARCH_REGIONS,
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
  presets: 'yt-research:presets'
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
  KEYS.presets
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

export type { ResearchResult };
