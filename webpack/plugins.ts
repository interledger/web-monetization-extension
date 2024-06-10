import path from 'node:path'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import {
  MANIFEST_PATH,
  MANIFEST_V2_PATH,
  DIRECTORIES,
  ROOT_DIR,
  type Target,
  type ManifestVersion
} from './config'
import { ProgressPlugin, ProvidePlugin, IgnorePlugin, optimize } from 'webpack'
import CopyWebpackPlugin from 'copy-webpack-plugin'
import { CleanWebpackPlugin } from 'clean-webpack-plugin'

export const getMainPlugins = (
  outputDir: string,
  target: Target,
  manifestVersion: ManifestVersion = 3,
  isProduction = process.env.NODE_ENV === 'production'
): any[] => [
  new CleanWebpackPlugin({
    cleanOnceBeforeBuildPatterns: [
      path.resolve(ROOT_DIR, `${outputDir}/${target}`)
    ],
    cleanStaleWebpackAssets: false,
    verbose: true
  }),
  new ProgressPlugin(),

  // Force Webpack to create self-contained bundles. Otherwise, it uses dynamic
  // script loading with document.createElement('script'), and `document` isn't
  // defined in MV3 background service workers, which results in fatal crash.
  new optimize.LimitChunkCountPlugin({
    maxChunks: 1
  }),

  new HtmlWebpackPlugin({
    title: 'Popup',
    filename: path.resolve(ROOT_DIR, `${outputDir}/${target}/popup/index.html`),
    template: path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/popup/index.html`),
    chunks: ['popup']
  }),
  new CopyWebpackPlugin({
    patterns: [
      {
        from: path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/assets`),
        to: path.resolve(ROOT_DIR, `${outputDir}/${target}/assets`)
      },
      {
        from: path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/_locales`),
        to: path.resolve(ROOT_DIR, `${outputDir}/${target}/_locales`)
      },
      {
        filter: () => manifestVersion === 3,
        from: MANIFEST_PATH,
        to() {
          return path.resolve(ROOT_DIR, `${outputDir}/${target}/manifest.json`)
        },
        transform(content: Buffer) {
          const json = JSON.parse(content.toString())
          // Transform manifest as targets have different expectations

          delete json['$schema'] // Only for IDE. No target accepts it.

          if (target === 'firefox') {
            json.background = {
              scripts: [json.background.service_worker]
            }
            json.content_scripts.forEach((cscript) => {
              // firefox doesn't support execution context yet
              cscript.world = undefined
              if (!isProduction && !cscript.matches.includes('http://*/*')) {
                cscript.matches.push('http://*/*')
              }
            })
          }
          if (target !== 'firefox') {
            delete json['browser_specific_settings']
          }
          if (!isProduction) {
            if (!json.host_permissions.includes('http://*/*')) {
              json.host_permissions.push('http://*/*')
            }
          }
          return JSON.stringify(json, null, 2)
        }
      },
      {
        filter: () => manifestVersion === 2,
        from: MANIFEST_V2_PATH,
        to() {
          return path.resolve(ROOT_DIR, `${outputDir}/${target}/manifest.json`)
        },
        transform(content: Buffer) {
          if (target === 'firefox') {
            // TODO: Update manifest for Firefox (V3)
          }
          return content
        }
      },
      // Bundle OpenAPI schemas - the Open Payments client is using them to
      // validate responses.
      {
        from: path.resolve(
          ROOT_DIR,
          'node_modules/@interledger/open-payments/dist/openapi/specs'
        ),
        to: path.resolve(ROOT_DIR, `${outputDir}/${target}/specs`),
        globOptions: {
          ignore: ['**/generated/**']
        }
      }
    ]
  }),
  new ProvidePlugin({
    Buffer: ['buffer', 'Buffer']
  }),
  new ProvidePlugin({
    process: 'process/browser'
  }),
  new IgnorePlugin({
    resourceRegExp: /node-fetch/,
    contextRegExp: /@apidevtools\/json-schema-ref-parser/
  })
]
