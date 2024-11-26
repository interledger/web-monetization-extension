import path from 'node:path';
import fs from 'node:fs/promises';
import type { Plugin as ESBuildPlugin } from 'esbuild';
import { nodeBuiltin } from 'esbuild-node-builtin';
import esbuildStylePlugin from 'esbuild-style-plugin';
import { copy } from 'esbuild-plugin-copy';
import tailwind from 'tailwindcss';
import autoprefixer from 'autoprefixer';

import {
  SRC_DIR,
  ROOT_DIR,
  type BuildArgs,
  type WebExtensionManifest,
} from './config';

export const getPlugins = ({
  outDir,
  target,
  channel,
  dev,
}: BuildArgs & {
  outDir: string;
}): ESBuildPlugin[] => {
  return [
    cleanPlugin([outDir]),
    // nodeBuiltIn (powered by rollup plugin) replaces crypto with an empty
    // package. But we need it, and we use crypto-browserify in for our use
    // case. The JSPM crypto package is too large and not tree shakeable, so we
    // don't use it.
    nodeBuiltin({ exclude: ['crypto'] }),
    {
      name: 'crypto-for-extension',
      setup(build) {
        build.onResolve({ filter: /^crypto$/ }, () => ({
          path: require.resolve('crypto-browserify'),
        }));
      },
    },
    ignorePackagePlugin([/@apidevtools[/|\\]json-schema-ref-parser/]),
    esbuildStylePlugin({
      extract: true,
      postcss: {
        plugins: [tailwind, autoprefixer],
      },
    }),
    copy({
      resolveFrom: ROOT_DIR,
      assets: [
        {
          from: toPosix(path.join(SRC_DIR, 'popup', 'index.html')),
          to: toPosix(path.join(outDir, 'popup', 'index.html')),
        },
        {
          from: toPosix(
            path.join(SRC_DIR, 'pages', 'progress-connect', 'index.html'),
          ),
          to: toPosix(
            path.join(outDir, 'pages', 'progress-connect', 'index.html'),
          ),
        },
        {
          from: toPosix(path.join(SRC_DIR, '_locales', '**', '*')),
          to: toPosix(path.join(outDir, '_locales')),
        },
        {
          from: toPosix(path.join(SRC_DIR, 'assets', '**', '*')),
          to: toPosix(path.join(outDir, 'assets')),
        },
      ],
      watch: dev,
    }),
    processManifestPlugin({ outDir, dev, target, channel }),
  ];
};

// Based on https://github.com/Knowre-Dev/esbuild-plugin-ignore
function ignorePackagePlugin(ignores: RegExp[]): ESBuildPlugin {
  return {
    name: 'ignore-package',
    setup(build) {
      build.onResolve({ filter: /.*/, namespace: 'ignore' }, (args) => ({
        path: args.path,
        namespace: 'ignore',
      }));
      for (const ignorePattern of ignores) {
        build.onResolve({ filter: ignorePattern }, (args) => {
          return { path: args.path, namespace: 'ignore' };
        });
      }

      build.onLoad({ filter: /.*/, namespace: 'ignore' }, () => ({
        contents: '',
      }));
    },
  };
}

function processManifestPlugin({
  outDir,
  target,
  channel,
  dev,
}: BuildArgs & { outDir: string }): ESBuildPlugin {
  return {
    name: 'process-manifest',
    setup(build) {
      build.onEnd(async () => {
        const src = path.join(SRC_DIR, 'manifest.json');
        const dest = path.join(outDir, 'manifest.json');

        const json = JSON.parse(
          await fs.readFile(src, 'utf8'),
        ) as WebExtensionManifest;
        // Transform manifest as targets have different expectations
        // @ts-expect-error Only for IDE. No target accepts it
        delete json['$schema'];

        if (channel === 'nightly') {
          // Set version to YYYY.M.D
          const now = new Date();
          const [year, month, day] = [
            now.getFullYear(),
            now.getMonth() + 1,
            now.getDate(),
          ];
          json.version = `${year}.${month}.${day}`;
          if (target !== 'firefox') {
            json.version_name = `Nightly ${json.version}`;
          }
        }

        if (channel === 'preview') {
          json.name = json.name + ' Preview';
        } else if (channel === 'nightly') {
          json.name = json.name + ' Nightly';
        }

        if (dev) {
          if (
            json.host_permissions &&
            !json.host_permissions.includes('http://*/*')
          ) {
            json.host_permissions.push('http://*/*');
          }
          json.content_scripts?.forEach((contentScript) => {
            if (!contentScript.matches.includes('http://*/*')) {
              contentScript.matches.push('http://*/*');
            }
          });
        }

        if (target === 'firefox') {
          // @ts-expect-error Firefox doesn't support Service Worker in MV3 yet
          json.background = {
            scripts: [json.background.service_worker],
          };
          delete json.minimum_chrome_version;
        } else {
          delete json['browser_specific_settings'];
        }

        await fs.writeFile(dest, JSON.stringify(json, null, 2));
      });
    },
  };
}

function cleanPlugin(dirs: string[]): ESBuildPlugin {
  return {
    name: 'clean',
    setup(build) {
      build.onStart(async () => {
        await Promise.all(
          dirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
        );
      });
    },
  };
}

function toPosix(filePath: string): string {
  return filePath.replaceAll(path.sep, path.posix.sep);
}
