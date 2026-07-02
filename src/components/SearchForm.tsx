import { useEffect, useMemo, useState } from 'react';
import {
  ChannelAgeKey,
  CHANNEL_AGE_FILTERS,
  DurationKey,
  KidsFilterKey,
  KIDS_FILTERS,
  MAX_RESULT_COUNTS,
  OrderKey,
  PeriodKey,
  SEARCH_REGIONS,
  SearchParams,
  SearchRegionCode,
  SUBSCRIBER_RANGES,
  SubscriberRangeKey,
  VIDEO_CATEGORIES
} from '../lib/types';
import { estimateQuotaBeforeRun } from '../lib/youtube';
import {
  DAILY_QUOTA_LIMIT,
  deletePreset,
  getPresets,
  savePreset,
  SearchPreset
} from '../lib/storage';
import { formatNumber } from '../lib/utils';

interface SearchFormProps {
  initial: SearchParams;
  onRun: (params: SearchParams) => void;
  running: boolean;
  hasApiKey: boolean;
  quotaUsed: number;
  onMissingApiKey: () => void;
  onApplyParams: (params: SearchParams) => void;
}

const PERIODS: PeriodKey[] = ['今日', '今週', '今月', '3ヶ月', '全期間'];
// 単一バケット（4-20分のみ / 20分以上のみ）は検索回数が半分で済むため節約になる。
const DURATIONS: Array<{ value: DurationKey; label: string }> = [
  { value: 'ショート動画', label: 'ショート動画' },
  { value: '横長動画', label: '横長動画' },
  { value: '4-20分', label: '4〜20分のみ' },
  { value: '20分以上', label: '20分以上のみ' }
];
const ORDERS: OrderKey[] = ['視聴回数', '関連度', '新着', '評価'];

export function SearchForm({
  initial,
  onRun,
  running,
  hasApiKey,
  quotaUsed,
  onMissingApiKey,
  onApplyParams
}: SearchFormProps) {
  const [params, setParams] = useState<SearchParams>(initial);
  const [presets, setPresets] = useState<SearchPreset[]>(() => getPresets());
  const [selectedPresetId, setSelectedPresetId] = useState('');

  useEffect(() => setParams(initial), [initial]);

  const estimatedCost = useMemo(
    () => estimateQuotaBeforeRun(params),
    [params]
  );
  const remaining = Math.max(0, DAILY_QUOTA_LIMIT - quotaUsed);
  const willExceed = estimatedCost > remaining;

  function update<K extends keyof SearchParams>(key: K, value: SearchParams[K]) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  function handleApplyPreset(id: string) {
    setSelectedPresetId(id);
    if (!id) return;
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    // 保存済みのパラメータで現在の検索条件を丸ごと差し替える。
    setParams(preset.params);
    onApplyParams(preset.params); // App 側の params state も更新する。
  }

  function handleSavePreset() {
    const name = window.prompt('プリセット名を入力してください（同名は上書きされます）');
    if (name === null) return; // キャンセル
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = savePreset(trimmed, params);
    setPresets(next);
    const saved = next.find((p) => p.name === trimmed);
    if (saved) setSelectedPresetId(saved.id);
  }

  function handleDeletePreset() {
    if (!selectedPresetId) return;
    const target = presets.find((p) => p.id === selectedPresetId);
    if (target && !window.confirm(`プリセット「${target.name}」を削除しますか？`)) return;
    const next = deletePreset(selectedPresetId);
    setPresets(next);
    setSelectedPresetId('');
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
        <div className="md:col-span-2">
          <label className="label">プリセット</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <select
              className="input flex-1 min-w-[10rem]"
              value={selectedPresetId}
              onChange={(e) => handleApplyPreset(e.target.value)}
              disabled={running}
            >
              <option value="">保存済みプリセットを選ぶ…</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
              ))}
            </select>
            <button type="button" className="btn-secondary" onClick={handleSavePreset} disabled={running}>
              現在の条件を保存
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDeletePreset}
              disabled={running || !selectedPresetId}
            >
              削除
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            よく使う検索条件を保存して呼び出せます。選ぶと現在の条件に反映されます（同名は上書き）。
          </p>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="label">検索地域</label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={params.regionStrict}
                onChange={(e) => update('regionStrict', e.target.checked)}
                disabled={running}
              />
              国情報のないチャンネルを除外（厳密）
            </label>
          </div>
          <select
            className="input mt-1"
            value={params.regionCode}
            onChange={(e) => update('regionCode', e.target.value as SearchRegionCode)}
            disabled={running}
          >
            {SEARCH_REGIONS.map((region) => (
              <option key={region.code} value={region.code}>{region.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {params.regionStrict
              ? '※ チャンネルの国情報が対象地域と一致する動画に厳密に絞り込みます。'
              : 'チャンネル国情報も使って対象地域に近い動画へ絞り込みます（国情報のない動画も残します）。'}
          </p>
        </div>
        <div>
          <label className="label">動画タイプ</label>
          <select
            className="input mt-1"
            value={params.duration}
            onChange={(e) => update('duration', e.target.value as DurationKey)}
            disabled={running}
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            ショート動画は4分未満、横長動画は4分以上を対象にします。横長動画は内部で2回検索するため、「4〜20分のみ」「20分以上のみ」を選ぶと検索回数が半分になり消費を節約できます。
          </p>
        </div>
        <div>
          <label className="label">カテゴリ</label>
          <select
            className="input mt-1"
            value={params.categoryId}
            onChange={(e) => update('categoryId', e.target.value)}
            disabled={running}
          >
            {VIDEO_CATEGORIES.map((c) => (
              <option key={c.key} value={c.id}>{c.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            ※ 日本向けの主要カテゴリで絞り込みます。「すべて」なら絞り込みません。
          </p>
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
            {MAX_RESULT_COUNTS.map((c) => (
              <option key={c} value={c}>{c}件</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="label">登録者数で絞り込み</label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={params.ignoreSubscriberFilter}
                onChange={(e) => update('ignoreSubscriberFilter', e.target.checked)}
                disabled={running}
              />
              この条件を使わない（節約）
            </label>
          </div>
          <select
            className={`input mt-1 ${params.ignoreSubscriberFilter ? 'bg-slate-100 text-slate-400' : ''}`}
            value={params.subscriberRange}
            onChange={(e) => update('subscriberRange', e.target.value as SubscriberRangeKey)}
            disabled={running || params.ignoreSubscriberFilter}
          >
            {/* "全て" は最上位 */}
            <option value="all">全て（絞り込みなし）</option>
            <optgroup label="細かく絞る">
              {SUBSCRIBER_RANGES.filter((r) => r.group === '細かく絞る').map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </optgroup>
            <optgroup label="広めに絞る">
              {SUBSCRIBER_RANGES.filter((r) => r.group === '広めに絞る').map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </optgroup>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {params.ignoreSubscriberFilter
              ? '※ 登録者数は検索条件として使いません。候補数の上乗せを抑えます。'
              : '※ 検索結果の取得後に絞り込まれるため、件数が指定より少なくなる場合があります。'}
          </p>
        </div>
        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="label">チャンネル開設日</label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={params.ignoreChannelAgeFilter}
                onChange={(e) => update('ignoreChannelAgeFilter', e.target.checked)}
                disabled={running}
              />
              この条件を使わない（節約）
            </label>
          </div>
          <select
            className={`input mt-1 ${params.ignoreChannelAgeFilter ? 'bg-slate-100 text-slate-400' : ''}`}
            value={params.channelAge}
            onChange={(e) => update('channelAge', e.target.value as ChannelAgeKey)}
            disabled={running || params.ignoreChannelAgeFilter}
          >
            {CHANNEL_AGE_FILTERS.map((range) => (
              <option key={range.key} value={range.key}>{range.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {params.ignoreChannelAgeFilter
              ? '※ チャンネル開設日は検索条件として使いません。候補数の上乗せを抑えます。'
              : '※ チャンネル詳細の取得後に絞り込まれるため、件数が指定より少なくなる場合があります。'}
          </p>
        </div>
        <div className="md:col-span-2">
          <label className="label">子ども向け</label>
          <select
            className="input mt-1"
            value={params.kidsFilter}
            onChange={(e) => update('kidsFilter', e.target.value as KidsFilterKey)}
            disabled={running}
          >
            {KIDS_FILTERS.map((filter) => (
              <option key={filter.key} value={filter.key}>{filter.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            ※ 判定できないチャンネルは、子ども向け条件を選んだ場合に除外されます。
          </p>
        </div>
        <div className="md:col-span-2">
          <label className="label">検索オプション</label>
          <div className="mt-1 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={params.titleMustContain}
                onChange={(e) => update('titleMustContain', e.target.checked)}
                disabled={running}
              />
              タイトルにキーワードを含む動画のみ
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={params.includeLive}
                onChange={(e) => update('includeLive', e.target.checked)}
                disabled={running}
              />
              ライブ配信・配信予定も含める
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={params.economyMode}
                onChange={(e) => update('economyMode', e.target.checked)}
                disabled={running}
              />
              候補の水増しを抑えて消費を節約（結果件数は減ることがあります）
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={params.broadSearch}
                onChange={(e) => update('broadSearch', e.target.checked)}
                disabled={running}
              />
              関連度の高い動画も広く取得（消費が増えます）
            </label>
          </div>
        </div>
        <div className="md:col-span-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
          <div className="text-xs sm:text-right">
            <div className={willExceed ? 'text-rose-700 font-semibold' : 'text-slate-600'}>
              推定消費：<span className="font-mono font-semibold">約 {formatNumber(estimatedCost)}</span> ユニット
            </div>
            <div className="text-slate-400 mt-0.5">
              本日の残り：約 {formatNumber(remaining)} / {formatNumber(DAILY_QUOTA_LIMIT)}
              {willExceed && <span className="text-rose-700"> ⚠️ 上限を超えます</span>}
            </div>
            <div className="text-slate-400 mt-0.5">
              地域などの絞り込み用に、選択件数より多めの候補を確認する場合があります。
            </div>
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={running || !params.keyword.trim()}
            title={willExceed ? '本日のクォータ残量を超える可能性があります' : ''}
          >
            {running ? '実行中...' : '▶ リサーチ実行'}
          </button>
        </div>
      </div>
    </form>
  );
}
