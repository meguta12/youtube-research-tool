// 日本語タイトルのトークナイズ。
// import ゼロの純粋関数のみ（node で単独実行して検証できるようにするため）。

// 記号類は空白に置換する。長音「ー」(U+30FC) はカタカナ語の一部なので除去しない。
// 「〜」は区切り記号として除去する。
const SYMBOL_PATTERN =
  /[【】「」『』（）()\[\]{}<>＜＞!！?？:：;；,，.。/／\\|｜"“”'’`~〜_＿+＋=＝*&％%$＄#＃@＠^＾・、…—－]/g;

// 文字種の連続（run）ごとに1トークンとして切り出す。
// カタカナは長音「ー」を含める。漢字は「々」の繰り返し記号を含める。
const RUN_PATTERN = /[ァ-ヶー]+|[一-龠々]+|[ぁ-ん]+|[A-Za-zＡ-Ｚａ-ｚ]+|[0-9０-９]+/g;

/**
 * テキストを文字種境界で分割してトークン列を返す。
 * 例:「在宅ワークの始め方」→ [在宅, ワーク, の, 始, め, 方]
 * （カタカナ「ワーク」が長音込みで1語として残ることが最重要）
 */
export function tokenizeJapanese(text: string): string[] {
  const cleaned = String(text || '').replace(SYMBOL_PATTERN, ' ');
  const tokens: string[] = [];
  for (const chunk of cleaned.split(/\s+/)) {
    if (!chunk) continue;
    const matches = chunk.match(RUN_PATTERN);
    if (matches) tokens.push(...matches);
  }
  return tokens;
}
