/**
 * シンプルなライセンスキー検証。
 * 販売者は「秘密ソルト + 購入者ID」から SHA-256 を計算し、
 * 上8文字-中8文字-下8文字 の形式で発行します。
 *
 * クライアント側ではソルトと expected ハッシュ集合をビルド時に埋め込み、
 * 入力されたキーが集合に含まれるか検証します。
 *
 * 完全なコピー防止にはなりませんが、URL を共有しただけでは
 * 動かないハードルとして機能します。
 *
 * 環境変数:
 *   VITE_LICENSE_KEYS: カンマ区切りの有効ライセンスキー（販売時に追記）
 *   VITE_LICENSE_BYPASS: "true" にすると検証スキップ（開発用）
 */

const ENV_KEYS = (import.meta.env.VITE_LICENSE_KEYS as string | undefined) || '';
const BYPASS = String(import.meta.env.VITE_LICENSE_BYPASS || '').toLowerCase() === 'true';

function getValidKeys(): Set<string> {
  return new Set(
    ENV_KEYS.split(/[,\s]+/)
      .map((k) => k.trim().toUpperCase())
      .filter(Boolean)
  );
}

export function isLicenseRequired(): boolean {
  if (BYPASS) return false;
  return getValidKeys().size > 0;
}

export function validateLicense(input: string): boolean {
  if (BYPASS) return true;
  const valid = getValidKeys();
  if (valid.size === 0) return true; // 鍵が未配布の状態（開発時）はフリーパス
  const normalized = input.trim().toUpperCase();
  if (!normalized) return false;
  return valid.has(normalized);
}
