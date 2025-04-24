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
    external: ['*.woff2'],
    plugins: getPlugins({ outDir, dev: true, target, channel }).concat([
      typecheckPlugin({ buildMode: 'readonly', watch: true }),
      liveReloadPlugin({ target }),
    ]),
    define: {
      NODE_ENV: JSON.stringify('development'),
      CONFIG_LOG_LEVEL: JSON.stringify('DEBUG'),
      CONFIG_OPEN_PAYMENTS_REDIRECT_URL: JSON.stringify(
        'https://webmonetization.org/welcome',
      ),
      CONFIG_LOG_SERVER_ENDPOINT: process.env.LOG_SERVER
        ? JSON.stringify(process.env.LOG_SERVER)
        : JSON.stringify(false),
    },
  };
};

function liveReloadPlugin({ target }: { target: Target }): ESBuildPlugin {
  const port = SERVE_PORTS[target];
  const liveReloadUrl = `http://127.0.0.1:${port}/esbuild`;
  const reloadScriptBackground = `
    new EventSource("${liveReloadUrl}").addEventListener(
      "change",
      async (ev) => {
        const browser = "browser" in globalThis ? globalThis.browser : globalThis.chrome;
        const data = JSON.parse(ev.data);
        const patterns = ["background.js", "content.js", "polyfill.js", "keyAutoAdd/"];
        if (
          data.added.some((s) => patterns.some(e => s.includes(e))) ||
          data.updated.some((s) => patterns.some(e => s.includes(e)))
        ) {
          console.warn(">>>>>>>> reloading background...");
          const window = await browser.windows.getLastFocused();
          const [tab] = await chrome.tabs.query({ active: true, windowId: window?.id });
          if (tab?.id && /^https?/.test(tab?.url || '')) {
            await browser.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => setTimeout(() => location.reload(), 200),
            }).catch(e => console.warn(e));
          } else {
            console.warn('No tab to reload')
          }
          await browser.runtime.reload();
        }
      }
    );`;

  const reloadScriptPopup = `
    new EventSource("${liveReloadUrl}").addEventListener(
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
    new EventSource("${liveReloadUrl}").addEventListener(
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

  return {
    name: 'live-reload',
    setup(build) {
      build.onLoad({ filter: /src\/background\/index\.ts$/ }, async (args) => {
        const contents = await readFile(args.path, 'utf8');
        return {
          contents: `${reloadScriptBackground}\n${contents}`,
          loader: 'ts' as const,
        };
      });

      build.onLoad(
        { filter: /src\/pages\/popup\/index\.tsx$/ },
        async (args) => {
          const contents = await readFile(args.path, 'utf8');
          return {
            contents: `${contents}\n\n\n${reloadScriptPopup}`,
            loader: 'tsx' as const,
          };
        },
      );
      build.onLoad({ filter: /src\/pages\/.+\/index.tsx$/ }, async (args) => {
        const contents = await readFile(args.path, 'utf8');
        return {
          contents: `${contents}\n\n\n${reloadScriptPages}`,
          loader: 'tsx' as const,
        };
      });
    },
  };
}
