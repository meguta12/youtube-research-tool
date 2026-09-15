import { ReactNode } from 'react';
import { DAILY_QUOTA_LIMIT } from '../lib/storage';
import { formatNumber } from '../lib/utils';
import {
  IconBookmark,
  IconChart,
  IconClock,
  IconHelp,
  IconHome,
  IconImage,
  IconList,
  IconPlay,
  IconSettings,
  IconUser,
  IconUsers
} from './icons';

interface LayoutProps {
  current: string;
  onNavigate: (key: string) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  // ヘッダー右上の常時表示（本日の推定使用量・ストック件数）。
  quotaUsed: number;
  stockCount: number;
  children: ReactNode;
}

const NAV_ITEMS: Array<{ key: string; label: string; icon: (props: { size?: number }) => JSX.Element }> = [
  { key: 'home', label: 'ホーム', icon: IconHome },
  { key: 'videos', label: '動画リスト', icon: IconList },
  { key: 'channels', label: 'チャンネル分析', icon: IconUsers },
  { key: 'competitors', label: '競合分析', icon: IconChart },
  { key: 'thumbnails', label: 'サムネ一覧', icon: IconImage },
  { key: 'stocks', label: 'ストック', icon: IconBookmark },
  { key: 'mychannel', label: 'マイチャンネル', icon: IconUser },
  { key: 'history', label: '履歴・使用量', icon: IconClock }
];

export function Layout({ current, onNavigate, onOpenSettings, onOpenHelp, quotaUsed, stockCount, children }: LayoutProps) {
  const quotaPct = Math.min(100, (quotaUsed / DAILY_QUOTA_LIMIT) * 100);
  const quotaTone = quotaPct >= 90 ? 'bg-rose-400' : quotaPct >= 70 ? 'bg-amber-400' : 'bg-emerald-400';

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-lg shadow-slate-900/10">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-2.5">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex shrink-0 items-center gap-2.5 rounded-lg py-1 pr-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            title="ホームへ"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-heat-500 shadow-md shadow-brand-500/30">
              <IconPlay size={16} />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-wide">YouTubeリサーチツール</span>
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 sm:block">Keyword Research</span>
            </span>
          </button>

          <nav className="nav-scroll -mx-1 hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1 xl:flex" aria-label="主要ナビゲーション">
            {NAV_ITEMS.map((item) => (
              <NavButton key={item.key} item={item} active={current === item.key} onClick={() => onNavigate(item.key)} stockCount={stockCount} />
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="hidden items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-white/10 md:flex xl:hidden min-[1400px]:flex"
              title="本日のAPI使用量（推定）。クリックで履歴・使用量へ"
            >
              <span className="hidden text-[10px] leading-none text-slate-400 min-[1600px]:inline">本日の使用量</span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-white/15">
                  <span className={`block h-full rounded-full ${quotaTone}`} style={{ width: `${quotaPct}%` }} />
                </span>
                <span className="text-xs tabular-nums text-slate-200">
                  {formatNumber(quotaUsed)}
                  <span className="text-slate-500"> / {formatNumber(DAILY_QUOTA_LIMIT)}</span>
                </span>
              </span>
            </button>
            <button type="button" onClick={onOpenHelp} className="header-action" title="使い方">
              <IconHelp size={17} />
              <span className="hidden 2xl:inline">使い方</span>
            </button>
            <button type="button" onClick={onOpenSettings} className="header-action" title="設定">
              <IconSettings size={17} />
              <span className="hidden 2xl:inline">設定</span>
            </button>
          </div>
        </div>
        {/* xl 未満は2段目の横スクロールタブ列に切り替える（ラベルは折り返さない） */}
        <div className="border-t border-white/10 xl:hidden">
          <nav className="nav-scroll mx-auto flex max-w-[1600px] items-center gap-0.5 overflow-x-auto px-2 py-1.5" aria-label="主要ナビゲーション">
            {NAV_ITEMS.map((item) => (
              <NavButton key={item.key} item={item} active={current === item.key} onClick={() => onNavigate(item.key)} stockCount={stockCount} />
            ))}
          </nav>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-brand-500 via-brand-500 to-heat-500" />
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-[1600px] px-4 py-6">{children}</div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>YouTube Data API v3 を使用しています。APIキーはご利用者ご自身のブラウザのみに保存されます。</span>
          <span className="flex items-center gap-3 whitespace-nowrap">
            <span className="text-slate-400">制作者：めぐペン</span>
            <a href="https://x.com/K1sqttPHfC41982" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-brand-600">
              X
            </a>
            <a href="https://note.com/shiny_ruff980/" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-brand-600">
              note
            </a>
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">関連ページ：</span>
            <a href="https://kanpake.app/" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-brand-600">
              カンパケ
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
  stockCount
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  onClick: () => void;
  stockCount: number;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon size={15} />
      <span>{item.label}</span>
      {item.key === 'stocks' && stockCount > 0 && (
        <span
          className={`ml-0.5 rounded-full px-1.5 text-[10px] font-semibold tabular-nums leading-4 ${
            active ? 'bg-brand-500 text-white' : 'bg-white/15 text-slate-100'
          }`}
        >
          {stockCount > 999 ? '999+' : stockCount}
        </span>
      )}
    </button>
  );
}
