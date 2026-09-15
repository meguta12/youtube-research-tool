import { useMemo, useRef, useState } from 'react';
import { Layout } from './components/Layout';
import { HomePanel } from './components/HomePanel';
import { VideoList } from './components/VideoList';
import { ShareCardButton } from './components/ShareCardButton';
import { ChannelAnalysis } from './components/ChannelAnalysis';
import { CompetitorAnalysis } from './components/CompetitorAnalysis';
import { ThumbnailGallery } from './components/ThumbnailGallery';
import { SettingsPanel } from './components/SettingsPanel';
import { OnboardingWizard } from './components/OnboardingWizard';
import { LicenseGate } from './components/LicenseGate';
import { Modal } from './components/Modal';
import { HelpPanel } from './components/HelpPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { StockPanel } from './components/StockPanel';
import { IconBookmark, IconDownload, IconSearch, IconSheet } from './components/icons';
import { MyChannelPanel } from './components/MyChannelPanel';
import { ChangelogContent } from './components/UpdateBanner';
import { isLicenseRequired, validateLicense } from './lib/license';
import {
  addQuotaUsage,
  addStock,
  buildStockId,
  buildStockKeyword,
  clearApiKey,
  clearHistory,
  clearQuotaHistory,
  getApiKey,
  getConfig,
  getHistory,
  getLastParams,
  getLicense,
  getMyChannelInput,
  getQuotaHistory,
  getQuotaUsage,
  getStocks,
  HistoryEntry,
  isOnboarded,
  markOnboarded,
  pushHistory,
  QuotaDailyRecord,
  QuotaState,
  removeStock,
  removeStocksByKeyword,
  saveConfig,
  saveLastParams,
  setApiKey,
  setLicense,
  StockedVideo,
  updateStockMemo
} from './lib/storage';
import { runResearch, ResearchProgress } from './lib/research';
import { buildTrendSnapshot, compareWithPrevious } from './lib/trend';
import { estimateQuotaBeforeRun } from './lib/youtube';
import { AppConfig, normalizeKeyword, ResearchResult, SearchParams, Video } from './lib/types';
import { formatDateTime } from './lib/utils';
import { downloadResultsAsExcel, downloadVideosAsCsv } from './lib/exporter';
import {
  getManualDemoMode,
  MANUAL_DEMO_CONFIG,
  MANUAL_DEMO_HISTORY,
  MANUAL_DEMO_MY_CHANNEL,
  MANUAL_DEMO_MY_CHANNEL_SNAPSHOTS,
  MANUAL_DEMO_PROGRESS,
  MANUAL_DEMO_QUOTA,
  MANUAL_DEMO_QUOTA_DAYS,
  MANUAL_DEMO_RESULT
} from './lib/manualDemo';

type ViewKey = 'home' | 'videos' | 'channels' | 'competitors' | 'thumbnails' | 'stocks' | 'mychannel' | 'history';

// マルチキーワード連続リサーチの1回あたり上限。過剰なクォータ消費を防ぐ。
const MAX_MULTI_KEYWORDS = 20;

// マルチ実行の進捗（i/N と現在のキーワード）。
export interface MultiProgress {
  index: number; // 1始まり（現在何件目か）
  total: number;
  keyword: string;
}

// 画面右下に数秒だけ出す通知（ストック追加時など）。任意で1つだけアクションボタンを持てる。
interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const demoMode = getManualDemoMode();
const demoMainViews: ViewKey[] = ['home', 'videos', 'channels', 'competitors', 'thumbnails', 'stocks', 'mychannel', 'history'];
const isManualMainDemo = Boolean(demoMode && demoMainViews.includes(demoMode as ViewKey));
const isManualProgressDemo = demoMode === 'progress';

function initialDemoView(): ViewKey {
  if (isManualMainDemo) return demoMode as ViewKey;
  if (isManualProgressDemo) return 'home';
  return 'home';
}

export function App() {
  const [licenseUnlocked, setLicenseUnlocked] = useState<boolean>(() => {
    if (demoMode === 'license') return false;
    if (isManualMainDemo || isManualProgressDemo) return true;
    if (!isLicenseRequired()) return true;
    const stored = getLicense();
    return Boolean(stored) && validateLicense(stored);
  });

  const [onboardingDone, setOnboardingDone] = useState<boolean>(() => {
    if (isManualMainDemo || isManualProgressDemo) return true;
    return isOnboarded() && Boolean(getApiKey());
  });
  const [config, setConfig] = useState<AppConfig>(() => (isManualMainDemo || isManualProgressDemo ? MANUAL_DEMO_CONFIG : getConfig()));
  const [view, setView] = useState<ViewKey>(() => initialDemoView());
  const [params, setParams] = useState<SearchParams>(() => (isManualMainDemo || isManualProgressDemo ? MANUAL_DEMO_RESULT.params : getLastParams()));
  const [running, setRunning] = useState(isManualProgressDemo);
  const [progress, setProgress] = useState<ResearchProgress | null>(() => (isManualProgressDemo ? MANUAL_DEMO_PROGRESS : null));
  // マルチキーワード連続リサーチの進捗（null のときは非マルチ実行）。
  const [multiProgress, setMultiProgress] = useState<MultiProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancelledNotice, setCancelledNotice] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(() => (isManualMainDemo ? MANUAL_DEMO_RESULT : null));
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [quota, setQuota] = useState<QuotaState>(() => (isManualMainDemo || isManualProgressDemo ? MANUAL_DEMO_QUOTA : getQuotaUsage()));
  const [history, setHistory] = useState<HistoryEntry[]>(() => (isManualMainDemo || isManualProgressDemo ? MANUAL_DEMO_HISTORY : getHistory()));
  const [quotaDays, setQuotaDays] = useState<QuotaDailyRecord[]>(() => (isManualMainDemo || isManualProgressDemo ? MANUAL_DEMO_QUOTA_DAYS : getQuotaHistory(7)));
  // ストックはデモモードでも実際の localStorage を使う（保存操作そのものを試せるようにするため）。
  const [stocks, setStocks] = useState<StockedVideo[]>(() => getStocks());
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  // 実行中のリクエストを中止するための AbortController と、二重実行を防ぐ再入ガード。
  const abortControllerRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  function showToast(next: ToastState) {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast(next);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }

  // 表示中の結果のキーワードでストック済みの videoId 集合。リスト側のしおり表示に使う。
  const stockedVideoIds = useMemo(() => {
    if (!result) return new Set<string>();
    const keyword = buildStockKeyword(result.params.keyword);
    return new Set(stocks.filter((s) => s.keyword === keyword).map((s) => s.videoId));
  }, [stocks, result]);

  // 表示中の検索キーワードをグループ名としてストックを付け外しする。
  function handleToggleStock(video: Video) {
    if (!result) return;
    const keyword = buildStockKeyword(result.params.keyword);
    const id = buildStockId(video.videoId, keyword);
    if (stocks.some((s) => s.id === id)) {
      setStocks(removeStock(id));
      showToast({ message: 'ストックから外しました' });
      return;
    }
    const ok = addStock(video, keyword, result.searchedAt);
    if (!ok) {
      showToast({ message: '保存できませんでした。ブラウザの保存容量がいっぱいの可能性があります。' });
      return;
    }
    setStocks(getStocks());
    showToast({
      message: `「${keyword}」にストックしました`,
      actionLabel: 'ストックを見る',
      onAction: () => setView('stocks')
    });
  }

  function handleSaveApiKey(apiKey: string): boolean {
    const ok = setApiKey(apiKey);
    if (ok) setConfig({ ...config, apiKey });
    return ok;
  }
  function handleClearApiKey() {
    clearApiKey();
    setConfig({ ...config, apiKey: '' });
  }
  function handleSaveOptions(options: Omit<AppConfig, 'apiKey'>): boolean {
    const ok = saveConfig(options);
    if (ok) setConfig({ ...config, ...options });
    return ok;
  }

  // 1件のリサーチ結果を履歴に保存し、消費クォータを加算して各stateを更新する共通処理。
  // 単発（handleRun）とマルチ（handleRunMulti）で同じ保存挙動を共有するために切り出している。
  function persistResearchResult(r: ResearchResult) {
    const snapshot = buildTrendSnapshot(r);
    const entry: HistoryEntry = {
      searchedAt: r.searchedAt,
      keyword: r.params.keyword,
      count: r.videos.length,
      estimatedQuota: r.estimatedQuota,
      topVideoIds: snapshot.topVideoIds,
      topChannels: snapshot.topChannels
    };
    pushHistory(entry);
    addQuotaUsage(r.estimatedQuota);
    setQuota(getQuotaUsage());
    setHistory(getHistory());
    setQuotaDays(getQuotaHistory(7));
  }

  async function handleRun(nextParams: SearchParams) {
    if (isManualMainDemo || isManualProgressDemo) {
      setParams(nextParams);
      setResult({ ...MANUAL_DEMO_RESULT, params: nextParams });
      setView('videos');
      return;
    }
    // 二重実行防止の再入ガード（button disabled と二重化）。
    if (runningRef.current) return;
    runningRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setParams(nextParams);
    saveLastParams(nextParams);
    setRunning(true);
    setErrorMessage(null);
    setCancelledNotice(null);
    setProgress({ step: 'searching', message: '動画IDを検索中...' });
    try {
      const r = await runResearch(nextParams, config, setProgress, controller.signal);
      setResult(r);
      persistResearchResult(r);
      if (r.videos.length === 0) {
        setErrorMessage('該当する動画が見つかりませんでした。条件を変えてお試しください。');
      } else {
        setView('videos');
      }
    } catch (err: any) {
      // 中止（AbortError）はエラー扱いにせず、既存結果も消さずに一時メッセージだけ出す。
      if (err?.name === 'AbortError') {
        setCancelledNotice('中止しました');
      } else {
        setErrorMessage(err?.message || 'エラーが発生しました。');
      }
    } finally {
      runningRef.current = false;
      abortControllerRef.current = null;
      setRunning(false);
      setProgress(null);
    }
  }

  // 複数キーワードを順番に（1件ずつ順次）リサーチする。
  // 現在の検索条件（keyword 以外）を各キーワードに適用し、各結果を履歴に積む。
  async function handleRunMulti(keywords: string[], baseParams: SearchParams) {
    if (isManualMainDemo || isManualProgressDemo) return;
    // 空行・前後空白は無視し、正規化して重複排除。0件なら何もしない。上限は先頭 MAX_MULTI_KEYWORDS 件。
    const normalized: string[] = [];
    const seen = new Set<string>();
    for (const raw of keywords) {
      const kw = normalizeKeyword(raw);
      if (!kw || seen.has(kw)) continue;
      seen.add(kw);
      normalized.push(kw);
    }
    const queue = normalized.slice(0, MAX_MULTI_KEYWORDS);
    if (queue.length === 0) return;

    // 二重起動防止（単発実行中はマルチも無効）。既存の runningRef を共有して相互排他にする。
    if (runningRef.current) return;
    runningRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setRunning(true);
    setErrorMessage(null);
    setCancelledNotice(null);
    setProgress(null);

    let completed = 0; // 保存まで完了したキーワード数
    let lastResult: ResearchResult | null = null;
    try {
      for (let i = 0; i < queue.length; i++) {
        const keyword = queue[i];
        setMultiProgress({ index: i + 1, total: queue.length, keyword });
        const runParams: SearchParams = { ...baseParams, keyword };
        // 最初のキーワードの条件を「前回条件」として保存しておく（単発の挙動に合わせる）。
        if (i === 0) {
          setParams(runParams);
          saveLastParams(runParams);
        }
        const r = await runResearch(runParams, config, undefined, controller.signal);
        persistResearchResult(r);
        completed += 1;
        lastResult = r; // 最後に成功した結果を後で画面に表示する。
      }
      // 全キーワード完了。最後に成功した結果を画面に表示する。
      if (lastResult) {
        setResult(lastResult);
        setParams(lastResult.params);
        saveLastParams(lastResult.params);
        if (lastResult.videos.length > 0) setView('videos');
      }
    } catch (err: any) {
      // 中止（AbortError）はキュー全体を止め、単発同様「中止しました」。ここまでの結果は履歴に残る。
      if (err?.name === 'AbortError') {
        setCancelledNotice('中止しました');
      } else {
        // APIエラー（4xx等）はキューを止め、どこまで完了したかを添えて表示する。
        const failedKeyword = queue[completed] ?? '';
        setErrorMessage(`「${failedKeyword}」でエラー: ${err?.message || 'エラーが発生しました。'}。ここまで${completed}件完了`);
      }
    } finally {
      runningRef.current = false;
      abortControllerRef.current = null;
      setRunning(false);
      setMultiProgress(null);
    }
  }

  function handleCancelRun() {
    abortControllerRef.current?.abort();
  }

  // マイチャンネル分析の消費ユニットを加算し、使用量stateを更新する（履歴には積まない）。
  function handleMyChannelQuotaUsed(amount: number) {
    addQuotaUsage(amount);
    setQuota(getQuotaUsage());
    setQuotaDays(getQuotaHistory(7));
  }

  const hasResult = Boolean(result && result.videos.length > 0);
  // 前回同一キーワード結果とのトレンド比較。result か history が変わったときだけ再計算する。
  const trendComparison = useMemo(
    () => (result ? compareWithPrevious(result, history) : null),
    [result, history]
  );
  const competitorHasData = useMemo(() => {
    if (!result) return false;
    return result.competitorStats.topWords.length > 0 || result.videos.length > 0;
  }, [result]);

  if (!licenseUnlocked) {
    return (
      <LicenseGate
        onUnlock={(key) => {
          setLicense(key);
          setLicenseUnlocked(true);
        }}
      />
    );
  }

  if (!onboardingDone) {
    return (
      <OnboardingWizard
        hasApiKey={Boolean(config.apiKey)}
        onSaveApiKey={handleSaveApiKey}
        onClearApiKey={handleClearApiKey}
        onComplete={() => {
          markOnboarded();
          setOnboardingDone(true);
        }}
      />
    );
  }

  return (
    <>
      <Layout
        current={view}
        onNavigate={(k) => setView(k as ViewKey)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHelp={() => setShowHelp(true)}
        quotaUsed={quota.used}
        stockCount={stocks.length}
      >
        {view !== 'home' && view !== 'history' && view !== 'stocks' && hasResult && result && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              <span className="section-icon bg-brand-50 text-brand-600">
                <IconSearch size={15} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm text-slate-500">
                  キーワード「<span className="font-semibold text-slate-800">{result.params.keyword}</span>」の結果
                </div>
                <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-slate-400">
                  <span>{result.videos.length}件</span>
                  <span>{formatDateTime(new Date(result.searchedAt))}</span>
                  {stockedVideoIds.size > 0 && (
                    <button type="button" className="inline-flex items-center gap-1 text-brand-600 hover:underline" onClick={() => setView('stocks')}>
                      <IconBookmark size={11} filled />
                      ストック {stockedVideoIds.size}件
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ShareCardButton result={result} />
              <button className="btn-secondary" onClick={() => downloadVideosAsCsv(result)}>
                <IconSheet size={15} />
                CSV
              </button>
              <button className="btn-primary" onClick={() => downloadResultsAsExcel(result)}>
                <IconDownload size={15} />
                Excelダウンロード
              </button>
            </div>
          </div>
        )}

        {view === 'home' && (
          <HomePanel
            initial={params}
            onRun={handleRun}
            onRunMulti={handleRunMulti}
            onCancel={handleCancelRun}
            running={running}
            progress={progress}
            multiProgress={multiProgress}
            maxMultiKeywords={MAX_MULTI_KEYWORDS}
            errorMessage={errorMessage}
            cancelledNotice={cancelledNotice}
            result={result}
            trendComparison={trendComparison}
            hasApiKey={Boolean(config.apiKey)}
            quota={quota}
            onMissingApiKey={() => setShowSettings(true)}
            onOpenChangelog={() => setShowChangelog(true)}
            onApplyParams={(next) => {
              setParams(next);
              saveLastParams(next);
            }}
          />
        )}
        {view === 'history' && (
          <HistoryPanel
            history={history}
            quotaDays={quotaDays}
            onRerun={(keyword) => {
              const next = { ...params, keyword };
              setParams(next);
              saveLastParams(next);
              setView('home');
            }}
            onClearHistory={() => {
              clearHistory();
              setHistory([]);
            }}
            onClearQuota={() => {
              clearQuotaHistory();
              setQuota(getQuotaUsage());
              setQuotaDays(getQuotaHistory(7));
            }}
          />
        )}
        {view === 'stocks' && (
          <StockPanel
            stocks={stocks}
            onRemove={(id) => setStocks(removeStock(id))}
            onRemoveGroup={(keyword) => setStocks(removeStocksByKeyword(keyword))}
            onUpdateMemo={(id, memo) => setStocks(updateStockMemo(id, memo))}
            onRerun={(keyword) => {
              const next = { ...params, keyword };
              setParams(next);
              saveLastParams(next);
              setView('home');
            }}
            onGoHome={() => setView('home')}
          />
        )}
        {view === 'videos' && (
          <VideoList videos={result?.videos ?? []} stockedIds={stockedVideoIds} onToggleStock={handleToggleStock} />
        )}
        {view === 'channels' && <ChannelAnalysis channels={result?.channels ?? []} />}
        {view === 'competitors' && (
          <CompetitorAnalysis
            videos={result?.videos ?? []}
            stats={
              result?.competitorStats ?? {
                topWords: [],
                topBigrams: [],
                titleLengthDistribution: {},
                weekdayDistribution: {},
                hourDistribution: {},
                durationDistribution: {},
                weekdayHourMatrix: []
              }
            }
            hasData={competitorHasData}
          />
        )}
        {view === 'thumbnails' && (
          <ThumbnailGallery videos={result?.videos ?? []} stockedIds={stockedVideoIds} onToggleStock={handleToggleStock} />
        )}
        {view === 'mychannel' && (
          <MyChannelPanel
            config={config}
            researchResult={result}
            hasApiKey={Boolean(config.apiKey)}
            onMissingApiKey={() => setShowSettings(true)}
            onQuotaUsed={handleMyChannelQuotaUsed}
            demoData={isManualMainDemo && demoMode === 'mychannel' ? MANUAL_DEMO_MY_CHANNEL : undefined}
            demoSnapshots={isManualMainDemo && demoMode === 'mychannel' ? MANUAL_DEMO_MY_CHANNEL_SNAPSHOTS : undefined}
            initialInput={isManualMainDemo || isManualProgressDemo ? '' : getMyChannelInput().input}
            initialMaxVideos={isManualMainDemo || isManualProgressDemo ? 300 : getMyChannelInput().maxVideos}
          />
        )}
      </Layout>

      <Modal open={showSettings} title="設定" onClose={() => setShowSettings(false)}>
        <SettingsPanel
          config={config}
          onSaveApiKey={handleSaveApiKey}
          onClearApiKey={handleClearApiKey}
          onSaveOptions={handleSaveOptions}
        />
      </Modal>

      <Modal open={showHelp} title="使い方" onClose={() => setShowHelp(false)}>
        <HelpPanel />
      </Modal>

      <Modal open={showChangelog} title="アップデート履歴" onClose={() => setShowChangelog(false)}>
        <ChangelogContent />
      </Modal>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 sm:justify-end sm:pr-6">
          <div className="toast" role="status" aria-live="polite">
            <IconBookmark size={16} className="shrink-0 text-brand-100" filled />
            <span>{toast.message}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className="rounded-md bg-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/25"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
