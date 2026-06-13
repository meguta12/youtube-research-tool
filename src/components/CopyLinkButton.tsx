import { useState } from 'react';

interface CopyLinkButtonProps {
  url: string;
  /** ボタンに表示する短いラベル。デフォルトは "📋" */
  label?: string;
  /** マウスホバー時のtitle */
  title?: string;
}

/**
 * URLをクリップボードにコピーする小さなボタン。
 * クリック後 約1.5秒間 "✓ コピー済" の表示にフィードバックを返す。
 */
export function CopyLinkButton({
  url,
  label = '📋 コピー',
  title = 'リンクをコピー'
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      // 安全なコンテキスト（HTTPS/localhost）であれば navigator.clipboard を使う
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // 古いブラウザ用フォールバック
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setError(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      className={`text-xs whitespace-nowrap rounded px-1.5 py-0.5 transition-colors ${
        copied
          ? 'text-emerald-700 bg-emerald-50'
          : error
            ? 'text-rose-700 bg-rose-50'
            : 'text-slate-500 hover:text-brand-600 hover:bg-brand-50'
      }`}
    >
      {copied ? '✓ コピー済' : error ? '✕ 失敗' : label}
    </button>
  );
}
