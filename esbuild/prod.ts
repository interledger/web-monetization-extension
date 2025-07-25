import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import type { BuildOptions, Plugin as ESBuildPlugin } from 'esbuild';
import archiver from 'archiver';
import type {
  BuildArgs,
  Channel,
  Target,
  WebExtensionManifest,
} from './config';
import { getPlugins } from './plugins';

export const getProdOptions = ({
  outDir,
  target,
  channel,
  typecheck,
}: Omit<BuildArgs, 'dev'> & {
  outDir: string;
}): BuildOptions => {
  return {
    sourcemap: false,
    metafile: true,
    minify: true,
    external: ['*.woff2'],
    plugins: getPlugins({
      outDir,
      dev: false,
      target,
      channel,
      typecheck,
    }).concat([
      preservePolyfillClassNamesPlugin({ outDir }),
      zipPlugin({ outDir, target, channel }),
    ]),
    define: {
      NODE_ENV: JSON.stringify('production'),
      CONFIG_LOG_LEVEL: JSON.stringify('WARN'),
      CONFIG_OPEN_PAYMENTS_REDIRECT_URL: JSON.stringify(
        'https://webmonetization.org/welcome',
      ),
      CONFIG_LOG_SERVER_ENDPOINT: JSON.stringify(false),
    },
  };
};

function zipPlugin({
  outDir,
  target,
  channel,
}: {
  channel: Channel;
  target: Target;
  outDir: string;
}): ESBuildPlugin {
  return {
    name: 'zip',
    setup(build) {
      build.onEnd(async () => {
        const manifest = JSON.parse(
          await fs.readFile(path.join(outDir, 'manifest.json'), 'utf8'),
        ) as WebExtensionManifest;

        let zipName = `${target}-${manifest.version}.zip`;
        if (channel !== 'stable') {
          zipName = `${channel}-${zipName}`;
        }

        const dest = path.join(outDir, '..', zipName);
        const output = createWriteStream(dest);
        const archive = archiver('zip');
        archive.on('end', () => {
          const archiveSize = archive.pointer();
          const fileName = path.relative(process.cwd(), dest);
          console.log(`   Archived ${fileName}: ${formatBytes(archiveSize)}`);
        });
        archive.pipe(output);
        archive.glob('**/*', { cwd: outDir, ignore: ['meta.json'] });
        await archive.finalize();
      });
    },
  };
}

/**
 * Unmangles the MonetizationEvent class
 */
function preservePolyfillClassNamesPlugin({
  outDir,
}: {
  outDir: string;
}): ESBuildPlugin {
  return {
    name: 'preserve-polyfill-class-names',
    setup(build) {
      build.onEnd(async () => {
        const polyfillPath = path.join(outDir, 'polyfill', 'polyfill.js');
        const polyfillContent = await fs.readFile(polyfillPath, 'utf8');
        const definitionRegex = /class\s+([A-Za-z_$][\w$]*)\s+extends\s+Event/;

        const match = polyfillContent.match(definitionRegex);
        if (!match) {
          throw new Error('Could not find MonetizationEvent definition');
        }

        const minifiedName = match[1];

        const result = polyfillContent
          .replace(definitionRegex, 'class MonetizationEvent extends Event')
          .replace(
            `window.MonetizationEvent=${minifiedName}`,
            'window.MonetizationEvent=MonetizationEvent',
          )
          .replaceAll(`new ${minifiedName}`, 'new MonetizationEvent');

        await fs.writeFile(polyfillPath, result);
      });
    },
  };
}

function formatBytes(bytes: number, decimals = 2) {
  if (!Number(bytes)) return '0B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))}${sizes[i]}`;
}
