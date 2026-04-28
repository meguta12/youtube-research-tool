import { useState } from 'react';
import { validateLicense } from '../lib/license';

interface LicenseGateProps {
  onUnlock: (licenseKey: string) => void;
}

export function LicenseGate({ onUnlock }: LicenseGateProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validateLicense(input)) {
      onUnlock(input.trim());
    } else {
      setError('ライセンスキーが正しくありません。購入時に届いたメールをご確認ください。');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 rounded-lg bg-brand-500 text-white text-2xl flex items-center justify-center">
            ▶
          </div>
          <h1 className="mt-3 text-xl font-bold text-slate-800">ライセンスキーを入力</h1>
          <p className="mt-1 text-sm text-slate-600">
            購入時にお送りしたメールに記載されている、英数字のキーを入力してください。
          </p>
        </div>
        <form onSubmit={handleSubmit} className="card">
          <div className="card-body space-y-3">
            <label className="label" htmlFor="license">ライセンスキー</label>
            <input
              id="license"
              type="text"
              autoComplete="off"
              className="input font-mono uppercase tracking-wider"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError('');
              }}
            />
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={!input.trim()}>
              認証する
            </button>
            <p className="text-xs text-slate-500">
              キーが見つからない場合は、購入時のメールの差出人にお問い合わせください。
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
