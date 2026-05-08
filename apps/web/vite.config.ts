import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { qrcode } from 'vite-plugin-qrcode';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss(), qrcode()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@screens': path.resolve(__dirname, './src/screens'),
      '@ui': path.resolve(__dirname, './src/ui'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // in KB. 1000 - 1500 is good for most apps.
  }
});
