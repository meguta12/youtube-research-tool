import { useState } from 'react';
import {
  getChannelAgeFilter,
  getKidsFilter,
  getSearchRegion,
  getSubscriberRange,
  isChannelAgeFilterActive,
  isSubscriberFilterActive,
  ResearchResult
} from '../lib/types';
import { formatNumber } from '../lib/utils';

interface AiAnalysisButtonProps {
  result: ResearchResult;
}

const MAX_VIDEOS = 20;
const MAX_WORDS = 10;

// ChatGPT等にそのまま貼れる「分析プロンプト＋結果サマリー」のプレーンテキストを組み立てる。
// import ゼロ依存の純粋な組み立てにするため、export して node からも検証できるようにする。
export function buildAiAnalysisText(result: ResearchResult): string {
  const params = result.params;
  const lines: string[] = [];

  // 冒頭の固定プロンプト。
  lines.push(
    `以下はYouTubeで『${params.keyword}』を検索した上位動画のデータです。伸びている動画の共通点、狙うべき切り口、タイトルの型を、根拠となる数字を挙げて分析してください。`
  );
  lines.push('');

  // 検索条件サマリー。
  lines.push('■ 検索条件');
  lines.push(`キーワード：${params.keyword}`);
  lines.push(`期間：${params.period}`);
  lines.push(`地域：${getSearchRegion(params.regionCode).label}`);
  lines.push(`取得件数：${result.videos.length}件`);
  lines.push(
    `登録者数の絞り込み：${isSubscriberFilterActive(params) ? getSubscriberRange(params.subscriberRange).label : '考慮しない'}`
  );
  lines.push(
    `チャンネル開設日の絞り込み：${isChannelAgeFilterActive(params) ? getChannelAgeFilter(params.channelAge).label : '考慮しない'}`
  );
  lines.push(`子ども向け：${getKidsFilter(params.kidsFilter).label}`);
  lines.push('');

  // 上位動画（最大20件）。1行1動画。
  lines.push(`■ 上位動画（最大${MAX_VIDEOS}件）`);
  lines.push('タイトル | 再生数 | 1日平均 | 登録者比 | 倍率 | エンゲージ率 | 公開日 | チャンネル');
  result.videos.slice(0, MAX_VIDEOS).forEach((v) => {
    const cells = [
      v.title,
      formatNumber(v.viewCount),
      formatNumber(Math.round(v.viewsPerDay)),
      v.subscriberRatio !== null ? `${v.subscriberRatio.toFixed(2)}倍` : '-',
      v.outlierMultiplier !== null ? `${v.outlierMultiplier.toFixed(2)}倍` : '-',
      v.engagementRate !== null ? `${(v.engagementRate * 100).toFixed(2)}%` : '-',
      v.publishedDate,
      v.channelTitle
    ];
    lines.push(cells.join(' | '));
  });
  lines.push('');

  // 頻出ワード TOP10。
  lines.push(`■ 頻出ワード TOP${MAX_WORDS}`);
  if (result.competitorStats.topWords.length === 0) {
    lines.push('（データなし）');
  } else {
    result.competitorStats.topWords.slice(0, MAX_WORDS).forEach((w, index) => {
      lines.push(`${index + 1}. ${w.word}（${w.count}回 / 平均${formatNumber(Math.round(w.averageViews))}回）`);
    });
  }
  lines.push('');

  // 2語の組み合わせ TOP10。
  lines.push(`■ 2語の組み合わせ TOP${MAX_WORDS}`);
  if (result.competitorStats.topBigrams.length === 0) {
    lines.push('（データなし）');
  } else {
    result.competitorStats.topBigrams.slice(0, MAX_WORDS).forEach((b, index) => {
      lines.push(`${index + 1}. ${b.phrase}（${b.count}回 / 平均${formatNumber(Math.round(b.averageViews))}回）`);
    });
  }

  // 「伸びチャンス」チャンネル（あれば）。
  const opportunities = result.channels.filter((c) => c.isOpportunity);
  if (opportunities.length > 0) {
    lines.push('');
    lines.push('■ 「伸びチャンス」チャンネル（新しめ・平均再生数が高い）');
    opportunities.forEach((c) => {
      lines.push(
        `・${c.channelTitle}（登録者${formatNumber(c.subscriberCount)}人 / 運営${c.operationMonths}か月 / 平均${formatNumber(Math.round(c.averageViews))}回 / ヒット${c.hitCount}本）`
      );
    });
  }

  return lines.join('\n');
}

type CopyState = 'idle' | 'copied' | 'error';

export function AiAnalysisButton({ result }: AiAnalysisButtonProps) {
  const [state, setState] = useState<CopyState>('idle');

  async function handleCopy() {
    const text = buildAiAnalysisText(result);
    let success: boolean;
    try {
      // 安全なコンテキスト（https/localhost）では Clipboard API を使う。
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        success = true;
      } else {
        success = fallbackCopy(text);
      }
    } catch {
      // Clipboard API が拒否された場合はテキストエリア選択方式にフォールバック。
      success = fallbackCopy(text);
    }
    if (success) {
      setState('copied');
      // 成功メッセージだけ数秒後に消す。失敗メッセージは残す。
      window.setTimeout(() => setState('idle'), 2500);
    } else {
      setState('error');
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" className="btn-secondary" onClick={handleCopy}>
        🤖 AI分析用にコピー
      </button>
      {state === 'copied' && <span className="text-sm text-emerald-700">コピーしました</span>}
      {state === 'error' && (
        <span className="text-sm text-rose-700">コピーに失敗しました（手動で選択してコピーしてください）</span>
      )}
    </div>
  );
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
