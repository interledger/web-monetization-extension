import path from 'node:path';
import type { BuildOptions } from 'esbuild';
import type { Manifest } from 'webextension-polyfill';

export const TARGETS = ['chrome', 'firefox'] as const;
export const CHANNELS = ['nightly', 'preview', 'stable'] as const;

export const ROOT_DIR = path.resolve(__dirname, '..');
export const SRC_DIR = path.resolve(ROOT_DIR, 'src');
export const DEV_DIR = path.resolve(ROOT_DIR, 'dev');
export const DIST_DIR = path.resolve(ROOT_DIR, 'dist');

export type Target = (typeof TARGETS)[number];
export type Channel = (typeof CHANNELS)[number];
export type BuildArgs = {
  target: Target;
  channel: Channel;
  dev: boolean;
};

export const options: BuildOptions = {
  entryPoints: [
    {
      in: path.join(SRC_DIR, 'background', 'index.ts'),
      out: path.join('background', 'background'),
    },
    {
      in: path.join(SRC_DIR, 'content', 'index.ts'),
      out: path.join('content', 'content'),
    },
    {
      in: path.join(SRC_DIR, 'content', 'keyAutoAdd', 'testWallet.ts'),
      out: path.join('content', 'keyAutoAdd', 'testWallet'),
    },
    {
      in: path.join(SRC_DIR, 'content', 'polyfill.ts'),
      out: path.join('polyfill', 'polyfill'),
    },
    {
      in: path.join(SRC_DIR, 'popup', 'index.tsx'),
      out: path.join('popup', 'popup'),
    },
    {
      in: path.join(SRC_DIR, 'pages', 'progress-connect', 'index.tsx'),
      out: path.join('pages', 'progress-connect', 'progress-connect'),
    },
  ],
  bundle: true,
  legalComments: 'none',
  target: 'es2020',
  platform: 'browser',
  format: 'iife',
  write: true,
  logLevel: 'info',
  treeShaking: true,
};

export type WebExtensionManifest = Manifest.WebExtensionManifest & {
  background: Manifest.WebExtensionManifestBackgroundC3Type;
};

export const SERVE_PORTS: Record<Target, number> = {
  chrome: 7000,
  firefox: 7002,
};
