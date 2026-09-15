import { DAILY_QUOTA_LIMIT } from '../lib/storage';
import { formatNumber } from '../lib/utils';
import { IconZap } from './icons';

interface QuotaCardProps {
  used: number;
  searchCount: number;
}

// ホーム上部の1行サマリー。詳しい日別の推移は「履歴・使用量」で見る。
export function QuotaCard({ used, searchCount }: QuotaCardProps) {
  const pct = Math.min(100, (used / DAILY_QUOTA_LIMIT) * 100);
  const remaining = Math.max(0, DAILY_QUOTA_LIMIT - used);
  const tone =
    pct >= 90 ? 'bg-rose-500'
    : pct >= 70 ? 'bg-amber-500'
    : 'bg-emerald-500';
  const textTone =
    pct >= 90 ? 'text-rose-700'
    : pct >= 70 ? 'text-amber-700'
    : 'text-emerald-700';
  const iconTone =
    pct >= 90 ? 'bg-rose-50 text-rose-600'
    : pct >= 70 ? 'bg-amber-50 text-amber-600'
    : 'bg-emerald-50 text-emerald-600';

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
        <span className={`section-icon ${iconTone}`}>
          <IconZap size={15} />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-600">
            今日のAPI使用状況（推定）
            <span className="ml-2 font-normal text-slate-400">リセットは日本時間17時ごろ</span>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            <span className={`text-lg font-bold tabular-nums ${textTone}`}>{formatNumber(used)}</span>
            <span className="ml-1">/ {formatNumber(DAILY_QUOTA_LIMIT)} ユニット</span>
            <span className="mx-2 text-slate-300">·</span>
            本日 {searchCount} 回リサーチ実行
            <span className="mx-2 text-slate-300">·</span>
            残り 約 {formatNumber(remaining)}
          </div>
        </div>
        <div className="flex min-w-[10rem] flex-1 items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          <span className={`w-10 text-right text-sm font-semibold tabular-nums ${textTone}`}>{pct.toFixed(0)}%</span>
        </div>
      </div>
      {pct >= 90 && (
        <p className="border-t border-rose-100 bg-rose-50 px-5 py-2 text-xs text-rose-700">
          ⚠️ 残り少ないです。本日の上限に近づいています。リセットまでお待ちください。
        </p>
      )}
    </div>
  );
}
