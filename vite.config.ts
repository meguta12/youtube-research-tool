import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // 重いライブラリを別チャンクに分離し、メインチャンク（index-*.js）を小さく保つ。
        // xlsx はエクスポート時のみ、recharts（＋引きずられる d3 系）はグラフ表示時のみ必要。
        manualChunks: (id) => {
          if (id.includes('node_modules/xlsx')) return 'xlsx';
          if (id.includes('node_modules/jszip')) return 'jszip';
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/victory-vendor') ||
            id.includes('node_modules/decimal.js-light') ||
            id.includes('node_modules/internmap')
          ) {
            return 'recharts';
          }
          return undefined;
        }
      }
    }
  }
});
