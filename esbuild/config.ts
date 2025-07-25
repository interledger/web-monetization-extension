import path from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { BuildOptions } from 'esbuild';
import type { Manifest } from 'webextension-polyfill';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TARGETS = ['chrome', 'firefox', 'safari'] as const;
export const CHANNELS = ['nightly', 'preview', 'stable'] as const;

export const ROOT_DIR = path.resolve(__dirname, '..');
export const SRC_DIR = path.resolve(ROOT_DIR, 'src');
export const DEV_DIR = path.resolve(ROOT_DIR, 'dev');
export const DIST_DIR = path.resolve(ROOT_DIR, 'dist');

const KEY_AUTO_ADD_TARGETS = readdirSync(
  path.join(SRC_DIR, 'content', 'keyAutoAdd'),
  { withFileTypes: true },
)
  .filter((e) => e.isFile())
  .map(({ name }) => path.basename(name, path.extname(name)));

export type Target = (typeof TARGETS)[number];
export type Channel = (typeof CHANNELS)[number];
export type BuildArgs = {
  target: Target;
  channel: Channel;
  dev: boolean;
  typecheck: boolean;
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
    ...KEY_AUTO_ADD_TARGETS.map((name) => ({
      in: path.join(SRC_DIR, 'content', 'keyAutoAdd', `${name}.ts`),
      out: path.join('content', 'keyAutoAdd', name),
    })),
    {
      in: path.join(SRC_DIR, 'content', 'polyfill.ts'),
      out: path.join('polyfill', 'polyfill'),
    },
    {
      in: path.join(SRC_DIR, 'pages', 'popup', 'index.tsx'),
      out: path.join('popup', 'popup'),
    },
    {
      in: path.join(SRC_DIR, 'pages', 'app', 'index.tsx'),
      out: path.join('pages', 'app', 'app'),
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
  background: Manifest.WebExtensionManifestBackgroundType;
  browser_specific_settings?: Manifest.BrowserSpecificSettings & {
    safari?: { strict_min_version?: string; strict_max_version?: string };
  };
};

export const SERVE_PORTS: Record<Target, number> = {
  chrome: 7000,
  firefox: 7002,
  safari: 7004,
};
