import { CHANGELOG, getLatestChangelog } from '../lib/changelog';

interface UpdateBannerProps {
  onOpenChangelog: () => void;
}

export function UpdateBanner({ onOpenChangelog }: UpdateBannerProps) {
  const latest = getLatestChangelog();
  const formatted = formatDateLabel(latest.date);

  return (
    <button
      type="button"
      onClick={onOpenChangelog}
      className="w-full text-left rounded-md border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors px-4 py-2.5 flex items-center gap-3"
    >
      <span className="inline-flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-semibold w-12 h-5 shrink-0">
        🆕 NEW
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-emerald-800 font-semibold">
          {formatted} 更新
        </div>
        <div className="text-sm text-emerald-900 truncate">
          {latest.items[0]}
          {latest.items.length > 1 && (
            <span className="text-emerald-700 text-xs font-normal ml-2">
              他 {latest.items.length - 1} 件
            </span>
          )}
        </div>
      </div>
      <span className="text-xs text-emerald-700 shrink-0">
        詳細を見る →
      </span>
    </button>
  );
}

interface ChangelogModalContentProps {
  /** Use as the children of <Modal>. */
}

export function ChangelogContent(_props: ChangelogModalContentProps) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        本ツールは継続的に機能追加・改善を行っています。最新版は自動的に反映されます（再ダウンロード等は不要です）。
      </p>
      <ol className="space-y-5">
        {CHANGELOG.map((entry) => (
          <li key={entry.date} className="border-l-4 border-emerald-300 pl-4">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-slate-800 text-sm">
                {formatDateLabel(entry.date)}
              </span>
              {entry.highlight && (
                <span className="badge bg-emerald-100 text-emerald-700">
                  最新
                </span>
              )}
            </div>
            <ul className="mt-2 space-y-1">
              {entry.items.map((item, i) => (
                <li key={i} className="text-sm text-slate-700 flex gap-2">
                  <span className="text-emerald-500 shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="text-xs text-slate-500 border-t border-slate-200 pt-3">
        ご要望・改善依頼は、ご購入時のメールアドレス宛にご返信いただければ随時対応いたします。
      </p>
    </div>
  );
}

function formatDateLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[1]}年${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日`;
}
