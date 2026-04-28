export function HelpPanel() {
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="font-semibold text-slate-800 mb-1">基本の流れ</h3>
        <ol className="list-decimal pl-5 space-y-1 text-slate-700">
          <li>ホーム画面でキーワード・期間・動画尺・並び替え・取得件数を選びます。</li>
          <li>「▶ リサーチ実行」を押します。</li>
          <li>「動画リスト」「チャンネル分析」「競合分析」「サムネ一覧」で結果を確認します。</li>
          <li>右上の「Excelダウンロード」で保存できます。</li>
        </ol>
      </section>

      <section>
        <h3 className="font-semibold text-slate-800 mb-1">指標の意味</h3>
        <ul className="list-disc pl-5 space-y-1 text-slate-700">
          <li><strong>1日平均再生数</strong>：再生数 ÷ 経過日数。新しい動画でも平等に比較できます。</li>
          <li><strong>登録者比</strong>：再生数 ÷ チャンネル登録者数。1.0を超えると「登録者数より多く再生された」=バズの目安。</li>
          <li><strong>再現性スコア</strong>：このキーワードでヒットした本数 ÷ チャンネル総動画数。高いほど「同じテーマで安定して再生数を取れている」可能性。</li>
          <li><strong>伸びチャンス</strong>：運営12ヶ月未満かつヒット動画の平均再生数1万以上。新興で勢いのある競合の指標。</li>
        </ul>
      </section>

      <section>
        <h3 className="font-semibold text-slate-800 mb-1">APIキーについて</h3>
        <ul className="list-disc pl-5 space-y-1 text-slate-700">
          <li>あなたのブラウザだけに保存されます。<strong>当方や第三者のサーバーに送信されることはありません</strong>。通信先はGoogle公式（googleapis.com）のみです。</li>
          <li>無料枠は1日10,000ユニット。1回のリサーチで概ね100〜200ユニット消費します。</li>
          <li>もし「quotaExceeded」と出たら、翌日（太平洋時間0:00 ≒ 日本時間17:00）に自動でリセットされます。</li>
        </ul>
      </section>

      <section>
        <h3 className="font-semibold text-rose-700 mb-1">⚠️ APIキーの安全な使い方</h3>
        <ul className="list-disc pl-5 space-y-1 text-slate-700">
          <li>
            APIキー作成後、Google Cloud Consoleで<strong>「アプリケーションの制限」→ウェブサイト</strong>に
            このツールのURLを登録し、<strong>「APIの制限」→YouTube Data API v3</strong>のみに絞ってください。
            これで万一漏れても他人には使えません。
          </li>
          <li>共有PCやネットカフェで使った場合は、ブラウザの履歴/Cookieを削除してから離席してください（保存内容は消えます）。</li>
          <li>キーをSNSやチャット、スクリーンショットで他人に見せないようにしてください。</li>
          <li>万一漏洩が疑われる場合は、Google Cloud Consoleの「認証情報」画面から該当キーを<strong>削除</strong>すれば即時に無効化できます。新しいキーを発行して登録し直してください。</li>
        </ul>
      </section>

      <section>
        <h3 className="font-semibold text-slate-800 mb-1">データの取り扱い</h3>
        <ul className="list-disc pl-5 space-y-1 text-slate-700">
          <li>検索条件、APIキー、検索結果、検索履歴、クォータ使用量すべてあなたのブラウザの中だけに保存されます。</li>
          <li>本ツールは外部分析サービス（Google Analyticsなど）を一切使用していません。</li>
          <li>ブラウザの履歴/Cookieを削除すると、保存された設定や履歴も消えます。Excel保存でのバックアップを推奨します。</li>
        </ul>
      </section>

      <section>
        <h3 className="font-semibold text-slate-800 mb-1">うまく検索できない時は</h3>
        <ul className="list-disc pl-5 space-y-1 text-slate-700">
          <li>キーワードが具体的すぎる → もっと一般的な語に。</li>
          <li>期間が短すぎる → 「3ヶ月」や「全期間」を試す。</li>
          <li>大手公式が邪魔 → 設定の「除外チャンネルID」に追加。</li>
        </ul>
      </section>
    </div>
  );
}
