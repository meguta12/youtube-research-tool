interface PostingHeatmapProps {
  matrix: number[][];
}

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];
const HOUR_LABELS = ['0-6時', '6-12時', '12-18時', '18-24時'];

/**
 * G2 曜日×時間帯ヒートマップ。Recharts を使わず div グリッドで描画（軽量・確実）。
 * 行=曜日（月〜日）、列=時間帯（0-6/6-12/12-18/18-24, JST）。
 * セルの背景色の濃淡（件数比例・ブランド青系）で「どこに投稿が集中しているか」を示し、
 * 色が薄い＝競合が投稿していない空白時間帯であることが一目で分かる。
 */
export function PostingHeatmap({ matrix }: PostingHeatmapProps) {
  // 全セルの最大件数で正規化して濃淡を決める（最低 1 でゼロ割回避）。
  const maxCount = Math.max(1, ...matrix.flat());

  return (
    <div className="card-body">
      <div className="overflow-x-auto">
        <div className="min-w-[360px]">
          {/* ヘッダ行：左上は空、以降は時間帯ラベル */}
          <div className="grid grid-cols-[2.5rem_repeat(4,1fr)] gap-1">
            <div />
            {HOUR_LABELS.map((label) => (
              <div key={label} className="text-center text-xs font-medium text-slate-500">
                {label}
              </div>
            ))}
          </div>
          {WEEKDAY_LABELS.map((weekday, rowIndex) => (
            <div key={weekday} className="mt-1 grid grid-cols-[2.5rem_repeat(4,1fr)] gap-1">
              <div className="flex items-center justify-center text-xs font-medium text-slate-500">
                {weekday}
              </div>
              {HOUR_LABELS.map((_, columnIndex) => {
                const count = matrix[rowIndex]?.[columnIndex] ?? 0;
                // 濃淡は 0.06〜1.0 の範囲で件数比例。0 件は薄い下地のまま。
                const intensity = count > 0 ? 0.12 + 0.88 * (count / maxCount) : 0;
                return (
                  <div
                    key={columnIndex}
                    className="flex h-10 items-center justify-center rounded text-xs font-semibold tabular-nums"
                    style={{
                      backgroundColor:
                        count > 0 ? `rgba(26, 115, 232, ${intensity})` : '#f1f5f9',
                      color: intensity > 0.55 ? '#ffffff' : '#334155'
                    }}
                  >
                    {count > 0 ? count : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        ※ 色が濃い＝投稿が集中している時間帯。色が薄い（白い）＝競合が投稿していない空白時間帯です。
      </p>
    </div>
  );
}
