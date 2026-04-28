import { DAILY_QUOTA_LIMIT } from '../lib/storage';
import { formatNumber } from '../lib/utils';

interface QuotaCardProps {
  used: number;
  searchCount: number;
}

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

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <span>今日のAPI使用状況（推定）</span>
        <span className="text-xs font-normal text-slate-500">
          ※リセットは日本時間17時ごろ
        </span>
      </div>
      <div className="card-body space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className={`text-2xl font-bold ${textTone}`}>
              {formatNumber(used)} <span className="text-sm font-normal text-slate-500">/ {formatNumber(DAILY_QUOTA_LIMIT)}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              本日 {searchCount} 回リサーチ実行 / 残り 約 {formatNumber(remaining)}
            </div>
          </div>
          <div className={`text-lg font-semibold ${textTone}`}>
            {pct.toFixed(0)}%
          </div>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full ${tone} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct >= 90 && (
          <p className="text-xs text-rose-700">
            ⚠️ 残り少ないです。本日の上限に近づいています。リセットまでお待ちください。
          </p>
        )}
      </div>
    </div>
  );
}
