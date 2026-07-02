import { useMemo, useRef, useState } from 'react';
import { Layout } from './components/Layout';
import { HomePanel } from './components/HomePanel';
import { VideoList } from './components/VideoList';
import { ChannelAnalysis } from './components/ChannelAnalysis';
import { CompetitorAnalysis } from './components/CompetitorAnalysis';
import { ThumbnailGallery } from './components/ThumbnailGallery';
import { SettingsPanel } from './components/SettingsPanel';
import { OnboardingWizard } from './components/OnboardingWizard';
import { LicenseGate } from './components/LicenseGate';
import { Modal } from './components/Modal';
import { HelpPanel } from './components/HelpPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { ChangelogContent } from './components/UpdateBanner';
import { isLicenseRequired, validateLicense } from './lib/license';
import {
  addQuotaUsage,
  clearApiKey,
  clearHistory,
  clearQuotaHistory,
  getApiKey,
  getConfig,
  getHistory,
  getLastParams,
  getLicense,
  getQuotaHistory,
  getQuotaUsage,
  HistoryEntry,
  isOnboarded,
  markOnboarded,
  pushHistory,
  QuotaDailyRecord,
  QuotaState,
  saveConfig,
  saveLastParams,
  setApiKey,
  setLicense
} from './lib/storage';
import { runResearch, ResearchProgress } from './lib/research';
import { buildTrendSnapshot, compareWithPrevious } from './lib/trend';
import { estimateQuotaBeforeRun } from './lib/youtube';
import { AppConfig, normalizeKeyword, ResearchResult, SearchParams } from './lib/types';
import { downloadResultsAsExcel, downloadVideosAsCsv } from './lib/exporter';
import {
  getManualDemoMode,
  MANUAL_DEMO_CONFIG,
  MANUAL_DEMO_HISTORY,
  MANUAL_DEMO_PROGRESS,
  MANUAL_DEMO_QUOTA,
  MANUAL_DEMO_QUOTA_DAYS,
  MANUAL_DEMO_RESULT
} from './lib/manualDemo';

type ViewKey = 'home' | 'videos' | 'channels' | 'competitors' | 'thumbnails' | 'history';

// マルチキーワード連続リサーチの1回あたり上限。過剰なクォータ消費を防ぐ。
const MAX_MULTI_KEYWORDS = 20;

// マルチ実行の進捗（i/N と現在のキーワード）。
export interface MultiProgress {
  index: number; // 1始まり（現在何件目か）
  total: number;
  keyword: string;
}

const demoMode = getManualDemoMode();
const demoMainViews: ViewKey[] = ['home', 'videos', 'channels', 'competitors', 'thumbnails', 'history'];
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
  // 実行中のリクエストを中止するための AbortController と、二重実行を防ぐ再入ガード。
  const abortControllerRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

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
      >
        {view !== 'home' && view !== 'history' && hasResult && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-500">
              キーワード「<span className="font-semibold text-slate-800">{result?.params.keyword}</span>」の結果
            </div>
            <div className="flex gap-2">
              <button
                className="btn-secondary"
                onClick={() => result && downloadVideosAsCsv(result)}
              >
                CSV
              </button>
              <button
                className="btn-primary"
                onClick={() => result && downloadResultsAsExcel(result)}
              >
                ⬇ Excelダウンロード
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
        {view === 'videos' && <VideoList videos={result?.videos ?? []} />}
        {view === 'channels' && <ChannelAnalysis channels={result?.channels ?? []} />}
        {view === 'competitors' && (
          <CompetitorAnalysis
            stats={
              result?.competitorStats ?? {
                topWords: [],
                topBigrams: [],
                titleLengthDistribution: {},
                weekdayDistribution: {},
                hourDistribution: {},
                durationDistribution: {}
              }
            }
            hasData={competitorHasData}
          />
        )}
        {view === 'thumbnails' && <ThumbnailGallery videos={result?.videos ?? []} />}
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
    </>
  );
}
