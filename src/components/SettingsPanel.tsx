import { useRef, useState } from 'react';
import { exportBackup, importBackup } from '../lib/storage';
import { AppConfig } from '../lib/types';
import { ApiKeySetup } from './ApiKeySetup';

interface SettingsPanelProps {
  config: AppConfig;
  onSaveApiKey: (key: string) => boolean;
  onClearApiKey: () => void;
  onSaveOptions: (options: Omit<AppConfig, 'apiKey'>) => boolean;
}

export function SettingsPanel({ config, onSaveApiKey, onClearApiKey, onSaveOptions }: SettingsPanelProps) {
  const [excludeWords, setExcludeWords] = useState(config.excludeWords.join(', '));
  const [excludeChannelIds, setExcludeChannelIds] = useState(config.excludeChannelIds.join(', '));
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  function handleSaveOptions(e: React.FormEvent) {
    e.preventDefault();
    // 地域コード・関連言語は SearchForm の地域セレクトが常に優先するため、既存値を維持したまま保存する。
    const ok = onSaveOptions({
      excludeWords: splitInput(excludeWords),
      excludeChannelIds: splitInput(excludeChannelIds),
      regionCode: config.regionCode,
      language: config.language
    });
    if (ok) {
      setSaveError(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setSaved(false);
      setSaveError(true);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">YouTube APIキー</h3>
        <ApiKeySetup
          currentKey={config.apiKey}
          onSave={onSaveApiKey}
          onClear={onClearApiKey}
        />
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">フィルタ・詳細設定</h3>
        <form onSubmit={handleSaveOptions} className="rounded-md border border-slate-200 bg-white p-4 space-y-4">
          <div>
            <label className="label">除外ワード（カンマ区切り）</label>
            <input
              className="input mt-1"
              value={excludeWords}
              onChange={(e) => setExcludeWords(e.target.value)}
              placeholder="例：公式, 切り抜き"
            />
            <p className="text-xs text-slate-500 mt-1">タイトルにこれらが含まれる動画を除外します。</p>
          </div>
          <div>
            <label className="label">除外チャンネルID（カンマ区切り）</label>
            <input
              className="input mt-1"
              value={excludeChannelIds}
              onChange={(e) => setExcludeChannelIds(e.target.value)}
              placeholder="例：UCxxxxxx, UCyyyyyy"
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary">設定を保存</button>
            {saved && <span className="text-sm text-emerald-700">✓ 保存しました</span>}
            {saveError && (
              <span className="text-sm text-rose-700">
                保存に失敗しました（ブラウザの保存容量やプライベートモードをご確認ください）
              </span>
            )}
          </div>
        </form>
      </section>

      <BackupSection />
    </div>
  );
}

function BackupSection() {
  const [includeApiKey, setIncludeApiKey] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [restoreOk, setRestoreOk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleDownload() {
    const json = exportBackup(includeApiKey);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'youtube-research-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 同じファイルを連続で選べるように、読み込み後に input をリセットする。
    e.target.value = '';
    if (!file) return;
    // 破壊的操作なので実行前に確認する。
    if (!window.confirm('現在のデータを上書きします。よろしいですか？')) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = importBackup(String(reader.result || ''));
      setRestoreOk(result.ok);
      setRestoreMessage(result.message);
    };
    reader.onerror = () => {
      setRestoreOk(false);
      setRestoreMessage('ファイルの読み込みに失敗しました。');
    };
    reader.readAsText(file);
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-700 mb-2">バックアップ</h3>
      <div className="rounded-md border border-slate-200 bg-white p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            設定・履歴・プリセットなどをJSONファイルに保存できます。別のブラウザやPCへ引き継ぐときに使えます。
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={includeApiKey}
              onChange={(e) => setIncludeApiKey(e.target.checked)}
            />
            APIキーもバックアップに含める（取り扱いにご注意ください）
          </label>
          <button type="button" className="btn-primary" onClick={handleDownload}>
            バックアップをダウンロード
          </button>
        </div>

        <div className="border-t border-slate-200 pt-4 space-y-2">
          <p className="text-xs text-slate-500">
            保存したJSONファイルから復元します。<strong className="text-rose-700">現在のデータは上書きされます。</strong>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
          />
          <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
            バックアップから復元
          </button>
          {restoreMessage && (
            <p className={`text-sm ${restoreOk ? 'text-emerald-700' : 'text-rose-700'}`}>
              {restoreMessage}
              {restoreOk && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="underline hover:text-brand-600"
                    onClick={() => window.location.reload()}
                  >
                    ページを再読み込み
                  </button>
                  してください。
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function splitInput(value: string): string[] {
  return value.split(/[,\n、]/).map((s) => s.trim()).filter(Boolean);
}
