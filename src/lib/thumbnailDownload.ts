import { Video } from './types';
import { formatDate, sanitizeFilename, truncateText } from './utils';

/**
 * 選択したサムネイル画像をブラウザ完結でダウンロードする。
 * サムネイル画像ホスト（i.ytimg.com / img.youtube.com）は Access-Control-Allow-Origin: * を
 * 返すため、fetch() で直接 Blob として取得できる（canvas を経由しない）。デモの data: URI も
 * fetch() でそのまま取得できる。1枚ずつの取得失敗（削除・ネット不調）は握りつぶし、残りは続行する。
 */

// サムネイル1枚のファイル名。タイトル先頭30文字を安全化し、videoId を添えて衝突を避ける。
function buildThumbnailFilename(video: Video): string {
  const base = sanitizeFilename(truncateText(video.title, 30)) || 'thumbnail';
  return `${base}_${video.videoId}.jpg`;
}

// Blob を Blob+a.click で保存する（exporter.ts / shareCard.ts と同じ流儀）。
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// サムネイルURLを fetch して Blob 化する。失敗は例外を投げ、呼び出し側の allSettled で拾う。
async function fetchThumbnailBlob(video: Video): Promise<Blob> {
  const response = await fetch(video.thumbnailUrl);
  if (!response.ok) throw new Error(`サムネイルの取得に失敗しました（HTTP ${response.status}）`);
  return response.blob();
}

// zip 内で同名になった場合に連番を付けて一意なファイル名にする。
function makeUniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const stem = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : '';
  let index = 2;
  let candidate = `${stem}_${index}${ext}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${stem}_${index}${ext}`;
  }
  used.add(candidate);
  return candidate;
}

/**
 * 選択された動画のサムネイルをダウンロードする。1件なら単体画像、複数件なら zip にまとめる。
 * 個別の取得失敗はスキップして残りを続行し、成功・失敗の件数を返す。
 */
export async function downloadThumbnails(
  videos: Video[]
): Promise<{ successCount: number; failCount: number }> {
  if (videos.length === 0) return { successCount: 0, failCount: 0 };

  // 1件だけ：そのサムネイルを直接ダウンロードする。
  if (videos.length === 1) {
    const blob = await fetchThumbnailBlob(videos[0]);
    saveBlob(blob, buildThumbnailFilename(videos[0]));
    return { successCount: 1, failCount: 0 };
  }

  // 複数件：全件を並行取得し、個別失敗は握りつぶして成功分だけ zip にまとめる。
  const results = await Promise.allSettled(videos.map((v) => fetchThumbnailBlob(v)));

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const usedNames = new Set<string>();
  let successCount = 0;
  let failCount = 0;

  results.forEach((settled, index) => {
    if (settled.status === 'fulfilled') {
      const name = makeUniqueName(buildThumbnailFilename(videos[index]), usedNames);
      zip.file(name, settled.value);
      successCount += 1;
    } else {
      failCount += 1;
    }
  });

  // 全件失敗なら zip を作らず、件数だけ返して呼び出し側にフィードバックさせる。
  if (successCount === 0) return { successCount, failCount };

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipName = `youtube-thumbnails_${successCount}枚_${formatDate(new Date()).replace(/-/g, '')}.zip`;
  saveBlob(zipBlob, zipName);

  return { successCount, failCount };
}
