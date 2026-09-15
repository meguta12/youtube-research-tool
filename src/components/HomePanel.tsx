import { MultiProgress } from '../App';
import { ResearchProgress } from '../lib/research';
import { QuotaState } from '../lib/storage';
import { TrendComparison } from '../lib/trend';
import { ResearchResult, SearchParams } from '../lib/types';
import { formatDateTime, formatNumber } from '../lib/utils';
import { AiAnalysisButton } from './AiAnalysisButton';
import { ShareCardButton } from './ShareCardButton';
import { MultiKeywordSection } from './MultiKeywordSection';
import { QuotaCard } from './QuotaCard';
import { SearchForm } from './SearchForm';
import { UpdateBanner } from './UpdateBanner';
import { IconFlame, IconStop, IconTv, IconVideo, IconZap } from './icons';

interface HomePanelProps {
  initial: SearchParams;
  onRun: (params: SearchParams) => void;
  onRunMulti: (keywords: string[], baseParams: SearchParams) => void;
  onCancel: () => void;
  running: boolean;
  progress: ResearchProgress | null;
  multiProgress: MultiProgress | null;
  maxMultiKeywords: number;
  errorMessage: string | null;
  cancelledNotice: string | null;
  result: ResearchResult | null;
  trendComparison: TrendComparison | null;
  hasApiKey: boolean;
  quota: QuotaState;
  onMissingApiKey: () => void;
  onOpenChangelog: () => void;
  onApplyParams: (params: SearchParams) => void;
}

export function HomePanel({
  initial,
  onRun,
  onRunMulti,
  onCancel,
  running,
  progress,
  multiProgress,
  maxMultiKeywords,
  errorMessage,
  cancelledNotice,
  result,
  trendComparison,
  hasApiKey,
  quota,
  onMissingApiKey,
  onOpenChangelog,
  onApplyParams
}: HomePanelProps) {
  return (
    <div className="space-y-5">
      <UpdateBanner onOpenChangelog={onOpenChangelog} />

      <SearchForm
        initial={initial}
        onRun={onRun}
        running={running}
        hasApiKey={hasApiKey}
        quotaUsed={quota.used}
        onMissingApiKey={onMissingApiKey}
        onApplyParams={onApplyParams}
      />

      {running && progress && (
        <ProgressCard message={progress.message} onCancel={onCancel} />
      )}

      {running && multiProgress && (
        <ProgressCard
          message={`${multiProgress.index}/${multiProgress.total} 件目：「${multiProgress.keyword}」を検索中…`}
          onCancel={onCancel}
        />
      )}

      {cancelledNotice && !running && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {cancelledNotice}
        </div>
      )}

      {errorMessage && !running && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <strong>エラー：</strong> {errorMessage}
        </div>
      )}

      {result?.partial === true && !running && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          一部の取得が完了しませんでした。表示中のデータは部分的です（APIの一時的なエラーの可能性）。もう一度実行すると全件取得できることがあります。
        </div>
      )}

      {result && !running && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-500">
              キーワード「<span className="font-semibold text-slate-800">{result.params.keyword}</span>」の結果
              <span className="ml-2 text-xs text-slate-400">{formatDateTime(new Date(result.searchedAt))}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ShareCardButton result={result} />
              <AiAnalysisButton result={result} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="取得件数"
              value={`${result.videos.length}件`}
              icon={<IconVideo size={15} />}
              tone="bg-brand-50 text-brand-600"
              chip={
                trendComparison?.hasPrev
                  ? `新規ランクイン ${trendComparison.newVideoCount}本`
                  : undefined
              }
            />
            <Stat label="チャンネル数" value={`${result.channels.length}件`} icon={<IconTv size={15} />} tone="bg-violet-50 text-violet-600" />
            <Stat label="最高再生数" value={formatNumber(result.videos[0]?.viewCount || 0)} icon={<IconFlame size={15} />} tone="bg-heat-50 text-heat-600" />
            <Stat label="消費ユニット(目安)" value={`約${result.estimatedQuota}`} icon={<IconZap size={15} />} tone="bg-emerald-50 text-emerald-600" />
          </div>
          {trendComparison && <TrendComparePanel comparison={trendComparison} />}
        </div>
      )}

      <MultiKeywordSection
        baseParams={initial}
        onRunMulti={onRunMulti}
        running={running}
        hasApiKey={hasApiKey}
        maxKeywords={maxMultiKeywords}
        onMissingApiKey={onMissingApiKey}
      />

      <QuotaCard used={quota.used} searchCount={quota.searchCount} />

      <CreatorCredit />
    </div>
  );
}

// 実行中の進捗表示（単発・マルチ共通）。
function ProgressCard({ message, onCancel }: { message: string; onCancel: () => void }) {
  return (
    <div className="card border-brand-100">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-500" />
          </span>
          <span className="text-sm text-slate-700">{message}</span>
        </div>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          <IconStop size={14} />
          中止
        </button>
      </div>
    </div>
  );
}

function CreatorCredit() {
  return (
    <div className="pt-6 mt-2 border-t border-slate-200">
      <div className="text-center text-xs text-slate-500 space-y-1.5">
        <div>制作者：めぐペン</div>
        <div className="flex items-center justify-center gap-3">
          <a
            href="https://note.com/megupen12/portal"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-brand-600 hover:underline transition-colors"
          >
            note
          </a>
          <span className="text-slate-300">·</span>
          <a
            href="https://substack.com/@megupen"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-brand-600 hover:underline transition-colors"
          >
            Substack
          </a>
        </div>
      </div>
    </div>
  );
}

function TrendComparePanel({ comparison }: { comparison: TrendComparison }) {
  // 前回が無いキーワードは初回リサーチのため控えめに表示する。
  if (!comparison.hasPrev) {
    return (
      <p className="text-xs text-slate-400">
        初回リサーチのため比較対象なし。次回以降、同じキーワードで前回との差分を表示します。
      </p>
    );
  }
  const prevLabel = comparison.prevDate ? formatDateTime(new Date(comparison.prevDate)) : '';
  return (
    <div className="card">
      <div className="card-header">
        前回（{prevLabel}）との比較
      </div>
      <div className="card-body space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="badge bg-brand-50 text-brand-700">
            新しくランクインした動画 {comparison.newVideoCount}本
          </span>
          <span className="badge bg-slate-100 text-slate-600">
            上位から外れたチャンネル {comparison.goneChannelCount}件
          </span>
        </div>
        <div>
          <div className="text-xs text-slate-500">新規チャンネル（最大10件）</div>
          {comparison.newChannels.length === 0 ? (
            <p className="mt-1 text-sm text-slate-400">なし</p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {comparison.newChannels.map((c) => (
                <span key={c.id} className="badge bg-emerald-50 text-emerald-700">
                  {c.title}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
  chip
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
  chip?: string;
}) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className={`section-icon ${tone}`}>{icon}</span>
          <span>{label}</span>
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums text-slate-800">{value}</div>
        {chip && (
          <span className="mt-1.5 inline-flex badge bg-heat-50 text-heat-600">{chip}</span>
        )}
      </div>
    </div>
  );
}
