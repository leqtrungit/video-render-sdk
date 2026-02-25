import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'VrsClient',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      // @vrs/core is a peer — do not bundle it
      external: [
        '@vrs/core',
        '@vrs/core/schema',
        '@vrs/core/events',
        '@vrs/core/assessment',
        '@vrs/core/switcher',
      ],
    },
    target: 'esnext',
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core-mt'],
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer (FFmpeg.wasm multi-thread)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
