/* eslint-disable no-console */
// cSpell:ignore metafile,iife,outdir,servedir

import sade from 'sade';
import path from 'node:path';
import fs from 'node:fs';
import esbuild from 'esbuild';
import { parse as dotEnvParse } from 'dotenv';
import {
  options,
  CHANNELS,
  DEV_DIR,
  DIST_DIR,
  ROOT_DIR,
  SERVE_PORTS,
  TARGETS,
  type Target,
  type BuildArgs,
} from '../esbuild/config';
import { getDevOptions } from '../esbuild/dev';
import { getProdOptions } from '../esbuild/prod';

sade('build [target]', true)
  .option('--channel', `One of: ${CHANNELS.join(', ')}`, 'nightly')
  .option('--dev', 'Dev-mode (watch, live-reload)', false)
  .example('chrome --channel=nightly')
  .example('firefox --channel=stable')
  .describe(['`target` should be one of ' + TARGETS.join(', ')])
  .action(async (target: Target, opts: BuildArgs) => {
    const options = { ...opts, target };
    if (!options.target && !options.dev) {
      console.log(`Building all targets with channel: ${options.channel}`);
      return Promise.all(TARGETS.map((t) => build({ ...options, target: t })));
    }

    // Default to chrome in dev build
    if (options.dev) {
      options.target ||= 'chrome';
    }

    if (!TARGETS.includes(options.target)) {
      console.warn('Invalid --target. Must be one of ' + TARGETS.join(', '));
      process.exit(1);
    }
    if (!CHANNELS.includes(options.channel)) {
      console.warn('Invalid --channel. Must be one of ' + CHANNELS.join(', '));
      process.exit(1);
    }

    const envFile = path.join(ROOT_DIR, '.env');
    if (options.dev && fs.existsSync(envFile)) {
      options.defines = Object.fromEntries(
        Object.entries(dotEnvParse(fs.readFileSync(envFile)))
          .filter(([_, val]) => !!val)
          .map(([key, val]) => [key, JSON.stringify(val)]),
      );
    } else {
      options.defines = {};
    }

    console.log(
      `Building target: "${options.target}" with channel: "${options.channel}"`,
    );
    return options.dev ? buildWatch(options) : build(options);
  })
  .parse(process.argv);

async function build({ target, channel, defines }: BuildArgs) {
  const OUTPUT_DIR = path.join(DIST_DIR, target);
  const result = await esbuild.build({
    ...options,
    ...getProdOptions({ outDir: OUTPUT_DIR, target, channel, defines }),
    outdir: OUTPUT_DIR,
  });

  if (result.metafile) {
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'meta.json'),
      JSON.stringify(result.metafile),
    );
  }
}

async function buildWatch({ target, channel, defines }: BuildArgs) {
  const OUTPUT_DIR = path.join(DEV_DIR, target);
  const ctx = await esbuild.context({
    ...options,
    ...getDevOptions({ outDir: OUTPUT_DIR, target, channel, defines }),
    outdir: OUTPUT_DIR,
  });

  try {
    await ctx.serve({
      host: 'localhost',
      port: SERVE_PORTS[target],
      servedir: OUTPUT_DIR,
    });
  } catch (error) {
    console.log(error.message);
    console.log('>>> PLEASE TRY SAVING BUILD SCRIPT AGAIN');
  }

  await ctx.watch();

  process.on('beforeExit', () => ctx.dispose());
}
