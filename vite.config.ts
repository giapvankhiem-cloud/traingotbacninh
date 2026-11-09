import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // GitHub Pages uses /traingotbacninh/. Other static hosts can override this
  // at build time with VITE_BASE_PATH=/your-site/.
  base: command === 'build' ? process.env.VITE_BASE_PATH || '/traingotbacninh/' : '/',
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['qrcode'],
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@firebase') || id.includes('node_modules/firebase')) return 'firebase-vendor';
          if (id.includes('node_modules/three')) return 'three-vendor';
          if (id.includes('node_modules/lucide-react')) return 'icons-vendor';
        },
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
