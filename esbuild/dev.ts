import { readFile } from 'node:fs/promises';
import type { BuildOptions, Plugin as ESBuildPlugin } from 'esbuild';
import { SERVE_PORTS, type BuildArgs, type Target } from './config';
import { getPlugins } from './plugins';
import { typecheckPlugin } from '@jgoz/esbuild-plugin-typecheck';

export const getDevOptions = ({
  outDir,
  target,
  channel,
}: Omit<BuildArgs, 'dev'> & {
  outDir: string;
}): BuildOptions => {
  return {
    sourcemap: 'linked',
    metafile: false,
    minify: false,
    loader: { '.woff2': 'binary' },
    plugins: getPlugins({ outDir, dev: true, target, channel }).concat([
      typecheckPlugin({ buildMode: 'readonly', watch: true }),
      liveReloadPlugin({ target }),
    ]),
    define: {
      NODE_ENV: JSON.stringify('development'),
      CONFIG_LOG_LEVEL: JSON.stringify('DEBUG'),
      CONFIG_PERMISSION_HOSTS: JSON.stringify({
        origins: ['http://*/*', 'https://*/*'],
      }),
      CONFIG_ALLOWED_PROTOCOLS: JSON.stringify(['http:', 'https:']),
      CONFIG_OPEN_PAYMENTS_REDIRECT_URL: JSON.stringify(
        'https://webmonetization.org/welcome',
      ),
    },
  };
};

function liveReloadPlugin({ target }: { target: Target }): ESBuildPlugin {
  const port = SERVE_PORTS[target];
  const reloadScriptBackground = `
    new EventSource("http://localhost:${port}/esbuild").addEventListener(
      "change",
      async (ev) => {
        const browser = "browser" in globalThis ? globalThis.browser : globalThis.chrome;
        const data = JSON.parse(ev.data);
        if (
          data.added.some(s => s.includes("background.js")) ||
          data.updated.some(s => s.includes("background.js"))
        ) {
          console.warn(">>>>>>>> reloading background...");
          await browser.runtime.reload();
        }
      }
    );`;

  const reloadScriptPopup = `
    new EventSource("http://localhost:${port}/esbuild").addEventListener(
      "change",
      (ev) => {
        const data = JSON.parse(ev.data);
        if (
          data.added.some(s => s.includes("popup.js")) ||
          data.updated.some(s => s.includes("popup.js"))
        ) {
          globalThis.location.reload();
        }
      }
    );`;

  const reloadScriptPages = `
      new EventSource("http://localhost:${port}/esbuild").addEventListener(
      "change",
      (ev) => {
        const data = JSON.parse(ev.data);
        if (
          data.added.some(s => s.includes("/pages/")) ||
          data.updated.some(s => s.includes("/pages/"))
        ) {
          globalThis.location.reload();
        }
      }
    );`;

  const reloadScriptContent = `
    new EventSource("http://localhost:${port}/esbuild").addEventListener(
      "change",
      (ev) => {
        const patterns = ["background.js", "content.js", "polyfill.js", "keyAutoAdd/"];
        const data = JSON.parse(ev.data);
        if (data.updated.some((s) => patterns.some(e => s.includes(e)))) {
          globalThis.location.reload();
        }
      },
    );`;

  return {
    name: 'live-reload',
    setup(build) {
      build.onLoad({ filter: /src\/background\/index\.ts$/ }, async (args) => {
        const contents = await readFile(args.path, 'utf8');
        return {
          contents: reloadScriptBackground + '\n' + contents,
          loader: 'ts' as const,
        };
      });

      build.onLoad(
        { filter: /src\/pages\/popup\/index\.tsx$/ },
        async (args) => {
          const contents = await readFile(args.path, 'utf8');
          return {
            contents: contents + '\n\n\n' + reloadScriptPopup,
            loader: 'tsx' as const,
          };
        },
      );
      build.onLoad({ filter: /src\/pages\/.+\/index.tsx$/ }, async (args) => {
        const contents = await readFile(args.path, 'utf8');
        return {
          contents: contents + '\n\n\n' + reloadScriptPages,
          loader: 'tsx' as const,
        };
      });
      build.onLoad({ filter: /src\/content\// }, async (args) => {
        const contents = await readFile(args.path, 'utf8');
        return {
          contents: contents + '\n\n\n' + reloadScriptContent,
          loader: 'ts' as const,
        };
      });
    },
  };
}
