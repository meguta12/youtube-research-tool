import { ChannelRow } from '../lib/types';
import { formatNumber } from '../lib/utils';

interface ChannelAnalysisProps {
  channels: ChannelRow[];
}

export function ChannelAnalysis({ channels }: ChannelAnalysisProps) {
  if (channels.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center text-slate-500">
          リサーチを実行すると、複数本ヒットしたチャンネルの「再現性スコア」が表示されます。
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-header">チャンネル分析（{channels.length}件）</div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>チャンネル名</th>
              <th className="text-right">登録者</th>
              <th className="text-right">総動画数</th>
              <th>開設日</th>
              <th className="text-right">運営月数</th>
              <th className="text-right">ヒット数</th>
              <th className="text-right">平均再生</th>
              <th className="text-right">最高再生</th>
              <th className="text-right">再現性スコア</th>
              <th>判定</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr
                key={c.channelId}
                className={c.isOpportunity ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-slate-50'}
              >
                <td>
                  <a
                    href={c.channelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-slate-800 hover:text-brand-600"
                  >
                    {c.channelTitle}
                  </a>
                </td>
                <td className="text-right">{formatNumber(c.subscriberCount)}</td>
                <td className="text-right">{formatNumber(c.totalVideoCount)}</td>
                <td className="whitespace-nowrap">{c.channelPublishedDate}</td>
                <td className="text-right">{c.operationMonths}ヶ月</td>
                <td className="text-right">{c.hitCount}</td>
                <td className="text-right">{formatNumber(Math.round(c.averageViews))}</td>
                <td className="text-right">{formatNumber(c.maxViews)}</td>
                <td className="text-right font-semibold">{c.reproducibilityScore.toFixed(4)}</td>
                <td>
                  {c.isOpportunity ? (
                    <span className="badge bg-emerald-100 text-emerald-800">伸びチャンス</span>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-body text-xs text-slate-500">
        ※「伸びチャンス」= 運営12ヶ月未満 かつ ヒット動画の平均再生数が1万以上のチャンネル。新興で勢いのある競合の指標です。
      </div>
    </div>
  );
}
