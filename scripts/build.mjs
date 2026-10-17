// Production build: bundles the app with esbuild and writes
//   dist/index.html            (references dist/assets/*)
//   dist/workradar-standalone.html  (single self-contained file, open directly in a browser)
import * as esbuild from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';

const nodePaths = (process.env.NODE_PATH || '').split(':').filter(Boolean);

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/assets', { recursive: true });

await esbuild.build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  outdir: 'dist/assets',
  entryNames: 'app',
  nodePaths,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});

const template = readFileSync('index.html', 'utf8');
const js = readFileSync('dist/assets/app.js', 'utf8');
const css = readFileSync('dist/assets/app.css', 'utf8');

writeFileSync(
  'dist/index.html',
  template
    .replace('<!--STYLES-->', '<link rel="stylesheet" href="./assets/app.css" />')
    .replace('<!--SCRIPTS-->', '<script defer src="./assets/app.js"></script>')
);

// Standalone single-file build (inline everything). Escape closing script tags in the bundle.
const safeJs = js.replace(/<\/script/gi, '<\\/script');
writeFileSync(
  'dist/workradar-standalone.html',
  template
    .replace('<!--STYLES-->', () => `<style>${css}</style>`)
    .replace('<!--SCRIPTS-->', () => `<script>${safeJs}</script>`)
    .replace('<div id="root"></div>', '<div id="root"></div>')
);

console.log('Built dist/index.html and dist/workradar-standalone.html');
