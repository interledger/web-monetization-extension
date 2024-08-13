/* eslint-disable no-console */
// cSpell:ignore metafile,iife,outdir
import sade from 'sade'
import path from 'node:path'
import fs from 'node:fs'
import esbuild from 'esbuild'
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill'

const TARGETS = ['chrome', 'firefox', 'opera', 'edge'] as const
const CHANNELS = ['nightly', 'preview', 'release'] as const

const ROOT_DIR = path.resolve(__dirname, '..')
const DIR_SRC = path.resolve(ROOT_DIR, 'src')
const DIR_DEV = path.resolve(ROOT_DIR, 'dev')
const DIR_DIST = path.resolve(ROOT_DIR, 'dist')

export const MANIFEST_PATH = path.join(DIR_SRC, 'manifest.json')
export const OUTPUT_DIR =
  process.env.NODE_ENV === 'production' ? DIR_DIST : DIR_DEV

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
  processManifest({ target, channel, dev })

  const result = await esbuild.build({
    entryPoints: [
      {
        in: path.join(DIR_SRC, 'background', 'index.ts'),
        out: path.join('background', 'background')
      },
      {
        in: path.join(DIR_SRC, 'content', 'index.ts'),
        out: path.join('content', 'content')
      }
    ],
    outdir: path.join(OUTPUT_DIR, target),
    plugins: [
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
          util: true,
        }
      }),
      ignorePackagePlugin([/@apidevtools[/|\\]json-schema-ref-parser/])
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
    minify: true,
    define: {
      NODE_ENV: JSON.stringify('development'),
      CONFIG_LOG_LEVEL: JSON.stringify('DEBUG'),
      CONFIG_PERMISSION_HOSTS: JSON.stringify({ origins: ['https://*/*'] }),
      CONFIG_ALLOWED_PROTOCOLS: JSON.stringify(['https:']),
      CONFIG_OPEN_PAYMENTS_REDIRECT_URL: JSON.stringify(
        'https://webmonetization.org/welcome'
      )
    }
  })

  if (result.metafile) {
    fs.writeFileSync(
      path.join(OUTPUT_DIR, target, 'meta.json'),
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

function processManifest({ target, channel, dev }: BuildArgs) {
  const json = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
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

  // TODO: write to dist
  return JSON.stringify(json, null, 2)
}
