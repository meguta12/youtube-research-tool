import { useState } from 'react';
import { testApiKey } from '../lib/youtube';
import { maskApiKey } from '../lib/utils';

interface ApiKeySetupProps {
  currentKey: string;
  onSave: (key: string) => boolean | void;
  onClear: () => void;
}

type TestState = 'idle' | 'testing' | 'ok' | 'error';

export function ApiKeySetup({ currentKey, onSave, onClear }: ApiKeySetupProps) {
  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);
  const [state, setState] = useState<TestState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleTestAndSave() {
    setState('testing');
    setErrorMsg('');
    try {
      await testApiKey(input.trim());
      const saved = onSave(input.trim());
      // 明示的に false のときだけ保存失敗（void を返す呼び出し元は成功扱い）。
      if (saved === false) {
        setState('error');
        setErrorMsg('保存に失敗しました（ブラウザの保存容量やプライベートモードをご確認ください）');
        return;
      }
      setInput('');
      setState('ok');
    } catch (err: any) {
      setState('error');
      setErrorMsg(err?.message || '接続に失敗しました。');
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
        <div className="font-semibold text-amber-900 mb-1">YouTube APIキーは「あなた専用」です</div>
        <p className="text-amber-900">
          このツールでは、YouTube公式の「YouTube Data API v3」を使ってデータを取得します。<br />
          無料で発行できますが、ご利用には<strong>あなた自身のAPIキー</strong>が必要です。
          入力されたAPIキーは<strong>このブラウザの中だけに保存</strong>され、外部サーバーには一切送信されません。
        </p>
      </div>

      <details className="rounded-md border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer font-semibold text-slate-800">
          APIキーの取り方（はじめての方はこちら）
        </summary>
        <ol className="mt-3 list-decimal pl-5 space-y-2 text-slate-700">
          <li>
            <a
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 underline"
            >
              Google Cloud Console
            </a>
            にGoogleアカウントでログインします。
          </li>
          <li>画面上の「プロジェクトを選択」→「新しいプロジェクト」で適当な名前を入れて作成します。</li>
          <li>
            左メニュー「APIとサービス」→「ライブラリ」を開き、
            <strong>「YouTube Data API v3」</strong>を検索 →「有効にする」を押します。
          </li>
          <li>
            左メニュー「APIとサービス」→「認証情報」→「+ 認証情報を作成」→
            <strong>「APIキー」</strong>を選びます。
          </li>
          <li>表示された39文字程度の文字列（AIza...で始まる）をコピーします。</li>
          <li>下の入力欄に貼り付けて「接続テストして保存」を押してください。</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          ※APIキーは無料枠で1日10,000ユニット使えます。本ツールは1回のリサーチで概ね100〜200ユニット消費します。
        </p>
      </details>

      <details className="rounded-md border-2 border-rose-300 bg-rose-50 p-4" open>
        <summary className="cursor-pointer font-semibold text-rose-900">
          ⚠️ 重要：APIキーには必ず「制限」をかけてください（漏洩対策）
        </summary>
        <div className="mt-3 space-y-3 text-sm text-rose-900">
          <p>
            このツールはお客様のブラウザだけで動くため、技術的には<strong>APIキーを「ツールの内側に隠しきる」ことができません</strong>
            （ブラウザの開発者ツールを開けば見えてしまう構造です）。
          </p>
          <p>
            そのため、Google公式の推奨どおり、<strong>キー自体に「使える条件」を制限する</strong>ことを必ず行ってください。
            これをやれば、万一キーが第三者の手に渡っても他人には使えません。
          </p>
          <div>
            <p className="font-semibold mb-1">手順（5分で完了）</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Google Cloud Console の「認証情報」
                </a>
                を開き、作成したAPIキーをクリックします。
              </li>
              <li>
                <strong>「アプリケーションの制限」</strong>で<strong>「ウェブサイト」</strong>を選択し、
                「ウェブサイトの制限事項」に下記URLを追加します：
                <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs font-mono bg-white/70 p-2 rounded">
                  <li>{typeof window !== 'undefined' ? `${window.location.origin}/*` : 'https://（このツールのURL）/*'}</li>
                </ul>
              </li>
              <li>
                <strong>「APIの制限」</strong>で<strong>「キーを制限」</strong>を選び、
                <strong>「YouTube Data API v3」</strong>だけにチェックを入れます。
              </li>
              <li>下部の「保存」を押します。反映まで数分かかることがあります。</li>
            </ol>
          </div>
          <p className="text-xs">
            これで、このキーは「このツール」かつ「YouTube検索」以外には使えなくなります。
            別のサービスや別のサイトに勝手に転用されることを防げます。
          </p>
        </div>
      </details>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-700 mb-1">📌 もし漏れてしまった場合</p>
        <p>
          Google Cloud Console の「認証情報」画面で該当キーの「︙」メニューから
          <strong>「APIキーを削除」</strong>すれば即時に無効化できます。同じ画面で新しいキーを発行し、再度このツールに登録してください。
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
        <div className="text-sm">
          現在の状態：{' '}
          {currentKey ? (
            <span className="badge bg-emerald-100 text-emerald-800">
              設定済み（{maskApiKey(currentKey)}）
            </span>
          ) : (
            <span className="badge bg-slate-100 text-slate-700">未設定</span>
          )}
        </div>

        <label className="label" htmlFor="apiKey">APIキーを入力</label>
        <div className="flex gap-2">
          <input
            id="apiKey"
            type={show ? 'text' : 'password'}
            placeholder="AIza..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="input font-mono"
            autoComplete="off"
          />
          <button type="button" className="btn-secondary" onClick={() => setShow((s) => !s)}>
            {show ? '隠す' : '表示'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={handleTestAndSave}
            disabled={!input.trim() || state === 'testing'}
          >
            {state === 'testing' ? '接続テスト中...' : '✓ 接続テストして保存'}
          </button>
          {currentKey && (
            <button type="button" className="btn-secondary" onClick={onClear}>
              保存済みキーを削除
            </button>
          )}
        </div>

        {state === 'ok' && (
          <p className="text-sm text-emerald-700">✓ 接続OK。APIキーを保存しました。</p>
        )}
        {state === 'error' && (
          <p className="text-sm text-rose-700">✕ {errorMsg}</p>
        )}
      </div>
    </div>
  );
}
