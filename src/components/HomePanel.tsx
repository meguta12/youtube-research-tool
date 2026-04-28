import { ResearchProgress } from '../lib/research';
import { QuotaState } from '../lib/storage';
import { ResearchResult, SearchParams } from '../lib/types';
import { formatNumber } from '../lib/utils';
import { QuotaCard } from './QuotaCard';
import { SearchForm } from './SearchForm';

interface HomePanelProps {
  initial: SearchParams;
  onRun: (params: SearchParams) => void;
  running: boolean;
  progress: ResearchProgress | null;
  errorMessage: string | null;
  result: ResearchResult | null;
  hasApiKey: boolean;
  quota: QuotaState;
  onMissingApiKey: () => void;
}

export function HomePanel({
  initial,
  onRun,
  running,
  progress,
  errorMessage,
  result,
  hasApiKey,
  quota,
  onMissingApiKey
}: HomePanelProps) {
  return (
    <div className="space-y-6">
      <QuotaCard used={quota.used} searchCount={quota.searchCount} />

      <SearchForm
        initial={initial}
        onRun={onRun}
        running={running}
        hasApiKey={hasApiKey}
        onMissingApiKey={onMissingApiKey}
      />

      {running && progress && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <span className="inline-block h-3 w-3 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-sm text-slate-700">{progress.message}</span>
            </div>
          </div>
        </div>
      )}

      {errorMessage && !running && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <strong>エラー：</strong> {errorMessage}
        </div>
      )}

      {result && !running && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="取得件数" value={`${result.videos.length}件`} />
          <Stat label="チャンネル数" value={`${result.channels.length}件`} />
          <Stat label="最高再生数" value={formatNumber(result.videos[0]?.viewCount || 0)} />
          <Stat label="消費ユニット(目安)" value={`約${result.estimatedQuota}`} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-1 text-xl font-semibold text-slate-800">{value}</div>
      </div>
    </div>
  );
}
