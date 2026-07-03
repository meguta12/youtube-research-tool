import { useState } from 'react';
import { copyText } from '../lib/clipboard';
import { MyChannelData } from '../lib/myChannel';
import { CompetitorStats } from '../lib/types';
import { formatNumber } from '../lib/utils';

const MAX_VIDEOS = 20;
const MAX_WORDS = 10;

// マイチャンネル版の「分析プロンプト＋データサマリー」プレーンテキストを組み立てる。
// import ゼロ依存で node からも検証できるよう export する（AiAnalysisButton と同方針）。
export function buildMyChannelAiText(data: MyChannelData, stats: CompetitorStats): string {
  const channel = data.channel;
  const lines: string[] = [];

  // 冒頭の固定プロンプト（マイチャンネル版）。
  lines.push(
    '私のYouTubeチャンネルのデータです。伸びた動画の共通点、伸びなかった原因の仮説、次に作るべき動画の方向性を、数字を根拠に分析してください。'
  );
  lines.push('');

  // チャンネルサマリー。
  lines.push('■ チャンネルサマリー');
  lines.push(`チャンネル名：${channel.title}`);
  lines.push(`登録者数：${formatNumber(channel.subscriberCount)}人`);
  lines.push(`総再生数：${formatNumber(channel.totalViewCount)}回`);
  lines.push(`動画本数：${formatNumber(channel.videoCount)}本`);
  lines.push(`分析対象：${data.fetchedVideoCount}本`);
  lines.push('');

  // 動画上位20行（ヒートスコア降順）。1行1動画。
  const topVideos = [...data.videos]
    .sort((a, b) => (b.heatScore ?? -1) - (a.heatScore ?? -1))
    .slice(0, MAX_VIDEOS);
  lines.push(`■ 動画（ヒート上位 最大${MAX_VIDEOS}件）`);
  lines.push('タイトル | ヒート | 再生数 | 1日平均 | 倍率 | エンゲージ率 | 公開日');
  topVideos.forEach((v) => {
    const cells = [
      v.title,
      v.heatScore !== null ? `ヒート${Math.round(v.heatScore)}` : '-',
      formatNumber(v.viewCount),
      formatNumber(Math.round(v.viewsPerDay)),
      v.outlierMultiplier !== null ? `${v.outlierMultiplier.toFixed(2)}倍` : '-',
      v.engagementRate !== null ? `${(v.engagementRate * 100).toFixed(2)}%` : '-',
      v.publishedDate
    ];
    lines.push(cells.join(' | '));
  });
  lines.push('');

  // 頻出ワード TOP10。
  lines.push(`■ 頻出ワード TOP${MAX_WORDS}`);
  if (stats.topWords.length === 0) {
    lines.push('（データなし）');
  } else {
    stats.topWords.slice(0, MAX_WORDS).forEach((w, index) => {
      lines.push(`${index + 1}. ${w.word}（${w.count}回 / 平均${formatNumber(Math.round(w.averageViews))}回）`);
    });
  }

  return lines.join('\n');
}

type CopyState = 'idle' | 'copied' | 'error';

// マイチャンネル版のコピーボタン（コピー機構は copyText で共通化）。
export function MyChannelCopyButton({ text }: { text: string }) {
  const [state, setState] = useState<CopyState>('idle');

  async function handleCopy() {
    const success = await copyText(text);
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
