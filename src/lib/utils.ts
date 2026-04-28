export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  return Object.keys(params)
    .filter((key) => params[key] !== null && params[key] !== undefined && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join('&');
}

export function getPublishedAfter(period: string): string {
  const daysMap: Record<string, number> = {
    今日: 1,
    今週: 7,
    今月: 30,
    '3ヶ月': 90
  };
  const days = daysMap[period];
  if (!days) return '';
  return new Date(Date.now() - days * 86400000).toISOString();
}

export function parseIsoDuration(duration: string): number {
  const match = String(duration || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const days = toInteger(match[1], 0);
  const hours = toInteger(match[2], 0);
  const minutes = toInteger(match[3], 0);
  const seconds = toInteger(match[4], 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, toInteger(totalSeconds, 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(rest)}`;
  return `${minutes}:${pad2(rest)}`;
}

export function formatDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

export function formatDateTime(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  return `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatNumber(value: number | string | null | undefined): string {
  return Number(value || 0).toLocaleString('ja-JP');
}

export function toInteger(value: unknown, defaultValue: number): number {
  if (value === null || value === undefined || value === '') return defaultValue;
  const number = parseInt(String(value).replace(/,/g, ''), 10);
  return Number.isNaN(number) ? defaultValue : number;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function splitCsv(value: string): string[] {
  return String(value || '')
    .split(/[,\n、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniqueValues<T>(values: T[]): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = String(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function mapById<T extends { id: string }>(items: T[]): Record<string, T> {
  const map: Record<string, T> = {};
  (items || []).forEach((item) => {
    map[item.id] = item;
  });
  return map;
}

export function getBestThumbnailUrl(thumbnails: Record<string, { url: string }> | undefined): string {
  const t = thumbnails || {};
  return (
    t.maxres?.url || t.standard?.url || t.high?.url || t.medium?.url || t.default?.url || ''
  );
}

export function buildVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function buildChannelUrl(channelId: string): string {
  return `https://www.youtube.com/channel/${channelId}`;
}

export function maskApiKey(apiKey: string): string {
  const value = String(apiKey || '').trim();
  if (!value) return '未設定';
  if (value.length <= 8) return '設定済み';
  return `${value.slice(0, 4)}********${value.slice(-4)}`;
}

export function getMonthDiff(startDate: Date, endDate: Date): number {
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return 0;
  return Math.max(
    0,
    (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth()
  );
}

export function truncateText(value: string, maxLength: number): string {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
