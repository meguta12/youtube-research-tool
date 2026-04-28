import { useState } from 'react';
import { ApiKeySetup } from './ApiKeySetup';

interface OnboardingWizardProps {
  hasApiKey: boolean;
  onSaveApiKey: (key: string) => void;
  onClearApiKey: () => void;
  onComplete: () => void;
}

export function OnboardingWizard({ hasApiKey, onSaveApiKey, onClearApiKey, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 py-10">
      <div className="mx-auto max-w-2xl px-4">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 rounded-lg bg-brand-500 text-white text-2xl flex items-center justify-center">
            ▶
          </div>
          <h1 className="mt-3 text-2xl font-bold text-slate-800">YouTubeリサーチツールへようこそ</h1>
          <p className="mt-1 text-sm text-slate-600">
            ご利用にあたって、最初の設定を3つだけ進めましょう。
          </p>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <span>ステップ {step} / 3</span>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={`h-2 w-8 rounded ${n <= step ? 'bg-brand-500' : 'bg-slate-200'}`}
                />
              ))}
            </div>
          </div>
          <div className="card-body">
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">1. このツールでできること</h2>
                <ul className="list-disc pl-5 text-slate-700 space-y-1.5 text-sm">
                  <li>キーワードでYouTube動画を一括取得（最大100件）</li>
                  <li>1日平均再生数・登録者比など独自指標で並び替え</li>
                  <li>競合チャンネルの「再現性スコア」を自動算出</li>
                  <li>頻出ワード・投稿曜日・投稿時間帯の傾向分析</li>
                  <li>結果をExcel / CSVで保存できる</li>
                </ul>
                <p className="text-sm text-slate-600">
                  検索結果はあなたのブラウザだけで処理されます。サーバーには一切送られません。
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">2. YouTube APIキーを登録</h2>
                <p className="text-sm text-slate-600">
                  検索のためにGoogleが提供する「YouTube Data API v3」を使います。
                  下の手順に沿ってあなた専用のキーを取得し、登録してください。
                </p>
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2">
                  ⚠️ APIキー取得後、必ず<strong>「制限」</strong>の設定までやってください
                  （下の<strong>赤い枠の手順</strong>に従ってください）。これで万一漏洩しても他人には使えなくなります。
                </p>
                <ApiKeySetup
                  currentKey={hasApiKey ? '設定済み' : ''}
                  onSave={onSaveApiKey}
                  onClear={onClearApiKey}
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">3. 準備完了です</h2>
                <p className="text-sm text-slate-700">
                  これでリサーチを始められます。ホーム画面でキーワードを入力し、
                  「▶ リサーチ実行」を押してください。
                </p>
                <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                  <li>後からAPIキーを変更したい場合は、画面右上の「設定」から行えます。</li>
                  <li>結果は「動画リスト」「チャンネル分析」「競合分析」「サムネ一覧」のタブで確認できます。</li>
                  <li>右上の「Excelダウンロード」でいつでも保存できます。</li>
                </ul>
              </div>
            )}
          </div>
          <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              ← 戻る
            </button>
            {step < 3 ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 2 && !hasApiKey}
              >
                {step === 2 && !hasApiKey ? 'APIキーを登録してください' : '次へ →'}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={onComplete}>
                ✓ ホームへ進む
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
