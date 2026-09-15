import { useEffect, useMemo, useState } from 'react';
import {
  ChannelAgeKey,
  CHANNEL_AGE_FILTERS,
  DurationKey,
  getChannelAgeFilter,
  getKidsFilter,
  getSearchRegion,
  getSubscriberRange,
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
import { IconAlert, IconChevronDown, IconPlay, IconSearch, IconSliders } from './icons';

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
  // 詳細条件の開閉（セッション内のみ保持）。閉じている間は現在の条件を要約チップで見せる。
  const [showFilters, setShowFilters] = useState(true);

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

  // 折りたたみ時に見せる「今の条件」の要約。既定値と同じ項目も含めて主要なものだけ並べる。
  const summaryChips = useMemo(() => {
    const chips: string[] = [params.period, getSearchRegion(params.regionCode).label, params.duration, `${params.maxResults}件`];
    const category = VIDEO_CATEGORIES.find((c) => c.id === params.categoryId);
    if (category && category.id) chips.push(category.label);
    if (!params.ignoreSubscriberFilter && params.subscriberRange !== 'all') {
      chips.push(`登録者 ${getSubscriberRange(params.subscriberRange).label}`);
    }
    if (!params.ignoreChannelAgeFilter && params.channelAge !== 'all') {
      chips.push(`開設 ${getChannelAgeFilter(params.channelAge).label}`);
    }
    if (params.kidsFilter !== 'all') chips.push(getKidsFilter(params.kidsFilter).label);
    if (params.titleMustContain) chips.push('タイトル必須');
    if (params.includeLive) chips.push('ライブ含む');
    if (params.economyMode) chips.push('節約');
    if (params.broadSearch) chips.push('広く取得');
    return chips;
  }, [params]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasApiKey) {
      onMissingApiKey();
      return;
    }
    onRun(params);
  }

  return (
    <form onSubmit={handleSubmit} className="card overflow-hidden">
      {/* ヒーロー：キーワード入力と実行ボタンを最前面に置く */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-brand-700 px-5 py-6 text-white sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-wide">キーワードでリサーチ</h2>
            <p className="mt-0.5 text-xs text-slate-300">最大300件の動画を一括取得し、ヒートスコア・競合チャンネル・頻出ワードを分析します。</p>
          </div>
          {!hasApiKey && (
            <button
              type="button"
              onClick={onMissingApiKey}
              className="badge bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/50 hover:bg-amber-400/30"
            >
              <IconAlert size={13} />
              APIキー未設定 · 設定する
            </button>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="keyword" className="relative min-w-0 flex-1">
            <span className="sr-only">キーワード（必須）</span>
            <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="keyword"
              type="text"
              className="h-12 w-full rounded-xl border-0 bg-white pl-11 pr-4 text-base text-slate-800 shadow-inner placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-heat-500 disabled:opacity-70"
              placeholder="例：副業 / ダイエット / 投資 など"
              value={params.keyword}
              onChange={(e) => update('keyword', e.target.value)}
              disabled={running}
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className="btn-primary h-12 shrink-0 px-6 text-base shadow-lg shadow-slate-900/30"
            disabled={running || !params.keyword.trim()}
            title={willExceed ? '本日のクォータ残量を超える可能性があります' : ''}
          >
            {running ? (
              '実行中...'
            ) : (
              <>
                <IconPlay size={15} />
                リサーチ実行
              </>
            )}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
          <span className={willExceed ? 'font-semibold text-amber-300' : ''}>
            推定消費 <span className="font-mono font-semibold text-white">約 {formatNumber(estimatedCost)}</span> ユニット
          </span>
          <span>
            本日の残り 約 {formatNumber(remaining)} / {formatNumber(DAILY_QUOTA_LIMIT)}
          </span>
          {willExceed && (
            <span className="inline-flex items-center gap-1 text-amber-300">
              <IconAlert size={13} />
              上限を超える可能性があります
            </span>
          )}
          <span className="text-slate-400">地域などの絞り込み用に、選択件数より多めの候補を確認する場合があります。</span>
        </div>
      </div>

      {/* プリセット */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5">
        <span className="label mr-1">プリセット</span>
        <select
          className="input w-auto min-w-[12rem] flex-1 sm:flex-none"
          value={selectedPresetId}
          onChange={(e) => handleApplyPreset(e.target.value)}
          disabled={running}
        >
          <option value="">保存済みプリセットを選ぶ…</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.name}</option>
          ))}
        </select>
        <button type="button" className="btn-secondary py-1.5" onClick={handleSavePreset} disabled={running}>
          現在の条件を保存
        </button>
        <button
          type="button"
          className="btn-ghost text-rose-600 hover:bg-rose-50"
          onClick={handleDeletePreset}
          disabled={running || !selectedPresetId}
        >
          削除
        </button>
        <span className="text-[11px] text-slate-400">よく使う条件を保存して呼び出せます（同名は上書き）。</span>
      </div>

      {/* 詳細条件（折りたたみ） */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50"
        onClick={() => setShowFilters((v) => !v)}
        aria-expanded={showFilters}
        aria-controls="search-filters"
      >
        <span className="section-icon bg-slate-100 text-slate-600">
          <IconSliders size={15} />
        </span>
        <span className="text-[15px] font-semibold text-slate-800">検索条件</span>
        {!showFilters && (
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {summaryChips.map((chip) => (
              <span key={chip} className="badge bg-slate-100 text-slate-600">{chip}</span>
            ))}
          </span>
        )}
        <IconChevronDown
          size={16}
          className={`ml-auto shrink-0 text-slate-400 transition-transform ${showFilters ? 'rotate-180' : ''}`}
        />
      </button>

      {showFilters && (
        <div id="search-filters" className="border-t border-slate-100 px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="期間">
              <select
                className="input"
                value={params.period}
                onChange={(e) => update('period', e.target.value as PeriodKey)}
                disabled={running}
              >
                {PERIODS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>

            <Field
              label="検索地域"
              extra={
                <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={params.regionStrict}
                    onChange={(e) => update('regionStrict', e.target.checked)}
                    disabled={running}
                  />
                  国情報のないチャンネルを除外（厳密）
                </label>
              }
              hint={
                params.regionStrict
                  ? '※ チャンネルの国情報が対象地域と一致する動画に厳密に絞り込みます。'
                  : 'チャンネル国情報も使って対象地域に近い動画へ絞り込みます（国情報のない動画も残します）。'
              }
            >
              <select
                className="input"
                value={params.regionCode}
                onChange={(e) => update('regionCode', e.target.value as SearchRegionCode)}
                disabled={running}
              >
                {SEARCH_REGIONS.map((region) => (
                  <option key={region.code} value={region.code}>{region.label}</option>
                ))}
              </select>
            </Field>

            <Field
              label="動画タイプ"
              hint="ショート動画は4分未満、横長動画は4分以上を対象にします。横長動画は内部で2回検索するため、「4〜20分のみ」「20分以上のみ」を選ぶと検索回数が半分になり消費を節約できます。"
            >
              <select
                className="input"
                value={params.duration}
                onChange={(e) => update('duration', e.target.value as DurationKey)}
                disabled={running}
              >
                {DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </Field>

            <Field label="カテゴリ" hint="※ 日本向けの主要カテゴリで絞り込みます。「すべて」なら絞り込みません。">
              <select
                className="input"
                value={params.categoryId}
                onChange={(e) => update('categoryId', e.target.value)}
                disabled={running}
              >
                {VIDEO_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.id}>{c.label}</option>
                ))}
              </select>
            </Field>

            <Field label="並び替え">
              <select
                className="input"
                value={params.order}
                onChange={(e) => update('order', e.target.value as OrderKey)}
                disabled={running}
              >
                {ORDERS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>

            <Field label="取得件数">
              <select
                className="input"
                value={params.maxResults}
                onChange={(e) => update('maxResults', Number(e.target.value))}
                disabled={running}
              >
                {MAX_RESULT_COUNTS.map((c) => (
                  <option key={c} value={c}>{c}件</option>
                ))}
              </select>
            </Field>

            <Field
              label="登録者数で絞り込み"
              extra={
                <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={params.ignoreSubscriberFilter}
                    onChange={(e) => update('ignoreSubscriberFilter', e.target.checked)}
                    disabled={running}
                  />
                  この条件を使わない（節約）
                </label>
              }
              hint={
                params.ignoreSubscriberFilter
                  ? '※ 登録者数は検索条件として使いません。候補数の上乗せを抑えます。'
                  : '※ 検索結果の取得後に絞り込まれるため、件数が指定より少なくなる場合があります。'
              }
            >
              <select
                className="input"
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
            </Field>

            <Field
              label="チャンネル開設日"
              extra={
                <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={params.ignoreChannelAgeFilter}
                    onChange={(e) => update('ignoreChannelAgeFilter', e.target.checked)}
                    disabled={running}
                  />
                  この条件を使わない（節約）
                </label>
              }
              hint={
                params.ignoreChannelAgeFilter
                  ? '※ チャンネル開設日は検索条件として使いません。候補数の上乗せを抑えます。'
                  : '※ チャンネル詳細の取得後に絞り込まれるため、件数が指定より少なくなる場合があります。'
              }
            >
              <select
                className="input"
                value={params.channelAge}
                onChange={(e) => update('channelAge', e.target.value as ChannelAgeKey)}
                disabled={running || params.ignoreChannelAgeFilter}
              >
                {CHANNEL_AGE_FILTERS.map((range) => (
                  <option key={range.key} value={range.key}>{range.label}</option>
                ))}
              </select>
            </Field>

            <Field label="子ども向け" hint="※ 判定できないチャンネルは、子ども向け条件を選んだ場合に除外されます。">
              <select
                className="input"
                value={params.kidsFilter}
                onChange={(e) => update('kidsFilter', e.target.value as KidsFilterKey)}
                disabled={running}
              >
                {KIDS_FILTERS.map((filter) => (
                  <option key={filter.key} value={filter.key}>{filter.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <span className="label">検索オプション</span>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <OptionToggle
                label="タイトルにキーワードを含む動画のみ"
                checked={params.titleMustContain}
                onChange={(v) => update('titleMustContain', v)}
                disabled={running}
              />
              <OptionToggle
                label="ライブ配信・配信予定も含める"
                checked={params.includeLive}
                onChange={(v) => update('includeLive', v)}
                disabled={running}
              />
              <OptionToggle
                label="候補の水増しを抑えて消費を節約"
                note="結果件数は減ることがあります"
                checked={params.economyMode}
                onChange={(v) => update('economyMode', v)}
                disabled={running}
              />
              <OptionToggle
                label="関連度の高い動画も広く取得"
                note="消費が増えます"
                checked={params.broadSearch}
                onChange={(v) => update('broadSearch', v)}
                disabled={running}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              推定消費：<span className={`font-mono font-semibold ${willExceed ? 'text-rose-600' : 'text-slate-800'}`}>約 {formatNumber(estimatedCost)}</span> ユニット
              <span className="ml-3 text-slate-400">本日の残り：約 {formatNumber(remaining)} / {formatNumber(DAILY_QUOTA_LIMIT)}</span>
              {willExceed && <span className="ml-2 font-semibold text-rose-600">⚠️ 上限を超えます</span>}
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={running || !params.keyword.trim()}
              title={willExceed ? '本日のクォータ残量を超える可能性があります' : ''}
            >
              {running ? (
                '実行中...'
              ) : (
                <>
                  <IconPlay size={14} />
                  この条件でリサーチ実行
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

// ラベル＋入力＋補足の1フィールド。右肩に補助チェックボックス等を置ける。
function Field({
  label,
  extra,
  hint,
  children
}: {
  label: string;
  extra?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex min-h-[1.25rem] flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <span className="label">{label}</span>
        {extra}
      </div>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{hint}</p>}
    </div>
  );
}

// チェックボックス1つをカード風に見せる（押せる範囲を広く、状態を色で示す）。
function OptionToggle({
  label,
  note,
  checked,
  onChange,
  disabled
}: {
  label: string;
  note?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
        checked ? 'border-brand-200 bg-brand-50/60 text-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>
        <span className="block leading-snug">{label}</span>
        {note && <span className="mt-0.5 block text-[11px] text-slate-400">{note}</span>}
      </span>
    </label>
  );
}
