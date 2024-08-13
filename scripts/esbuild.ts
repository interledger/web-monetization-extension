/* eslint-disable no-console */
// cSpell:ignore metafile,iife,outdir

// TODO: Do type checking at build time

import sade from 'sade'
import path from 'node:path'
import fs from 'node:fs'
import esbuild from 'esbuild'
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill'
import esbuildStylePlugin from 'esbuild-style-plugin'
import { copy } from 'esbuild-plugin-copy'
import { clean } from 'esbuild-plugin-clean'

const TARGETS = ['chrome', 'firefox', 'opera', 'edge'] as const
const CHANNELS = ['nightly', 'preview', 'release'] as const

const ROOT_DIR = path.resolve(__dirname, '..')
const DIR_SRC = path.resolve(ROOT_DIR, 'src')
const DIR_DEV = path.resolve(ROOT_DIR, 'dev')
const DIR_DIST = path.resolve(ROOT_DIR, 'dist')

export const MANIFEST_PATH = path.join(DIR_SRC, 'manifest.json')

type Target = (typeof TARGETS)[number]
type Channel = (typeof CHANNELS)[number]

interface BuildArgs {
  target: Target
  channel: Channel
  dev: boolean
}

sade('build', true)
  .option('--target', 'Target', 'chrome')
  .option('--channel', 'Channel', 'nightly')
  .option('--dev', 'Dev-mode (watch, live-reload)', false)
  .action(async (options: BuildArgs) => {
    console.log('running')
    if (!TARGETS.includes(options.target)) {
      console.warn('Invalid --target. Must be one of ' + TARGETS.join(', '))
      process.exit(1)
    }
    if (!CHANNELS.includes(options.channel)) {
      console.warn('Invalid --channel. Must be one of ' + CHANNELS.join(', '))
      process.exit(1)
    }

    await build(options)
    // return options.dev ? buildWatch(options) : build(options)
  })
  .parse(process.argv)

async function build({ target, channel, dev }: BuildArgs) {
  const OUTPUT_DIR = path.join(dev ? DIR_DEV : DIR_DIST, target)
  const config = dev
    ? await import('./config.dev')
    : await import('./config.build')

  const result = await esbuild.build({
    entryPoints: [
      {
        in: path.join(DIR_SRC, 'background', 'index.ts'),
        out: path.join('background', 'background')
      },
      {
        in: path.join(DIR_SRC, 'content', 'index.ts'),
        out: path.join('content', 'content')
      },
      {
        in: path.join(DIR_SRC, 'content', 'polyfill.ts'),
        out: path.join('polyfill', 'polyfill')
      },
      {
        in: path.join(DIR_SRC, 'popup', 'index.tsx'),
        out: path.join('popup', 'popup')
      }
    ],
    outdir: OUTPUT_DIR,

    plugins: [
      clean({
        cleanOn: 'start',
        patterns: [OUTPUT_DIR]
      }),

      nodeModulesPolyfillPlugin({
        fallback: 'empty',
        globals: {
          Buffer: true
        },
        modules: {
          buffer: true,
          events: true,
          crypto: true,
          path: true,
          constants: true,
          stream: true,
          util: true
        }
      }),

      ignorePackagePlugin([/@apidevtools[/|\\]json-schema-ref-parser/]),

      // @ts-expect-error fix me
      esbuildStylePlugin({
        extract: true,
        postcss: {
          plugins: [require('tailwindcss'), require('autoprefixer')]
        }
      }),

      copy({
        resolveFrom: ROOT_DIR,
        assets: [
          {
            from: path.join(DIR_SRC, 'popup', 'index.html'),
            to: path.join(OUTPUT_DIR, 'popup', 'index.html')
          },
          {
            from: path.join(DIR_SRC, '_locales/**/*'),
            to: path.join(OUTPUT_DIR, '_locales')
          },
          {
            from: path.join(DIR_SRC, 'assets/**/*'),
            to: path.join(OUTPUT_DIR, 'assets')
          }
        ],
        watch: dev
      }),

      {
        name: 'process-manifest',
        setup(build) {
          build.onEnd(() => {
            processManifest(
              { srcDir: DIR_SRC, outDir: OUTPUT_DIR },
              { target, channel, dev }
            )
          })
        }
      }
    ],
    bundle: true,
    legalComments: 'none',
    target: 'es2020',
    platform: 'browser',
    format: 'iife',
    sourcemap: dev ? 'linked' : false,
    write: true,
    logLevel: 'info',
    treeShaking: true,
    metafile: dev,
    minify: !dev,
    define: config.defines
  })

  if (result.metafile) {
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'meta.json'),
      JSON.stringify(result.metafile)
    )
  }
}

// Based on https://github.com/Knowre-Dev/esbuild-plugin-ignore
function ignorePackagePlugin(ignores: RegExp[]): esbuild.Plugin {
  return {
    name: 'ignorePackagePlugin',
    setup(build) {
      build.onResolve({ filter: /.*/, namespace: 'ignore' }, (args) => ({
        path: args.path,
        namespace: 'ignore'
      }))
      for (const ignorePattern of ignores) {
        build.onResolve({ filter: ignorePattern }, (args) => {
          return { path: args.path, namespace: 'ignore' }
        })
      }

      build.onLoad({ filter: /.*/, namespace: 'ignore' }, () => ({
        contents: ''
      }))
    }
  }
}

// function buildWatch({ target, channel }: BuildArgs) {
//   console.log(target, channel)
// }

function processManifest(
  { srcDir, outDir }: { srcDir: string; outDir: string },
  { target, channel, dev }: BuildArgs
) {
  const json = JSON.parse(
    fs.readFileSync(path.join(srcDir, 'manifest.json'), 'utf8')
  )
  // Transform manifest as targets have different expectations

  delete json['$schema'] // Only for IDE. No target accepts it.

  if (channel === 'nightly') {
    // Set version to YYYY.MM.DD
    const now = new Date()
    const [year, month, day] = [
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
    ].map((e) => `${e}`.padStart(2, '0'))
    json.version = `${year}.${month}.${day}`
    json.version_name = `Nightly ${json.version}`
  }

  if (channel === 'preview') {
    json.name = json.name + ' Preview'
  } else if (channel === 'nightly') {
    json.name = json.name + ' Nightly'
  }

  if (dev) {
    if (!json.host_permissions.includes('http://*/*')) {
      json.host_permissions.push('http://*/*')
    }
    json.content_scripts.forEach((contentScript) => {
      if (!contentScript.matches.includes('http://*/*')) {
        contentScript.matches.push('http://*/*')
      }
    })
  }

  if (target === 'firefox') {
    json.background = {
      scripts: [json.background.service_worker]
    }
    json.content_scripts.forEach((contentScript) => {
      // firefox doesn't support execution context yet
      contentScript.world = undefined
    })
  }
  if (target !== 'firefox') {
    delete json['browser_specific_settings']
  }

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(json, null, 2),
    'utf8'
  )
}
