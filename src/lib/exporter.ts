import * as XLSX from 'xlsx';
import { ResearchResult } from './types';
import { formatNumber } from './utils';

export function downloadResultsAsExcel(result: ResearchResult, filename = 'youtube-research.xlsx'): void {
  const workbook = XLSX.utils.book_new();

  const videoRows = result.videos.map((v) => ({
    タイトル: v.title,
    チャンネル名: v.channelTitle,
    登録者数: v.subscriberCount,
    再生数: v.viewCount,
    高評価数: v.likeCount,
    コメント数: v.commentCount,
    公開日: v.publishedDate,
    経過日数: v.elapsedDays,
    '1日平均再生数': Math.round(v.viewsPerDay),
    登録者比: v.subscriberRatio !== null ? Number(v.subscriberRatio.toFixed(2)) : '',
    動画尺: v.duration,
    タグ: v.tags,
    動画URL: v.videoUrl,
    チャンネルURL: v.channelUrl,
    急上昇: v.risingFlag
  }));
  const videoSheet = XLSX.utils.json_to_sheet(videoRows);
  XLSX.utils.book_append_sheet(workbook, videoSheet, '動画リスト');

  const channelRows = result.channels.map((c) => ({
    チャンネル名: c.channelTitle,
    登録者数: c.subscriberCount,
    総動画数: c.totalVideoCount,
    開設日: c.channelPublishedDate,
    運営月数: c.operationMonths,
    ヒット数: c.hitCount,
    平均再生数: Math.round(c.averageViews),
    最高再生数: c.maxViews,
    再現性スコア: Number(c.reproducibilityScore.toFixed(4)),
    チャンネルURL: c.channelUrl,
    伸びチャンス: c.isOpportunity ? '◎' : ''
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(channelRows), 'チャンネル分析');

  const wordRows = result.competitorStats.topWords.map((w, index) => ({
    順位: index + 1,
    ワード: w.word,
    出現回数: w.count,
    平均再生数: Math.round(w.averageViews)
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(wordRows), '頻出ワード');

  const summaryRows = [
    ['キーワード', result.params.keyword],
    ['期間', result.params.period],
    ['動画尺', result.params.duration],
    ['並び替え', result.params.order],
    ['取得件数', result.videos.length],
    ['消費ユニット(目安)', `約${result.estimatedQuota}`],
    ['検索日時', new Date(result.searchedAt).toLocaleString('ja-JP')],
    ['上位再生数', formatNumber(result.videos[0]?.viewCount || 0)]
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'サマリー');

  XLSX.writeFile(workbook, filename);
}

export function downloadVideosAsCsv(result: ResearchResult, filename = 'youtube-videos.csv'): void {
  const rows = [
    ['タイトル', 'チャンネル名', '登録者数', '再生数', '高評価数', 'コメント数', '公開日', '1日平均再生数', '動画尺', '動画URL', 'チャンネルURL']
  ];
  result.videos.forEach((v) => {
    rows.push([
      v.title,
      v.channelTitle,
      String(v.subscriberCount),
      String(v.viewCount),
      String(v.likeCount),
      String(v.commentCount),
      v.publishedDate,
      String(Math.round(v.viewsPerDay)),
      v.duration,
      v.videoUrl,
      v.channelUrl
    ]);
  });
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
