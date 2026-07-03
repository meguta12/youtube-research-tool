import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { analyzeTitles } from '../lib/analyzer';
import { getHeatTier } from '../lib/heat';
import { fetchMyChannel, MyChannelData } from '../lib/myChannel';
import {
  currentTokyoDateKey,
  getChannelSnapshots,
  recordChannelSnapshot,
  saveMyChannelInput,
  Snapshot
} from '../lib/storage';
import { AppConfig, CompetitorStats, ResearchResult, Video } from '../lib/types';
import { formatNumber, median } from '../lib/utils';
import { buildMyChannelAiText, MyChannelCopyButton } from './MyChannelAiButton';

// グラフ群（recharts 依存）は遅延読み込みして、メインチャンクから切り離す（D2 パターン踏襲）。
const SubscriberGrowthChart = lazy(() =>
  import('./charts/SubscriberGrowthChart').then((m) => ({ default: m.SubscriberGrowthChart }))
);
const TimelineChart = lazy(() =>
  import('./charts/TimelineChart').then((m) => ({ default: m.TimelineChart }))
);
const PostingHeatmap = lazy(() =>
  import('./charts/PostingHeatmap').then((m) => ({ default: m.PostingHeatmap }))
);

interface MyChannelPanelProps {
  config: AppConfig;
  // 直近のリサーチ結果（ベンチマーク比較用）。無ければ比較カードは非表示。
  researchResult: ResearchResult | null;
  hasApiKey: boolean;
  onMissingApiKey: () => void;
  // 取得成功時に消費ユニットを加算するためのコールバック（App 側の addQuotaUsage を呼ぶ）。
  onQuotaUsed: (amount: number) => void;
  // デモ用の初期表示データ（?demo=mychannel）。指定時は取得せずこれを描画する。
  demoData?: MyChannelData;
  demoSnapshots?: Snapshot[];
  // 初期入力（localStorage 復元）。
  initialInput: string;
  initialMaxVideos: number;
}

// 取得本数の選択肢（既定300）。
const MAX_VIDEO_OPTIONS = [100, 300, 500] as const;
const OUTLIER_TOP_LIMIT = 10;

// 推定消費ユニット = 1 + ceil(n/50)×2（channels.list 1 ＋ playlistItems ＋ videos.list）。
function estimateMyChannelQuota(maxVideos: number): number {
  return 1 + Math.ceil(maxVideos / 50) * 2;
}

export function MyChannelPanel({
  config,
  researchResult,
  hasApiKey,
  onMissingApiKey,
  onQuotaUsed,
  demoData,
  demoSnapshots,
  initialInput,
  initialMaxVideos
}: MyChannelPanelProps) {
  const [input, setInput] = useState(initialInput);
  const [maxVideos, setMaxVideos] = useState<number>(initialMaxVideos);
  const [running, setRunning] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancelledNotice, setCancelledNotice] = useState<string | null>(null);
  const [data, setData] = useState<MyChannelData | null>(demoData ?? null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(demoSnapshots ?? []);
  // 実行中のリクエストを中止する AbortController と二重実行を防ぐ再入ガード（handleRun パターン）。
  const abortControllerRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  const estimatedQuota = estimateMyChannelQuota(maxVideos);

  async function handleAnalyze() {
    if (!hasApiKey) {
      onMissingApiKey();
      return;
    }
    if (!input.trim()) {
      setErrorMessage('チャンネルのURL・@ハンドル・チャンネルIDのいずれかを入力してください。');
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setRunning(true);
    setErrorMessage(null);
    setCancelledNotice(null);
    setProgressMessage('チャンネル情報を取得中...');
    // 入力と選択本数を保存し、次回復元できるようにする。
    saveMyChannelInput({ input: input.trim(), maxVideos });
    try {
      const result = await fetchMyChannel(input, maxVideos, config, controller.signal, (msg) =>
        setProgressMessage(msg)
      );
      setData(result);
      // 取得成功時に成長記録を1点追加（同じ日付キーは上書き）し、消費を加算する。
      const dateKey = currentTokyoDateKey();
      recordChannelSnapshot(result.channel.id, {
        dateKey,
        subscriberCount: result.channel.subscriberCount,
        totalViewCount: result.channel.totalViewCount,
        videoCount: result.channel.videoCount
      });
      setSnapshots(getChannelSnapshots(result.channel.id));
      onQuotaUsed(result.estimatedQuota);
    } catch (err: any) {
      // 中止（AbortError）はエラー扱いにせず既存結果も消さない（handleRun 踏襲）。
      if (err?.name === 'AbortError') {
        setCancelledNotice('中止しました');
      } else {
        setErrorMessage(err?.message || 'エラーが発生しました。');
      }
    } finally {
      runningRef.current = false;
      abortControllerRef.current = null;
      setRunning(false);
      setProgressMessage(null);
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  return (
    <div className="space-y-6">
      {/* 1. 入力カード */}
      <div className="card">
        <div className="card-header">マイチャンネル分析（APIキーだけで自分の全動画を分析）</div>
        <div className="card-body space-y-3">
          <p className="text-sm text-slate-500">
            自分のチャンネルURL・@ハンドル・チャンネルIDを入れると、APIキーだけで公開データを取得して独自指標で自己分析できます。検索（search.list）を使わないため消費は激安です。
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="label" htmlFor="my-channel-input">
                チャンネルURL / @ハンドル / チャンネルID
              </label>
              <input
                id="my-channel-input"
                type="text"
                className="input w-full"
                placeholder="例: @megupen または https://www.youtube.com/@megupen または UCxxxx..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="my-channel-count">
                取得本数
              </label>
              <select
                id="my-channel-count"
                className="input w-32"
                value={maxVideos}
                onChange={(e) => setMaxVideos(Number(e.target.value))}
              >
                {MAX_VIDEO_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    {count}本
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={handleAnalyze}
              disabled={running}
            >
              {running ? '分析中…' : '分析する'}
            </button>
            <span className="text-xs text-slate-500">推定消費：約{estimatedQuota}ユニット</span>
          </div>

          {running && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-3">
                <span className="inline-block h-3 w-3 rounded-full bg-brand-500 animate-pulse" />
                <span className="text-sm text-slate-700">{progressMessage || '取得中...'}</span>
              </div>
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                中止
              </button>
            </div>
          )}
          {cancelledNotice && !running && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {cancelledNotice}
            </div>
          )}
          {errorMessage && !running && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <strong>エラー：</strong> {errorMessage}
            </div>
          )}
          {data?.partial === true && !running && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              一部の取得が完了しませんでした。表示中のデータは部分的です（APIの一時的なエラーの可能性）。もう一度実行すると全件取得できることがあります。
            </div>
          )}
        </div>
      </div>

      {data && (
        <MyChannelResult
          data={data}
          snapshots={snapshots}
          researchResult={researchResult}
        />
      )}
    </div>
  );
}

// 取得結果（ヘッダー・成長記録・アウトライアー・グラフ・頻出ワード・ベンチマーク・AIボタン）。
function MyChannelResult({
  data,
  snapshots,
  researchResult
}: {
  data: MyChannelData;
  snapshots: Snapshot[];
  researchResult: ResearchResult | null;
}) {
  const channel = data.channel;
  const videos = data.videos;

  // 自分のアウトライアー TOP10（heatScore 降順、null は末尾）。
  const outliers = useMemo(
    () =>
      [...videos]
        .filter((v) => v.heatScore !== null)
        .sort((a, b) => (b.heatScore ?? -1) - (a.heatScore ?? -1))
        .slice(0, OUTLIER_TOP_LIMIT),
    [videos]
  );

  // 頻出ワード・2語・投稿マップは既存 analyzeTitles をそのまま呼んで組み立てる。
  const stats: CompetitorStats = useMemo(() => analyzeTitles(videos, buildAnalyzeConfig()), [videos]);

  return (
    <div className="space-y-6">
      {/* 2. チャンネルヘッダーカード */}
      <ChannelHeaderCard channel={channel} fetchedVideoCount={data.fetchedVideoCount} />

      {/* 3. 成長記録 */}
      <div className="card">
        <div className="card-header">成長記録（登録者数の推移）</div>
        {snapshots.length >= 2 ? (
          <Suspense fallback={<ChartLoading height={280} />}>
            <SubscriberGrowthChart snapshots={snapshots} />
          </Suspense>
        ) : (
          <div className="card-body text-sm text-slate-500">
            開くたびに記録され、成長グラフが育ちます（今日の記録を保存しました）。
          </div>
        )}
      </div>

      {/* 4. 自分のアウトライアー TOP10 */}
      <div className="card">
        <div className="card-header">あなたの勝ちパターンの原石（自分のアウトライアー TOP10）</div>
        {outliers.length === 0 ? (
          <div className="card-body text-sm text-slate-500">
            ヒートスコアを算出できる動画がまだありません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-32 min-w-[128px]">サムネ</th>
                  <th>タイトル</th>
                  <th className="text-right">再生数</th>
                  <th className="text-right">1日平均</th>
                  <th className="text-right">倍率</th>
                  <th className="text-right">エンゲージ率</th>
                  <th className="text-right">ヒート</th>
                </tr>
              </thead>
              <tbody>
                {outliers.map((v) => {
                  const tier = getHeatTier(v.heatScore);
                  const rowClass =
                    tier === 'S' ? 'bg-amber-50 hover:bg-amber-100' : 'odd:bg-slate-50/50 hover:bg-slate-50';
                  return (
                    <tr key={v.videoId} className={rowClass}>
                      <td className="min-w-[128px] overflow-visible">
                        {v.thumbnailUrl && (
                          <a href={v.videoUrl} target="_blank" rel="noreferrer">
                            <img
                              src={v.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              className="h-16 w-28 rounded object-cover origin-left transition-transform hover:z-10 hover:scale-150"
                            />
                          </a>
                        )}
                      </td>
                      <td className="max-w-md">
                        <a
                          href={v.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-slate-800 hover:text-brand-600 line-clamp-2"
                        >
                          {v.title}
                        </a>
                      </td>
                      <td className="text-right font-semibold">{formatNumber(v.viewCount)}</td>
                      <td className="text-right">{formatNumber(Math.round(v.viewsPerDay))}</td>
                      <td className="text-right">{formatMultiplier(v.outlierMultiplier)}</td>
                      <td className="text-right">{formatEngagement(v.engagementRate)}</td>
                      <td className="text-right">{formatHeat(v.heatScore)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. 動画パフォーマンス散布（D2 の TimelineChart 再利用） */}
      <div className="card">
        <div className="card-header">動画パフォーマンス散布（公開日 × 1日平均・色=ヒートティア）</div>
        <div className="card-body">
          <Suspense fallback={<ChartLoading height={360} />}>
            <TimelineChart videos={videos} />
          </Suspense>
        </div>
      </div>

      {/* 6. 投稿の曜日×時間帯マップ（D2 の PostingHeatmap 再利用） */}
      <div className="card">
        <div className="card-header">投稿の曜日×時間帯マップ（日本時間）</div>
        <Suspense fallback={<ChartLoading height={220} />}>
          <PostingHeatmap matrix={stats.weekdayHourMatrix} />
        </Suspense>
      </div>

      {/* 7. 自分の頻出ワード/2語 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">自分の頻出ワード TOP10</div>
          <WordTable rows={stats.topWords.slice(0, 10).map((w) => ({ label: w.word, count: w.count, averageViews: w.averageViews }))} />
        </div>
        <div className="card">
          <div className="card-header">自分の2語の組み合わせ TOP10</div>
          <WordTable rows={stats.topBigrams.slice(0, 10).map((b) => ({ label: b.phrase, count: b.count, averageViews: b.averageViews }))} />
        </div>
      </div>

      {/* 8. ベンチマーク（直近のリサーチ結果があれば「自分 vs 競合」） */}
      {researchResult && researchResult.videos.length > 0 && (
        <BenchmarkCard videos={videos} researchResult={researchResult} />
      )}

      {/* 9. AIボタン */}
      <div className="card">
        <div className="card-body flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            チャンネルのデータをAI（ChatGPT等）にそのまま貼って分析させられます。
          </div>
          <MyChannelCopyButton text={buildMyChannelAiText(data, stats)} />
        </div>
      </div>
    </div>
  );
}

// チャンネルヘッダー（アイコン・名前・登録者数・総再生数・動画本数・開設日）。
function ChannelHeaderCard({
  channel,
  fetchedVideoCount
}: {
  channel: MyChannelData['channel'];
  fetchedVideoCount: number;
}) {
  return (
    <div className="card">
      <div className="card-body flex flex-wrap items-center gap-4">
        {channel.thumbnailUrl && (
          <img
            src={channel.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-16 w-16 rounded-full object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold text-slate-800">{channel.title || '（無題のチャンネル）'}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            <span>登録者 {formatNumber(channel.subscriberCount)}人</span>
            <span>総再生数 {formatNumber(channel.totalViewCount)}回</span>
            <span>動画 {formatNumber(channel.videoCount)}本</span>
            {channel.publishedAt && <span>開設 {formatPublishedFrom(channel.publishedAt)}</span>}
            <span className="text-slate-400">分析対象 {fetchedVideoCount}本</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ベンチマーク（自分 vs 競合）: 中央値1日平均・中央値エンゲージ率・投稿間隔（日）の3指標を並記。
function BenchmarkCard({
  videos,
  researchResult
}: {
  videos: Video[];
  researchResult: ResearchResult;
}) {
  const mine = computeBenchmark(videos);
  const rivals = computeBenchmark(researchResult.videos);
  return (
    <div className="card">
      <div className="card-header">ベンチマーク（自分 vs 競合「{researchResult.params.keyword}」）</div>
      <div className="card-body">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>指標</th>
                <th className="text-right">自分</th>
                <th className="text-right">競合</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>中央値の1日平均再生数</td>
                <td className="text-right font-semibold">{formatNumber(Math.round(mine.medianViewsPerDay))}</td>
                <td className="text-right">{formatNumber(Math.round(rivals.medianViewsPerDay))}</td>
              </tr>
              <tr>
                <td>中央値のエンゲージ率</td>
                <td className="text-right font-semibold">{formatEngagementValue(mine.medianEngagement)}</td>
                <td className="text-right">{formatEngagementValue(rivals.medianEngagement)}</td>
              </tr>
              <tr>
                <td>投稿間隔（日）</td>
                <td className="text-right font-semibold">{formatInterval(mine.postingIntervalDays)}</td>
                <td className="text-right">{formatInterval(rivals.postingIntervalDays)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 頻出ワード/2語の共通テーブル。
function WordTable({ rows }: { rows: Array<{ label: string; count: number; averageViews: number }> }) {
  if (rows.length === 0) {
    return <div className="card-body text-sm text-slate-500">まだデータがありません。</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th className="w-16 text-right">順位</th>
            <th>ワード</th>
            <th className="text-right">出現回数</th>
            <th className="text-right">平均再生数</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className="hover:bg-slate-50">
              <td className="text-right">{i + 1}</td>
              <td className="font-medium">{row.label}</td>
              <td className="text-right">{row.count}回</td>
              <td className="text-right">{formatNumber(Math.round(row.averageViews))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ベンチマークの3指標を計算する。中央値・投稿間隔（隣接公開日の差の中央値）。
export interface BenchmarkStats {
  medianViewsPerDay: number;
  medianEngagement: number | null;
  postingIntervalDays: number | null;
}

export function computeBenchmark(videos: Video[]): BenchmarkStats {
  const viewsPerDay = videos.map((v) => v.viewsPerDay);
  const engagements = videos
    .map((v) => v.engagementRate)
    .filter((e): e is number => e !== null);
  // 投稿間隔 = 公開日を昇順に並べ、隣り合う動画の間隔（日）の中央値。2本未満は算出不能。
  const times = videos
    .map((v) => new Date(v.publishedAt).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push((times[i] - times[i - 1]) / 86400000);
  }
  return {
    medianViewsPerDay: median(viewsPerDay),
    medianEngagement: engagements.length > 0 ? median(engagements) : null,
    postingIntervalDays: gaps.length > 0 ? median(gaps) : null
  };
}

// analyzeTitles に渡す最小の AppConfig（除外ワードは適用しない素の集計）。
function buildAnalyzeConfig(): AppConfig {
  return { apiKey: '', excludeWords: [], excludeChannelIds: [], regionCode: 'JP', language: 'ja' };
}

// グラフ遅延読み込み中の小さなフォールバック。
function ChartLoading({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
      グラフを読み込み中…
    </div>
  );
}

// ---- 表示フォーマッタ（VideoList のスタイルに合わせる） ----

function formatHeat(score: number | null) {
  if (score === null) return <span className="text-slate-400">-</span>;
  const tier = getHeatTier(score);
  const fire = tier === 'S' ? '🔥🔥🔥' : tier === 'A' ? '🔥🔥' : tier === 'B' ? '🔥' : '';
  return (
    <span className="whitespace-nowrap">
      <span className={tier ? 'font-semibold text-heat-600' : ''}>{Math.round(score)}</span>
      {fire && <span className="ml-0.5">{fire}</span>}
    </span>
  );
}

function formatMultiplier(value: number | null): string {
  return value !== null ? `${value.toFixed(2)}倍` : '-';
}

function formatEngagement(value: number | null) {
  if (value === null) return <span className="text-slate-400">-</span>;
  return <span>{(value * 100).toFixed(2)}%</span>;
}

function formatEngagementValue(value: number | null): string {
  return value !== null ? `${(value * 100).toFixed(2)}%` : '-';
}

function formatInterval(value: number | null): string {
  return value !== null ? `${value.toFixed(1)}日` : '-';
}

// 開設日を 'YYYY年M月' 形式で表示する。
function formatPublishedFrom(publishedAt: string): string {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}
