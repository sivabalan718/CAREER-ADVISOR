// Packages the existing Express app for Vercel using the Build Output API (v3).
// Output: .vercel/output/
//   config.json                       → every path is routed to the "index" function
//   functions/index.func/index.js     → single-file bundle of backend/index.ts (createApp() from @m63/server)
//   functions/index.func/.vc-config.json
// The bundle embeds @m63/server, @m63/engine, @m63/shared and their dependencies, so the function
// does not rely on npm workspace symlinks at runtime.
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.vercel', 'output');
const fn = join(out, 'functions', 'index.func');

rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

await build({
  entryPoints: [join(root, 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: join(fn, 'index.js'),
  logLevel: 'warning',
  // Vercel's Node launcher calls module.exports(req, res); an Express app is exactly that handler.
  footer: { js: 'module.exports = module.exports.default || module.exports;' }
});

writeFileSync(join(fn, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs20.x',
  handler: 'index.js',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
  maxDuration: 60
}, null, 2));

writeFileSync(join(out, 'config.json'), JSON.stringify({
  version: 3,
  routes: [{ src: '/(.*)', dest: '/index' }]
}, null, 2));

console.log('Vercel Build Output written to .vercel/output (function: index)');
