import { useState } from 'react';
import { AppConfig } from '../lib/types';
import { ApiKeySetup } from './ApiKeySetup';

interface SettingsPanelProps {
  config: AppConfig;
  onSaveApiKey: (key: string) => void;
  onClearApiKey: () => void;
  onSaveOptions: (options: Omit<AppConfig, 'apiKey'>) => void;
}

export function SettingsPanel({ config, onSaveApiKey, onClearApiKey, onSaveOptions }: SettingsPanelProps) {
  const [excludeWords, setExcludeWords] = useState(config.excludeWords.join(', '));
  const [excludeChannelIds, setExcludeChannelIds] = useState(config.excludeChannelIds.join(', '));
  const [regionCode, setRegionCode] = useState(config.regionCode);
  const [language, setLanguage] = useState(config.language);
  const [saved, setSaved] = useState(false);

  function handleSaveOptions(e: React.FormEvent) {
    e.preventDefault();
    onSaveOptions({
      excludeWords: splitInput(excludeWords),
      excludeChannelIds: splitInput(excludeChannelIds),
      regionCode: regionCode.trim() || 'JP',
      language: language.trim() || 'ja'
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">既定の地域コード</label>
              <input
                className="input mt-1"
                value={regionCode}
                onChange={(e) => setRegionCode(e.target.value)}
                placeholder="JP"
              />
            </div>
            <div>
              <label className="label">既定の関連言語</label>
              <input
                className="input mt-1"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="ja"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary">設定を保存</button>
            {saved && <span className="text-sm text-emerald-700">✓ 保存しました</span>}
          </div>
        </form>
      </section>
    </div>
  );
}

function splitInput(value: string): string[] {
  return value.split(/[,\n、]/).map((s) => s.trim()).filter(Boolean);
}
