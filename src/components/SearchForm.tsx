import { useEffect, useState } from 'react';
import { DurationKey, OrderKey, PeriodKey, SearchParams } from '../lib/types';

interface SearchFormProps {
  initial: SearchParams;
  onRun: (params: SearchParams) => void;
  running: boolean;
  hasApiKey: boolean;
  onMissingApiKey: () => void;
}

const PERIODS: PeriodKey[] = ['今日', '今週', '今月', '3ヶ月', '全期間'];
const DURATIONS: DurationKey[] = ['全て', '4分未満（ショート寄り）', '4-20分', '20分以上'];
const ORDERS: OrderKey[] = ['視聴回数', '関連度', '新着', '評価'];
const COUNTS = [10, 25, 50, 100];

export function SearchForm({ initial, onRun, running, hasApiKey, onMissingApiKey }: SearchFormProps) {
  const [params, setParams] = useState<SearchParams>(initial);

  useEffect(() => setParams(initial), [initial]);

  function update<K extends keyof SearchParams>(key: K, value: SearchParams[K]) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasApiKey) {
      onMissingApiKey();
      return;
    }
    onRun(params);
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-header flex items-center justify-between">
        <span>検索条件</span>
        {!hasApiKey && (
          <span className="badge bg-amber-100 text-amber-800">APIキー未設定</span>
        )}
      </div>
      <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="label" htmlFor="keyword">キーワード（必須）</label>
          <input
            id="keyword"
            type="text"
            className="input mt-1"
            placeholder="例：副業 / ダイエット / 投資 など"
            value={params.keyword}
            onChange={(e) => update('keyword', e.target.value)}
            disabled={running}
          />
        </div>
        <div>
          <label className="label">期間</label>
          <select
            className="input mt-1"
            value={params.period}
            onChange={(e) => update('period', e.target.value as PeriodKey)}
            disabled={running}
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">動画尺</label>
          <select
            className="input mt-1"
            value={params.duration}
            onChange={(e) => update('duration', e.target.value as DurationKey)}
            disabled={running}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">並び替え</label>
          <select
            className="input mt-1"
            value={params.order}
            onChange={(e) => update('order', e.target.value as OrderKey)}
            disabled={running}
          >
            {ORDERS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">取得件数</label>
          <select
            className="input mt-1"
            value={params.maxResults}
            onChange={(e) => update('maxResults', Number(e.target.value))}
            disabled={running}
          >
            {COUNTS.map((c) => (
              <option key={c} value={c}>{c}件</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
          <button
            type="submit"
            className="btn-primary"
            disabled={running || !params.keyword.trim()}
          >
            {running ? '実行中...' : '▶ リサーチ実行'}
          </button>
        </div>
      </div>
    </form>
  );
}
