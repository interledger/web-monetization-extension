import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import type { BuildOptions, Plugin as ESBuildPlugin } from 'esbuild';
import { ZipArchive } from 'archiver';
import type {
  BuildArgs,
  Channel,
  Target,
  WebExtensionManifest,
} from './config.ts';
import { getPlugins } from './plugins.ts';

export const getProdOptions = ({
  outDir,
  target,
  channel,
}: Omit<BuildArgs, 'dev'> & {
  outDir: string;
}): BuildOptions => {
  return {
    sourcemap: false,
    metafile: true,
    minify: true,
    plugins: getPlugins({
      outDir,
      dev: false,
      target,
      channel,
    }).concat([
      preservePolyfillClassNamesPlugin({ outDir }),
      zipPlugin({ outDir, target, channel }),
    ]),
    define: {
      NODE_ENV: JSON.stringify('production'),
      VAR_BUILD_TARGET: JSON.stringify(target),
      CONFIG_LOG_LEVEL: JSON.stringify('WARN'),
      CONFIG_OPEN_PAYMENTS_REDIRECT_URL: JSON.stringify(
        'https://webmonetization.org/welcome',
      ),
      CONFIG_LOG_SERVER_ENDPOINT: JSON.stringify(false),
      CONFIG_POSTHOG_KEY: JSON.stringify(
        process.env.POSTHOG_KEY ||
          'phc_A42pTzb0ySkVYmNBSSfsr3K8BOyyuhR7g8l8hUdd6cv',
      ),
      CONFIG_POSTHOG_HOST: JSON.stringify(
        process.env.POSTHOG_HOST || 'https://eu.i.posthog.com',
      ),
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
        const archive = new ZipArchive();
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
 * Unmangles the MonetizationEvent and MonetizationCurrencyAmount classes
 */
function preservePolyfillClassNamesPlugin({
  outDir,
}: {
  outDir: string;
}): ESBuildPlugin {
  const classNames = ['MonetizationEvent', 'MonetizationCurrencyAmount'];
  return {
    name: 'preserve-polyfill-class-names',
    setup(build) {
      build.onEnd(async () => {
        const polyfillPath = path.join(outDir, 'polyfill', 'polyfill.js');
        let result = await fs.readFile(polyfillPath, 'utf8');

        for (const className of classNames) {
          const assignmentRegex = new RegExp(
            `window\\.${className}=([A-Za-z_$][\\w$]*)`,
          );
          const match = result.match(assignmentRegex);
          if (!match) {
            throw new Error(`Could not find ${className} definition`);
          }

          const minifiedName = match[1];
          result = result
            .replace(
              new RegExp(`\\bclass\\s+${minifiedName}\\b`),
              `class ${className}`,
            )
            .replace(
              new RegExp(`window\\.${className}=${minifiedName}\\b`),
              `window.${className}=${className}`,
            )
            .replace(
              new RegExp(`\\bnew ${minifiedName}\\b`, 'g'),
              `new ${className}`,
            );
        }

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
