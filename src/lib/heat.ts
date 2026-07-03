import { Video } from './types';

/**
 * ヒートスコア（0〜100）。検索結果セット内の相対評価（パーセンタイル）で
 * 「今アツいか」を合成する指標。絶対値ではなくその取得結果内での順位で測るため、
 * 必ず表示セット（post-filter・slice後）に対して計算する。
 *
 * 合成の重み（合計1.0）:
 *   登録者比 0.35 / 1日平均再生数 0.30 / アウトライアー倍率 0.20 / エンゲージ率 0.15
 * null の指標はその動画の計算から除外し、残りの重みを比例配分で再正規化する。
 * 全指標 null の動画は heatScore = null。
 */

interface HeatMetric {
  key: 'subscriberRatio' | 'viewsPerDay' | 'outlierMultiplier' | 'engagementRate';
  weight: number;
}

// 重みの定義（合計1.0）。順序は仕様の並びに合わせる。
const HEAT_METRICS: HeatMetric[] = [
  { key: 'subscriberRatio', weight: 0.35 },
  { key: 'viewsPerDay', weight: 0.3 },
  { key: 'outlierMultiplier', weight: 0.2 },
  { key: 'engagementRate', weight: 0.15 }
];

/**
 * 指標ごとのパーセンタイル表を作る。
 * pr = 「その値より小さい値の数 ÷ (n-1)」。n は有効値（null除外）の数。
 * 同値は平均順位（tie を平均で割り当てる）で扱い、n が1なら pr=0.5。
 * 戻り値は「元の配列インデックス → pr（有効値のみ、null は欠落）」のマップ。
 */
function buildPercentileMap(values: Array<number | null>): Map<number, number> {
  const result = new Map<number, number>();
  // 有効値だけを (index, value) の形で取り出す。
  const valid = values
    .map((value, index) => ({ index, value }))
    .filter((entry): entry is { index: number; value: number } => entry.value !== null);
  const n = valid.length;
  if (n === 0) return result;
  if (n === 1) {
    result.set(valid[0].index, 0.5);
    return result;
  }

  // 値でソートし、同値グループごとに「自分より小さい値の数」を平均順位で割り当てる。
  const sorted = [...valid].sort((a, b) => a.value - b.value);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].value === sorted[i].value) j += 1;
    // このグループ [i..j] は同値。グループより小さい値の数は i、
    // 平均順位は i..j の平均（= i + (グループ内の平均位置)）。
    const groupSize = j - i + 1;
    // 「小さい値の数」の平均 = i + (0 + 1 + ... + (groupSize-1)) / groupSize
    const averageRank = i + (groupSize - 1) / 2;
    const pr = averageRank / (n - 1);
    for (let k = i; k <= j; k++) {
      result.set(sorted[k].index, pr);
    }
    i = j + 1;
  }
  return result;
}

/**
 * 各 video の heatScore を破壊的に埋める。
 * パーセンタイルは渡された配列内の相対値なので、必ず最終表示セットで呼ぶこと。
 */
export function applyHeatScores(videos: Video[]): void {
  if (videos.length === 0) return;

  // 指標ごとにパーセンタイル表を作る。
  const percentileMaps = HEAT_METRICS.map((metric) =>
    buildPercentileMap(videos.map((v) => v[metric.key]))
  );

  videos.forEach((video, index) => {
    let weightedSum = 0;
    let weightTotal = 0;
    HEAT_METRICS.forEach((metric, metricIndex) => {
      const pr = percentileMaps[metricIndex].get(index);
      // その動画で null の指標は除外（重みも合計しない＝比例配分で再正規化される）。
      if (pr === undefined) return;
      weightedSum += metric.weight * pr;
      weightTotal += metric.weight;
    });
    // 全指標 null の動画はスコア算出不能。
    video.heatScore = weightTotal > 0 ? 100 * (weightedSum / weightTotal) : null;
  });
}

/**
 * ヒートスコアのティア。S: 85以上 / A: 70以上 / B: 55以上 / それ未満・null は null。
 */
export function getHeatTier(score: number | null): 'S' | 'A' | 'B' | null {
  if (score === null) return null;
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  return null;
}
