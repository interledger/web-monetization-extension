import path from 'node:path';
import { createRequire } from 'node:module';
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
import { isNotNull } from '@/shared/helpers';

const require = createRequire(import.meta.url);

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
    ignorePackagePlugin([
      /@apidevtools[/|\\]json-schema-ref-parser/,
      /@interledger[/|\\]openapi/,
    ]),
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
          from: toPosix(path.join(SRC_DIR, 'pages', 'popup', 'index.html')),
          to: toPosix(path.join(outDir, 'popup', 'index.html')),
        },
        {
          from: toPosix(path.join(SRC_DIR, 'pages', 'app', 'index.html')),
          to: toPosix(path.join(outDir, 'pages', 'app', 'index.html')),
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
      globbyOptions: {
        ignore: [target !== 'safari' ? '**/*safari*' : null].filter(isNotNull),
      },
    }),
    processManifestPlugin({ outDir, dev, target, channel }),
    safariCopyPlugin({ outDir, target }),
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
        json.$schema = undefined;

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
          json.name = `${json.name} Preview`;
        } else if (channel === 'nightly') {
          json.name = `${json.name} Nightly`;
        }

        if (target === 'firefox') {
          json.background = {
            scripts: [json.background.service_worker!],
          };
          json.browser_specific_settings = {
            gecko: json.browser_specific_settings!.gecko,
          };
          json.minimum_chrome_version = undefined;
        } else if (target === 'safari') {
          // https://developer.apple.com/forums/thread/758479?answerId=818592022#818592022
          json.background = {
            scripts: [json.background.service_worker!],
          };
          json.browser_specific_settings = {
            safari: json.browser_specific_settings!.safari,
          };
        } else {
          json.browser_specific_settings = undefined;
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

function safariCopyPlugin({
  outDir,
  target,
}: Pick<BuildArgs, 'target'> & { outDir: string }): ESBuildPlugin {
  const DEST = path.join(
    ROOT_DIR,
    'src',
    'safari',
    'Web Monetization',
    'Shared (Extension)',
    'Resources',
  );

  const FILES_TO_KEEP = ['.gitkeep'];
  const KEEP_PATHS = FILES_TO_KEEP.map((p) => path.join(DEST, p));

  return {
    name: 'safari-copy',
    setup(build) {
      if (target !== 'safari') {
        return;
      }

      build.onEnd(async () => {
        // clean DEST (while preserving FILES_TO_KEEP)
        const filesToKeep = await Promise.all(
          KEEP_PATHS.map((file) => fs.readFile(file, 'utf8')),
        );
        await fs.rm(DEST, { recursive: true, force: true });
        await fs.mkdir(DEST, { recursive: true });
        await Promise.all(
          filesToKeep.map((data, i) =>
            fs.writeFile(KEEP_PATHS[i], data, 'utf8'),
          ),
        );

        // copy outDir to DEST
        await fs.cp(outDir, DEST, {
          preserveTimestamps: true,
          recursive: true,
          force: true,
        });
      });
    },
  };
}

function toPosix(filePath: string): string {
  return filePath.replaceAll(path.sep, path.posix.sep);
}
