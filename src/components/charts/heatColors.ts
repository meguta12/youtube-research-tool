import { getHeatTier } from '../../lib/heat';

/**
 * ヒートティア → 点の色。D1 のヒート配色（S=ローズ / A=アンバー / B=オレンジ / なし=スレート）と
 * 調和させる。グラフの点・凡例で共通利用する。
 */
export const HEAT_TIER_COLORS: Record<'S' | 'A' | 'B' | 'none', string> = {
  S: '#f43f5e', // rose-500
  A: '#f59e0b', // amber-500
  B: '#f97316', // orange-500（= heat-500）
  none: '#94a3b8' // slate-400
};

export function heatColorForScore(score: number | null): string {
  const tier = getHeatTier(score);
  return tier ? HEAT_TIER_COLORS[tier] : HEAT_TIER_COLORS.none;
}

/** log スケール用に 0 以下を 1 にクランプする（log(0)・負値を回避）。 */
export function clampForLog(value: number): number {
  return value > 0 ? value : 1;
}
