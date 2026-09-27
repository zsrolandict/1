import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Egyfájlos előnézet-build (claude.ai Artifact): minden JS és CSS a HTML-be kerül,
// a betűkészletek külön, relatív útvonalon töltődnek.
const root = path.resolve(import.meta.dirname, '..');

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { '@': root } },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: { outDir: path.join(root, 'dist-preview'), emptyOutDir: true },
});
