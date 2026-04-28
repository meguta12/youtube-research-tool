import { Video } from '../lib/types';
import { formatNumber, truncateText } from '../lib/utils';

interface ThumbnailGalleryProps {
  videos: Video[];
}

export function ThumbnailGallery({ videos }: ThumbnailGalleryProps) {
  if (videos.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center text-slate-500">
          リサーチを実行すると、再生数順にサムネ一覧が並びます。
        </div>
      </div>
    );
  }
  const sorted = [...videos].sort((a, b) => b.viewCount - a.viewCount);
  return (
    <div className="card">
      <div className="card-header">サムネ一覧（再生数順）</div>
      <div className="card-body">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sorted.map((v) => (
            <a
              key={v.videoId}
              href={v.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="block group"
            >
              <div className="relative overflow-hidden rounded-md bg-slate-100">
                {v.thumbnailUrl && (
                  <img
                    src={v.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="w-full aspect-video object-cover group-hover:scale-105 transition-transform"
                  />
                )}
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                  {v.duration}
                </span>
              </div>
              <div className="mt-1.5 text-xs">
                <div className="font-semibold text-slate-800">
                  {formatNumber(v.viewCount)}回
                </div>
                <div className="text-slate-600 line-clamp-2">{truncateText(v.title, 40)}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
