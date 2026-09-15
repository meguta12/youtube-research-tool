import { IconBookmark } from './icons';

interface StockButtonProps {
  stocked: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
  // サムネの上など暗い背景に重ねるときは 'overlay'。
  variant?: 'default' | 'overlay';
  className?: string;
}

/**
 * ストック（しおり）のトグルボタン。
 * リンク（<a>）の内側に置かれることがあるため、クリックのバブリングと既定動作を止める。
 */
export function StockButton({ stocked, onToggle, size = 'md', variant = 'default', className = '' }: StockButtonProps) {
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 15 : 17;
  const tone =
    variant === 'overlay'
      ? stocked
        ? 'bg-brand-500 text-white shadow-md'
        : 'bg-black/55 text-white backdrop-blur-sm hover:bg-black/75'
      : stocked
        ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200 hover:bg-brand-100'
        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700';
  const label = stocked ? 'ストックから外す' : 'ストックに保存';
  return (
    <button
      type="button"
      aria-pressed={stocked}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg transition-all active:scale-90 ${dim} ${tone} ${className}`}
    >
      <IconBookmark size={iconSize} filled={stocked} />
    </button>
  );
}
