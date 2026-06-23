import * as XLSX from 'xlsx';
import {
  getChannelAgeFilter,
  getKidsFilter,
  getSearchRegion,
  getSubscriberRange,
  isChannelAgeFilterActive,
  isSubscriberFilterActive,
  ResearchResult
} from './types';
import { formatNumber } from './utils';

export function downloadResultsAsExcel(result: ResearchResult, filename = 'youtube-research.xlsx'): void {
  const workbook = XLSX.utils.book_new();

  const videoRows = result.videos.map((v) => ({
    タイトル: v.title,
    チャンネル名: v.channelTitle,
    チャンネル国: v.channelCountry || '',
    子ども向け: formatMadeForKids(v.channelMadeForKids),
    登録者数: v.subscriberCount,
    再生数: v.viewCount,
    高評価数: v.likeCount,
    コメント数: v.commentCount,
    'エンゲージメント率(%)': v.engagementRate !== null ? Number((v.engagementRate * 100).toFixed(2)) : '',
    公開日: v.publishedDate,
    経過日数: v.elapsedDays,
    '1日平均再生数': Math.round(v.viewsPerDay),
    登録者比: v.subscriberRatio !== null ? Number(v.subscriberRatio.toFixed(2)) : '',
    アウトライアー倍率: v.outlierMultiplier !== null ? Number(v.outlierMultiplier.toFixed(2)) : '',
    動画尺: v.duration,
    動画URL: v.videoUrl,
    チャンネルURL: v.channelUrl,
    急上昇: v.risingFlag
  }));
  const videoSheet = XLSX.utils.json_to_sheet(videoRows);
  XLSX.utils.book_append_sheet(workbook, videoSheet, '動画リスト');

  const channelRows = result.channels.map((c) => ({
    チャンネル名: c.channelTitle,
    チャンネル国: c.channelCountry || '',
    子ども向け: formatMadeForKids(c.channelMadeForKids),
    登録者数: c.subscriberCount,
    総動画数: c.totalVideoCount,
    開設日: c.channelPublishedDate,
    運営月数: c.operationMonths,
    ヒット数: c.hitCount,
    平均再生数: Math.round(c.averageViews),
    中央値再生数: Math.round(c.medianViews),
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
    ['検索地域', getSearchRegion(result.params.regionCode).label],
    ['期間', result.params.period],
    ['動画タイプ', result.params.duration],
    ['並び替え', result.params.order],
    ['登録者数', isSubscriberFilterActive(result.params) ? getSubscriberRange(result.params.subscriberRange).label : '考慮しない'],
    ['チャンネル開設日', isChannelAgeFilterActive(result.params) ? getChannelAgeFilter(result.params.channelAge).label : '考慮しない'],
    ['子ども向け', getKidsFilter(result.params.kidsFilter).label],
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
    ['タイトル', 'チャンネル名', 'チャンネル国', '子ども向け', '登録者数', '再生数', '高評価数', 'コメント数', 'エンゲージメント率(%)', '公開日', '1日平均再生数', '登録者比', 'アウトライアー倍率', '動画尺', '動画URL', 'チャンネルURL']
  ];
  result.videos.forEach((v) => {
    rows.push([
      v.title,
      v.channelTitle,
      v.channelCountry || '',
      formatMadeForKids(v.channelMadeForKids),
      String(v.subscriberCount),
      String(v.viewCount),
      String(v.likeCount),
      String(v.commentCount),
      v.engagementRate !== null ? (v.engagementRate * 100).toFixed(2) : '',
      v.publishedDate,
      String(Math.round(v.viewsPerDay)),
      v.subscriberRatio !== null ? v.subscriberRatio.toFixed(2) : '',
      v.outlierMultiplier !== null ? v.outlierMultiplier.toFixed(2) : '',
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

function formatMadeForKids(value: boolean | null): string {
  if (value === true) return '子ども向け';
  if (value === false) return '子ども向けではない';
  return '不明';
}
