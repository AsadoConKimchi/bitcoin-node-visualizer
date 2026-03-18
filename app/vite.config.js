import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, 'client/dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // dev proxy 제거 — 백엔드 불필요, 브라우저가 mempool.space WS에 직접 연결
  },
});
