// esbuild driver: rolls src/bundle-entry.js (which imports every Univer
// package + every CSS) into dist/univer.js + dist/univer.css.
//
// Why bundle?
// - Loading 30+ separate <script> + <link> from a CDN means 30+ parse
//   passes; the warm-cache mount time was dominated by CSS parsing at
//   ~1.5s per file (see profile on 2026-05-19). A single concatenated
//   CSS file parses once, in ~100ms.
// - Same-origin static asset eliminates DNS + TLS to unpkg.com.
// - Tree-shaking drops unused exports from the deps.
//
// Run with: node build.mjs

import { build } from 'esbuild';
import { rmSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const OUTDIR = resolve('dist');

rmSync(OUTDIR, { recursive: true, force: true });
mkdirSync(OUTDIR, { recursive: true });

const NODE_ENV = process.env.NODE_ENV || 'production';
const isProd = NODE_ENV === 'production';

console.log(`[build] mode: ${NODE_ENV}`);

const result = await build({
    entryPoints: { univer: 'src/bundle-entry.js' },
    bundle: true,
    outdir: OUTDIR,
    // IIFE so we don't accidentally rely on ES module top-level scope —
    // the bundle should behave exactly like a UMD <script>.
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    minify: isProd,
    // Disable source maps in prod to keep dist/ small in git. Flip the
    // NODE_ENV env var if you need to debug a build locally.
    sourcemap: isProd ? false : 'linked',
    loader: { '.css': 'css' },
    // React + ReactDOM need this so they pick the production build at
    // bundle time instead of carrying the dev warnings.
    define: {
        'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
    },
    // Quiet warnings about Univer's pure annotations interacting with
    // the global window.X assignments — those are intentional.
    logLevel: 'info',
    metafile: true,
});

// Print a friendly size summary so the user sees the trade-off.
const inputs = Object.entries(result.metafile.inputs);
const totalIn = inputs.reduce((s, [, v]) => s + v.bytes, 0);
const outputs = Object.entries(result.metafile.outputs);
console.log('');
console.log('[build] outputs:');
for (const [path, info] of outputs) {
    const sizeKb = (info.bytes / 1024).toFixed(1);
    console.log(`  ${path.padEnd(25)} ${sizeKb} KB`);
}
console.log(`[build] total input bytes: ${(totalIn / 1024 / 1024).toFixed(1)} MB`);
console.log('[build] done.');
