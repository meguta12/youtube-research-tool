import { DAILY_QUOTA_LIMIT, HistoryEntry, QuotaDailyRecord } from '../lib/storage';
import { formatNumber } from '../lib/utils';

interface HistoryPanelProps {
  history: HistoryEntry[];
  quotaDays: QuotaDailyRecord[];
  onRerun: (keyword: string) => void;
  onClearHistory: () => void;
  onClearQuota: () => void;
}

export function HistoryPanel({
  history,
  quotaDays,
  onRerun,
  onClearHistory,
  onClearQuota
}: HistoryPanelProps) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span>過去7日間のAPI使用状況（推定）</span>
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-rose-600"
            onClick={() => {
              if (confirm('クォータの記録をクリアしますか？')) onClearQuota();
            }}
          >
            記録をクリア
          </button>
        </div>
        <div className="card-body">
          {quotaDays.length === 0 ? (
            <p className="text-sm text-slate-500">記録がありません。</p>
          ) : (
            <div className="space-y-2">
              {quotaDays.map((d) => {
                const pct = Math.min(100, (d.used / DAILY_QUOTA_LIMIT) * 100);
                const tone =
                  pct >= 90 ? 'bg-rose-500'
                  : pct >= 70 ? 'bg-amber-500'
                  : pct > 0 ? 'bg-emerald-500'
                  : 'bg-slate-200';
                return (
                  <div key={d.dateKey} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-slate-700 font-mono">{d.dateKey}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-20 text-right tabular-nums text-slate-700">
                      {formatNumber(d.used)}
                    </span>
                    <span className="w-16 text-right text-xs text-slate-500">
                      {d.searchCount}回
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span>検索履歴（最大50件）</span>
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-rose-600"
            onClick={() => {
              if (confirm('検索履歴をクリアしますか？')) onClearHistory();
            }}
          >
            履歴をクリア
          </button>
        </div>
        {history.length === 0 ? (
          <div className="card-body text-sm text-slate-500">
            まだ検索履歴がありません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>キーワード</th>
                  <th className="text-right">取得件数</th>
                  <th className="text-right">消費ユニット(目安)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap font-mono text-xs">
                      {new Date(h.searchedAt).toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="font-medium">{h.keyword}</td>
                    <td className="text-right">{h.count}件</td>
                    <td className="text-right">約 {formatNumber(h.estimatedQuota)}</td>
                    <td>
                      <button
                        type="button"
                        className="text-xs text-brand-600 hover:underline"
                        onClick={() => onRerun(h.keyword)}
                      >
                        ↻ 再検索
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
