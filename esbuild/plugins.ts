import path from 'path'
import fs from 'fs/promises'

import type { Plugin as ESBuildPlugin } from 'esbuild'
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill'
import esbuildStylePlugin from 'esbuild-style-plugin'
import { copy } from 'esbuild-plugin-copy'
import { clean } from 'esbuild-plugin-clean'

import { SRC_DIR, ROOT_DIR, BuildArgs } from './config'

export const getPlugins = ({
  outDir,
  target,
  channel,
  dev
}: BuildArgs & {
  outDir: string
}): ESBuildPlugin[] => {
  return [
    clean({
      cleanOn: 'start',
      patterns: [outDir]
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
          from: path.join(SRC_DIR, 'popup', 'index.html'),
          to: path.join(outDir, 'popup', 'index.html')
        },
        {
          from: path.join(SRC_DIR, '_locales/**/*'),
          to: path.join(outDir, '_locales')
        },
        {
          from: path.join(SRC_DIR, 'assets/**/*'),
          to: path.join(outDir, 'assets')
        }
      ],
      watch: dev
    }),
    processManifestPlugin({ outDir, dev, target, channel }),
    preserverPolyfillClassNamesPlugin({ outDir })
  ]
}

// Based on https://github.com/Knowre-Dev/esbuild-plugin-ignore
function ignorePackagePlugin(ignores: RegExp[]): ESBuildPlugin {
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

function processManifestPlugin({
  outDir,
  target,
  channel,
  dev
}: BuildArgs & { outDir: string }): ESBuildPlugin {
  return {
    name: 'process-manifest',
    setup(build) {
      build.onEnd(async () => {
        const src = path.join(SRC_DIR, 'manifest.json')
        const dest = path.join(outDir, 'manifest.json')

        const json = JSON.parse(await fs.readFile(src, 'utf8'))
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

        await fs.writeFile(dest, JSON.stringify(json, null, 2))
      })
    }
  }
}

/**
 * Unmangles the MonetizationEvent class
 * This can be one solution to keep the class name for the MonetizationEvent unmangled.
 * Another solution might be to switch back to a JS polyfill and avoid transpiling
 * it from TS to JS.
 *
 * At the moment, it will still need another Regex to match:
 *  - `new p("monetization",t.detail)`
 */
function preserverPolyfillClassNamesPlugin({
  outDir
}: {
  outDir: string
}): ESBuildPlugin {
  return {
    name: 'polyfillPlugin',
    setup(build) {
      build.onEnd(async () => {
        const pollyfillPath = path.join(outDir, 'polyfill', 'polyfill.js')
        const polyfillContent = await fs.readFile(pollyfillPath, 'utf8')
        const definitionRegex = /class\s+([A-Za-z_$][\w$]*)\s+extends\s+Event/g
        const assignmentRegex =
          /window\.\s*MonetizationEvent\s*=\s*([A-Za-z_$][\w$]*)/g

        const result = polyfillContent
          .replace(definitionRegex, `class MonetizationEvent extends Event`)
          .replace(
            assignmentRegex,
            `window.MonetizationEvent=MonetizationEvent`
          )
        await fs.writeFile(pollyfillPath, result)
      })
    }
  }
}
