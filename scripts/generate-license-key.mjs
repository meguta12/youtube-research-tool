#!/usr/bin/env node
// 販売時のライセンスキー発行スクリプト
// 使い方:
//   node scripts/generate-license-key.mjs           -> 1個生成
//   node scripts/generate-license-key.mjs 10        -> 10個生成
//
// 生成したキーは .env.production の VITE_LICENSE_KEYS にカンマ区切りで追記し、
// Vercel など本番環境変数にも反映してください。

import crypto from 'node:crypto';

const count = parseInt(process.argv[2] || '1', 10);
function block() {
  return crypto.randomBytes(2).toString('hex').toUpperCase(); // 4chars
}
function makeKey() {
  return [block(), block(), block(), block()].join('-');
}

const keys = Array.from({ length: count }, () => makeKey());
console.log(keys.join('\n'));
console.log('\n--- .env に貼り付け用 ---');
console.log('VITE_LICENSE_KEYS=' + keys.join(','));
