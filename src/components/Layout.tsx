import { ReactNode } from 'react';

interface LayoutProps {
  current: string;
  onNavigate: (key: string) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  children: ReactNode;
}

const NAV_ITEMS: Array<{ key: string; label: string }> = [
  { key: 'home', label: 'ホーム' },
  { key: 'videos', label: '動画リスト' },
  { key: 'channels', label: 'チャンネル分析' },
  { key: 'competitors', label: '競合分析' },
  { key: 'thumbnails', label: 'サムネ一覧' },
  { key: 'history', label: '履歴・使用量' }
];

export function Layout({ current, onNavigate, onOpenSettings, onOpenHelp, children }: LayoutProps) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-6 w-6 rounded bg-brand-500 text-center text-xs leading-6">▶</span>
            <span>YouTubeリサーチツール</span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  current === item.key ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={onOpenHelp} className="text-sm text-slate-200 hover:text-white">使い方</button>
            <button onClick={onOpenSettings} className="text-sm text-slate-200 hover:text-white">設定</button>
          </div>
        </div>
        <div className="md:hidden border-t border-slate-800">
          <div className="flex overflow-x-auto px-2 py-1 gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm ${
                  current === item.key ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 text-xs text-slate-500">
          YouTube Data API v3 を使用しています。APIキーはご利用者ご自身のブラウザのみに保存されます。
        </div>
      </footer>
    </div>
  );
}
