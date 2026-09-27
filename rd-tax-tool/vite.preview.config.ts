/**
 * Build for the single-file demo preview: everything in one JS bundle
 * (no lazy chunks), so the page can be inlined into one HTML file.
 */
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

export default mergeConfig(
  base,
  defineConfig({
    base: './',
    build: { rollupOptions: { output: { inlineDynamicImports: true } } },
  }),
);
