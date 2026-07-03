/**
 * クリップボードにテキストをコピーする共通処理。
 * 安全なコンテキスト（https/localhost）では Clipboard API を使い、
 * 使えない環境ではテキストエリア選択方式にフォールバックする。
 * AI分析コピー系のボタンで共通利用する（コピー機構だけを共通化）。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return fallbackCopy(text);
  } catch {
    // Clipboard API が拒否された場合はテキストエリア選択方式にフォールバック。
    return fallbackCopy(text);
  }
}

// テキストエリア選択方式のフォールバック。Clipboard API が使えない環境向け。
function fallbackCopy(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // 画面外に置いてスクロール位置を乱さない。
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
