import { useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/clipboard';
import { buildShareCaption, downloadShareCard, renderShareCard } from '../lib/shareCard';
import { ResearchResult } from '../lib/types';
import { Modal } from './Modal';

interface ShareCardButtonProps {
  result: ResearchResult;
}

type CopyState = 'idle' | 'copied' | 'error';

export function ShareCardButton({ result }: ShareCardButtonProps) {
  const [open, setOpen] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [copyStateValue, setCopyState] = useState<CopyState>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // モーダルを開いた瞬間にプレビューを描画する。画像読み込みが終わるまでは rendering 表示。
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    setRendering(true);
    setRenderError(false);
    renderShareCard(canvas, result)
      .catch(() => {
        if (!cancelled) setRenderError(true);
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, result]);

  async function handleDownload() {
    try {
      await downloadShareCard(result);
    } catch {
      setRenderError(true);
    }
  }

  async function handleCopyCaption() {
    const text = buildShareCaption(result);
    const success = await copyText(text);
    if (success) {
      setCopyState('copied');
      // 成功メッセージだけ数秒後に消す。失敗メッセージは残す。
      window.setTimeout(() => setCopyState('idle'), 2500);
    } else {
      setCopyState('error');
    }
  }

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        📸 SNSシェア画像を作成
      </button>

      <Modal open={open} title="SNSシェア画像を作成" onClose={() => setOpen(false)} maxWidth="max-w-3xl">
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <canvas ref={canvasRef} className="block w-full h-auto rounded" />
          </div>

          {rendering && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="inline-block h-3 w-3 rounded-full bg-brand-500 animate-pulse" />
              <span>画像を生成中です…</span>
            </div>
          )}

          {renderError && (
            <div className="text-sm text-rose-700">
              画像の生成に失敗しました。時間をおいて、もう一度お試しください。
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" onClick={handleDownload}>
              ⬇ 画像をダウンロード
            </button>
            <button type="button" className="btn-secondary" onClick={handleCopyCaption}>
              📝 投稿文をコピー
            </button>
            {copyStateValue === 'copied' && <span className="text-sm text-emerald-700">コピーしました</span>}
            {copyStateValue === 'error' && (
              <span className="text-sm text-rose-700">コピーに失敗しました（手動で選択してコピーしてください）</span>
            )}
          </div>

          <p className="text-xs text-slate-500">
            ダウンロード後、Xの投稿画面に画像を添付し、コピーした文章を貼り付けてください。
          </p>
        </div>
      </Modal>
    </>
  );
}
