import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'PixelPerfect',
        short_name: 'PixelPerfect',
        description: 'Éditeur de pixel art installable',
        theme_color: '#553692',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
    ...(process.env['ANALYZE']
      ? [visualizer({ open: true, filename: 'dist/stats.html', gzipSize: true })]
      : []),
  ],
  build: {
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) n'accepte plus la forme objet de manualChunks.
        manualChunks(id) {
          if (id.includes('/node_modules/@supabase/')) return 'vendor-supabase';
          if (/\/node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)) {
            return 'vendor-react';
          }
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables" as *;\n@use "@/styles/mixins" as *;\n`,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/index.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/types/**',
      ],
      // Seuils délibérément absents pour l'instant : ils exigent `@vitest/coverage-v8`, qui
      // n'est pas installé, donc aucun chiffre n'a pu être mesuré. Poser des seuils devinés
      // ferait échouer la CI ou, pire, la rendrait verte sur un plancher fantaisiste.
      //
      // Pour les activer :
      //   pnpm add -D @vitest/coverage-v8
      //   pnpm run test:coverage        # relever les chiffres réels
      // puis inscrire ici un `thresholds` légèrement en dessous du mesuré, et ajouter
      // `pnpm run test:coverage` au job CI. Un plancher qui ne redescend jamais vaut mieux
      // qu'un objectif jamais mesuré — mais il doit partir d'une mesure.
    },
  },
});
