import { AppConfig, ResearchResult, SearchParams } from './types';

const KEYS = {
  apiKey: 'yt-research:api-key',
  config: 'yt-research:config',
  lastParams: 'yt-research:last-params',
  history: 'yt-research:history',
  license: 'yt-research:license',
  onboarded: 'yt-research:onboarded',
  quota: 'yt-research:quota'
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

function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or privacy mode — ignore */
  }
}

export function getApiKey(): string {
  return safeRead<string>(KEYS.apiKey, '');
}

export function setApiKey(value: string): void {
  safeWrite(KEYS.apiKey, value.trim());
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

export function saveConfig(config: Omit<AppConfig, 'apiKey'>): void {
  safeWrite(KEYS.config, config);
}

const DEFAULT_PARAMS: SearchParams = {
  keyword: '',
  period: '今月',
  duration: '4-20分',
  order: '視聴回数',
  maxResults: 50
};

export function getLastParams(): SearchParams {
  return { ...DEFAULT_PARAMS, ...safeRead(KEYS.lastParams, {}) };
}

export function saveLastParams(params: SearchParams): void {
  safeWrite(KEYS.lastParams, params);
}

export interface HistoryEntry {
  searchedAt: string;
  keyword: string;
  count: number;
  estimatedQuota: number;
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
 * PTは UTC-8（標準時）/ UTC-7（夏時間）。実装では UTC-8 で固定で十分（誤差はリセット時刻が1時間ズレるだけ）。
 */
export function currentQuotaDateKey(now: Date = new Date()): string {
  const pt = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  const y = pt.getUTCFullYear();
  const m = String(pt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(pt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

export type { ResearchResult };
