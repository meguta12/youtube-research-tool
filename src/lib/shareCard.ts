import { normalizeKeyword, ResearchResult, Video } from './types';

/**
 * X（Twitter）投稿用の「SNSシェア画像カード」を生成する。
 * サムネイル画像ホスト（i.ytimg.com 等）は Access-Control-Allow-Origin: * を返すため、
 * crossOrigin="anonymous" で読み込めば canvas は汚染されず toBlob() が使える。
 * ただし個別の読み込み失敗（画像削除・ネット不調）はあり得るので、1枚ずつ握りつぶして
 * 単色プレースホルダにフォールバックし、カード全体は失敗させない。
 */

// カードの論理サイズ（CSS表示サイズ）。実ピクセルは devicePixelRatio 分だけ拡大する。
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 675;

// 全テキスト共通の日本語フォント指定。
const FONT_FAMILY = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", sans-serif';

// tailwind の brand/heat と揃えた配色。
const BRAND_600 = '#155ec0';
const HEAT_500 = '#f97316';
const HEAT_600 = '#ea580c';

// 上位カードに使う順位バッジの丸数字。
const RANK_BADGES = ['①', '②', '③'];

/**
 * heatScore が付いている動画をスコア降順で最大3件返す（VideoList のヒーローと同方針）。
 */
function pickTopVideos(result: ResearchResult): Video[] {
  return [...result.videos]
    .filter((v) => v.heatScore !== null)
    .sort((a, b) => (b.heatScore ?? -1) - (a.heatScore ?? -1))
    .slice(0, 3);
}

/**
 * 角丸矩形のパスを描く。native な ctx.roundRect に依存しないよう手書きする（互換性のため）。
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  // 半径が幅・高さの半分を超えないように丸める。
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * 1行に収まるよう末尾を "…" で省略する。ctx.measureText で幅を測りながら1文字ずつ削る素朴な実装。
 */
function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  let result = text;
  while (result.length > 0 && ctx.measureText(result + ellipsis).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return result + ellipsis;
}

/**
 * 文字列を最大 maxLines 行に折り返す。各行は maxWidth に収め、最終行は "…" で省略する。
 * 日本語は単語区切りが無いため1文字ずつ積む素朴な方式にする。
 */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const char of Array.from(text)) {
    const candidate = current + char;
    if (ctx.measureText(candidate).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = char;
      if (lines.length === maxLines - 1) break;
    } else {
      current = candidate;
    }
  }
  // 残り（未処理の文字を含む）を最終行にする。あふれる分は省略。
  const consumed = lines.join('').length;
  const rest = Array.from(text).slice(consumed).join('');
  if (lines.length < maxLines) {
    lines.push(lines.length === maxLines - 1 ? truncateToWidth(ctx, rest, maxWidth) : current);
  }
  return lines.slice(0, maxLines);
}

/**
 * crossOrigin="anonymous" で画像を読み込む。失敗（削除・CORS・ネット不調）は reject にせず
 * null を解決して呼び出し側でフォールバックさせる。data: URI（デモのSVG）もそのまま読める。
 */
function loadImageSafe(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    // onerror が発火しない壊れ方（404 のクロスオリジン画像など）もあるため、
    // 読み込めても実寸が 0 のものは失敗扱いにしてフォールバックへ回す。
    img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * サムネイル領域を描く。画像があれば cover 配置、無ければブランドカラーの単色矩形＋タイトル頭文字。
 */
function drawThumbnail(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  video: Video,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.clip();
  if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
    // アスペクト比を保って中央 cover（object-cover 相当）。
    const scale = Math.max(w / img.width, h / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    ctx.drawImage(img, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
  } else {
    // フォールバック：単色矩形＋タイトル頭文字。
    ctx.fillStyle = BRAND_600;
    ctx.fillRect(x, y, w, h);
    const initial = Array.from(video.title.trim())[0] || '?';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(h * 0.42)}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, x + w / 2, y + h / 2);
  }
  ctx.restore();
}

/**
 * 統計バー（分析動画数・最高ヒートスコア・生成日）を下部に描く。半透明の黒帯の上に白文字。
 */
function drawStatsBar(ctx: CanvasRenderingContext2D, result: ResearchResult): void {
  const barHeight = 56;
  const barY = CARD_HEIGHT - barHeight;
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(0, barY, CARD_WIDTH, barHeight);

  const scores = result.videos
    .map((v) => v.heatScore)
    .filter((s): s is number => s !== null);
  const maxHeat = scores.length > 0 ? Math.round(Math.max(...scores)) : '-';
  const generatedAt = formatGeneratedDate(new Date(result.searchedAt));
  const text = `分析動画数: ${result.videos.length}本 ／ 最高ヒートスコア: ${maxHeat} ／ 生成日: ${generatedAt}`;

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `500 20px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 40, barY + barHeight / 2);

  // 右下のクレジット（既存フッターと表記を合わせる）。
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `400 16px ${FONT_FAMILY}`;
  ctx.textAlign = 'right';
  ctx.fillText('制作者：めぐペン', CARD_WIDTH - 40, barY + barHeight / 2);
}

// 生成日は searchedAt が不正でも落ちないよう、無効なら現在時刻にフォールバックする。
function formatGeneratedDate(date: Date): string {
  const d = Number.isNaN(date.getTime()) ? new Date() : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

/**
 * 上位動画カード1枚を描く（サムネ・順位バッジ・タイトル2行・ヒート・サブ指標）。
 */
function drawVideoCard(
  ctx: CanvasRenderingContext2D,
  video: Video,
  img: HTMLImageElement | null,
  rank: number,
  x: number,
  y: number,
  w: number
): void {
  // カード土台（白・角丸）。
  const cardRadius = 16;
  const thumbHeight = Math.round((w * 9) / 16);
  const padding = 16;
  const cardHeight = thumbHeight + 128;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, x, y, w, cardHeight, cardRadius);
  ctx.fill();
  ctx.restore();

  // サムネ（上部・角丸は上側に合わせるが簡便に全体角丸で描く）。
  drawThumbnail(ctx, img, video, x + padding, y + padding, w - padding * 2, thumbHeight, 10);

  // 順位バッジ（サムネ左上に重ねる）。
  const badge = RANK_BADGES[rank - 1] || String(rank);
  ctx.fillStyle = HEAT_500;
  const badgeR = 20;
  const badgeCx = x + padding + badgeR + 6;
  const badgeCy = y + padding + badgeR + 6;
  ctx.beginPath();
  ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 26px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, badgeCx, badgeCy + 1);

  // タイトル（2行まで、はみ出しは "…"）。
  const textX = x + padding;
  const textW = w - padding * 2;
  let textY = y + padding + thumbHeight + 30;
  ctx.fillStyle = '#1e293b';
  ctx.font = `600 22px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const titleLines = wrapLines(ctx, video.title, textW, 2);
  titleLines.forEach((line) => {
    ctx.fillText(line, textX, textY);
    textY += 28;
  });

  // ヒートスコア数値＋🔥。
  const heat = Math.round(video.heatScore ?? 0);
  ctx.fillStyle = HEAT_600;
  ctx.font = `bold 24px ${FONT_FAMILY}`;
  const heatText = `ヒート${heat} 🔥`;
  ctx.fillText(heatText, textX, y + cardHeight - 20);

  // サブ指標1つ（登録者比 or 倍率、あれば）。ヒートの右側に控えめに置く。
  const sub = buildSubMetric(video);
  if (sub) {
    ctx.fillStyle = '#64748b';
    ctx.font = `500 18px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.fillText(sub, x + w - padding, y + cardHeight - 20);
    ctx.textAlign = 'left';
  }
}

// サブ指標：登録者比を優先し、無ければアウトライアー倍率。どちらも無ければ空文字。
function buildSubMetric(video: Video): string {
  if (video.subscriberRatio !== null) return `登録者比 ×${video.subscriberRatio.toFixed(1)}`;
  if (video.outlierMultiplier !== null) return `倍率 ×${video.outlierMultiplier.toFixed(1)}`;
  return '';
}

/**
 * データ不足時（動画0件 or heatScore 全 null）の代替レイアウト。
 * キーワードと統計バーだけのシンプル版にして、クラッシュさせない。
 */
function drawEmptyState(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `600 30px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('まだ十分なデータがありません', CARD_WIDTH / 2, CARD_HEIGHT / 2);
}

/**
 * ヘッダー（キーワード見出し・ツール名）を描く。
 */
function drawHeader(ctx: CanvasRenderingContext2D, result: ResearchResult): void {
  const keyword = normalizeKeyword(result.params.keyword);
  // 左上：キーワード見出し。長い場合は1行省略。
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 30px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const heading = `"${keyword}" のリサーチ結果`;
  ctx.fillText(truncateToWidth(ctx, heading, CARD_WIDTH - 340), 40, 56);

  // 右上：ツール名。
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `500 18px ${FONT_FAMILY}`;
  ctx.textAlign = 'right';
  ctx.fillText('YouTubeリサーチツール', CARD_WIDTH - 40, 52);
}

/**
 * 検索結果からシェアカードを canvas に描画する。
 * canvas の実ピクセルは devicePixelRatio 分だけ拡大し、CSS 表示サイズは 1200×675 に固定する。
 */
export async function renderShareCard(canvas: HTMLCanvasElement, result: ResearchResult): Promise<void> {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = CARD_WIDTH * dpr;
  canvas.height = CARD_HEIGHT * dpr;
  canvas.style.width = `${CARD_WIDTH}px`;
  canvas.style.height = `${CARD_HEIGHT}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas の描画コンテキストを取得できませんでした');
  ctx.scale(dpr, dpr);

  // 背景：brand.600 → heat.600 の斜めグラデーション。
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, BRAND_600);
  gradient.addColorStop(1, HEAT_600);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  drawHeader(ctx, result);

  const topVideos = pickTopVideos(result);

  if (topVideos.length === 0) {
    // データ不足：代替レイアウト（キーワード＋統計バーのみ）。
    drawEmptyState(ctx);
    drawStatsBar(ctx, result);
    return;
  }

  // 上位動画のサムネを並行読み込み。個別失敗は null に落として握りつぶす。
  const images = await Promise.allSettled(topVideos.map((v) => loadImageSafe(v.thumbnailUrl)));

  // カードを横並び配置。件数（1〜3）に応じて等幅に割る。
  const count = topVideos.length;
  const outerMargin = 40;
  const gap = 24;
  const areaWidth = CARD_WIDTH - outerMargin * 2;
  const cardWidth = (areaWidth - gap * (count - 1)) / count;
  const cardsY = 92;

  topVideos.forEach((video, index) => {
    const settled = images[index];
    const img = settled.status === 'fulfilled' ? settled.value : null;
    const x = outerMargin + index * (cardWidth + gap);
    drawVideoCard(ctx, video, img, index + 1, x, cardsY, cardWidth);
  });

  drawStatsBar(ctx, result);
}

/**
 * X 投稿文の下書き（プレーンテキスト）を返す。誇大表現は入れない。
 * 動画が少ない場合はランキング行を省略する。
 */
export function buildShareCaption(result: ResearchResult): string {
  const keyword = normalizeKeyword(result.params.keyword);
  const topVideos = pickTopVideos(result);
  const lines: string[] = [];

  lines.push(`"${keyword}" をYouTubeリサーチツールで分析しました🔥`);
  lines.push('');

  if (topVideos.length > 0) {
    lines.push('今アツい動画TOP3');
    topVideos.forEach((v, index) => {
      const badge = RANK_BADGES[index] || `${index + 1}.`;
      const heat = Math.round(v.heatScore ?? 0);
      lines.push(`${badge} ${v.title}（ヒート${heat}）`);
    });
    lines.push('');
  }

  lines.push(`#YouTube分析 #${toHashtag(keyword)}`);

  return lines.join('\n');
}

// キーワードをハッシュタグ化する。空白と記号を除去して連結（# は付けない）。
function toHashtag(keyword: string): string {
  return keyword.replace(/[\s#　]+/g, '');
}

// ファイル名に使えない文字を除去する（CSV/xlsx と同じくブラウザ完結でダウンロードするため）。
function sanitizeFilename(value: string): string {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

/**
 * カードを PNG として保存する。canvas.toBlob → Blob+a.click（exporter.ts と同じ流儀）。
 * ファイル名の既定は youtube-research-share-${keyword}.png（使えない文字は除去）。
 */
export async function downloadShareCard(result: ResearchResult, filename?: string): Promise<void> {
  const canvas = document.createElement('canvas');
  await renderShareCard(canvas, result);

  const safeKeyword = sanitizeFilename(normalizeKeyword(result.params.keyword)) || 'result';
  const name = filename || `youtube-research-share-${safeKeyword}.png`;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
  if (!blob) throw new Error('画像の生成に失敗しました');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
