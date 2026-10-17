// Dev server with live rebuild: http://localhost:5173
// `npm run preview` serves the production build from dist/ instead.
import * as esbuild from 'esbuild';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const PORT = Number(process.env.PORT || 5173);
const serveDist = process.argv.includes('--dist');
const nodePaths = (process.env.NODE_PATH || '').split(':').filter(Boolean);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

let outFiles = {};
if (!serveDist) {
  const ctx = await esbuild.context({
    entryPoints: ['src/main.tsx'],
    bundle: true,
    format: 'iife',
    jsx: 'automatic',
    sourcemap: 'inline',
    write: false,
    outdir: 'out',
    entryNames: 'app',
    nodePaths,
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{
      name: 'capture',
      setup(build) {
        build.onEnd((r) => {
          if (r.errors.length) return;
          outFiles = {};
          for (const f of r.outputFiles) outFiles['/assets/' + f.path.split('/').pop()] = f.text;
          console.log(`[${new Date().toLocaleTimeString()}] rebuilt`);
        });
      },
    }],
  });
  await ctx.watch();
}

createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (serveDist) {
    const file = join('dist', url === '/' ? 'index.html' : url);
    if (!existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    return res.end(readFileSync(file));
  }
  if (outFiles[url]) {
    res.writeHead(200, { 'Content-Type': types[extname(url)] });
    return res.end(outFiles[url]);
  }
  const html = readFileSync('index.html', 'utf8')
    .replace('<!--STYLES-->', '<link rel="stylesheet" href="/assets/app.css" />')
    .replace('<!--SCRIPTS-->', '<script defer src="/assets/app.js"></script>');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}).listen(PORT, () => console.log(`WorkRadar running at http://localhost:${PORT}`));
