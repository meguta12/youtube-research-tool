import { useEffect, useMemo, useState } from 'react';
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
import { AppConfig, ResearchResult, SearchParams } from './lib/types';
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(() => (isManualMainDemo ? MANUAL_DEMO_RESULT : null));
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [quota, setQuota] = useState<QuotaState>(() => (isManualMainDemo || isManualProgressDemo ? MANUAL_DEMO_QUOTA : getQuotaUsage()));
  const [history, setHistory] = useState<HistoryEntry[]>(() => (isManualMainDemo || isManualProgressDemo ? MANUAL_DEMO_HISTORY : getHistory()));
  const [quotaDays, setQuotaDays] = useState<QuotaDailyRecord[]>(() => (isManualMainDemo || isManualProgressDemo ? MANUAL_DEMO_QUOTA_DAYS : getQuotaHistory(7)));

  useEffect(() => {
    if (!onboardingDone && getApiKey() && !isOnboarded()) {
      // already had API key but never finished onboarding - bypass
    }
  }, [onboardingDone]);

  function handleSaveApiKey(apiKey: string) {
    setApiKey(apiKey);
    setConfig({ ...config, apiKey });
  }
  function handleClearApiKey() {
    clearApiKey();
    setConfig({ ...config, apiKey: '' });
  }
  function handleSaveOptions(options: Omit<AppConfig, 'apiKey'>) {
    saveConfig(options);
    setConfig({ ...config, ...options });
  }

  async function handleRun(nextParams: SearchParams) {
    if (isManualMainDemo || isManualProgressDemo) {
      setParams(nextParams);
      setResult({ ...MANUAL_DEMO_RESULT, params: nextParams });
      setView('videos');
      return;
    }
    setParams(nextParams);
    saveLastParams(nextParams);
    setRunning(true);
    setErrorMessage(null);
    setProgress({ step: 'searching', message: '動画IDを検索中...' });
    try {
      const r = await runResearch(nextParams, config, setProgress);
      setResult(r);
      const entry: HistoryEntry = {
        searchedAt: r.searchedAt,
        keyword: r.params.keyword,
        count: r.videos.length,
        estimatedQuota: r.estimatedQuota
      };
      pushHistory(entry);
      addQuotaUsage(r.estimatedQuota);
      setQuota(getQuotaUsage());
      setHistory(getHistory());
      setQuotaDays(getQuotaHistory(7));
      if (r.videos.length === 0) {
        setErrorMessage('該当する動画が見つかりませんでした。条件を変えてお試しください。');
      } else {
        setView('videos');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'エラーが発生しました。');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  const hasResult = Boolean(result && result.videos.length > 0);
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
            running={running}
            progress={progress}
            errorMessage={errorMessage}
            result={result}
            hasApiKey={Boolean(config.apiKey)}
            quota={quota}
            onMissingApiKey={() => setShowSettings(true)}
            onOpenChangelog={() => setShowChangelog(true)}
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
