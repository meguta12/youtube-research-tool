import { useMemo, useState } from 'react';
import { normalizeKeyword, SearchParams } from '../lib/types';
import { estimateQuotaBeforeRun } from '../lib/youtube';
import { DAILY_QUOTA_LIMIT } from '../lib/storage';
import { formatNumber } from '../lib/utils';

interface MultiKeywordSectionProps {
  baseParams: SearchParams;
  onRunMulti: (keywords: string[], baseParams: SearchParams) => void;
  running: boolean;
  hasApiKey: boolean;
  maxKeywords: number;
  onMissingApiKey: () => void;
}

/**
 * 複数キーワードをまとめて順番にリサーチするための折りたたみセクション。
 * textarea に1行1キーワードで入力し、現在の検索条件（keyword以外）を各キーワードに適用して
 * 1件ずつ順次リサーチする。合計の推定消費を実行前に表示する。
 */
export function MultiKeywordSection({
  baseParams,
  onRunMulti,
  running,
  hasApiKey,
  maxKeywords,
  onMissingApiKey
}: MultiKeywordSectionProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  // 空行・前後空白を無視し、正規化して重複排除。上限 maxKeywords 件で切る。
  const keywords = useMemo(() => {
    const normalized: string[] = [];
    const seen = new Set<string>();
    for (const raw of text.split('\n')) {
      const kw = normalizeKeyword(raw);
      if (!kw || seen.has(kw)) continue;
      seen.add(kw);
      normalized.push(kw);
    }
    return normalized;
  }, [text]);

  const overLimit = keywords.length > maxKeywords;
  const effectiveKeywords = keywords.slice(0, maxKeywords);

  // 合計の推定消費 = 各キーワードの estimateQuotaBeforeRun の合計（keyword 以外の現 params を使用）。
  const totalEstimate = useMemo(
    () => effectiveKeywords.reduce((sum, keyword) => sum + estimateQuotaBeforeRun({ ...baseParams, keyword }), 0),
    [effectiveKeywords, baseParams]
  );

  function handleRun() {
    if (!hasApiKey) {
      onMissingApiKey();
      return;
    }
    if (effectiveKeywords.length === 0) return;
    onRunMulti(effectiveKeywords, baseParams);
  }

  return (
    <div className="card">
      <button
        type="button"
        className="card-header flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>複数キーワードをまとめてリサーチ</span>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="card-body space-y-3">
          <div>
            <label className="label" htmlFor="multi-keywords">キーワード（1行に1つ）</label>
            <textarea
              id="multi-keywords"
              className="input mt-1 h-28"
              placeholder={'例：\n副業\nダイエット\n投資'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={running}
            />
          </div>
          <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="text-slate-600">
              有効キーワード：<span className="font-semibold">{effectiveKeywords.length}</span> 件
              {overLimit && (
                <span className="ml-1 text-amber-700">
                  （一度に最大 {maxKeywords} 件まで。超過分は無視します）
                </span>
              )}
            </div>
            <div className="text-slate-600">
              合計の推定消費：<span className="font-mono font-semibold">約 {formatNumber(totalEstimate)}</span> ユニット
              <span className="text-slate-400">（1日{formatNumber(DAILY_QUOTA_LIMIT)}）</span>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-primary"
              onClick={handleRun}
              disabled={running || effectiveKeywords.length === 0}
            >
              {running ? '実行中...' : '▶ 順番に実行'}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            現在の検索条件（期間・地域・件数など）を各キーワードに適用し、1件ずつ順番に実行します。各結果は履歴に保存されます。
          </p>
        </div>
      )}
    </div>
  );
}
