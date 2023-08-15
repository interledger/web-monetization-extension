import * as fs from 'fs'
import * as path from 'path'
import type { PluginOption } from 'vite'

import colorLog from '../log'
import ManifestParser from '../manifest-parser'

const { resolve } = path

const rootDir = resolve(__dirname, '..', '..')
const isFirefox = process.env.__FIREFOX__ === 'true'
const distDir = isFirefox ? resolve(rootDir, 'dist-firefox-v2') : resolve(rootDir, 'dist')
const publicDir = resolve(rootDir, 'public')

export default function createManifest(
  manifest,
  config: { isDev: boolean; isFirefox: boolean; contentScriptCssKey?: string },
): PluginOption {
  function makeManifest(to: string) {
    if (!fs.existsSync(to)) {
      fs.mkdirSync(to)
    }
    const manifestPath = resolve(to, 'manifest.json')

    // Naming change for cache invalidation
    if (config.contentScriptCssKey) {
      manifest.content_scripts.forEach(script => {
        script.css = script.css.map(css => css.replace('<KEY>', config.contentScriptCssKey))
      })
    }

    fs.writeFileSync(manifestPath, ManifestParser.convertManifestToString(manifest))

    colorLog(`Manifest file copy complete: ${manifestPath}`, 'success')
  }

  return {
    name: 'make-manifest',
    buildStart() {
      if (config.isDev) {
        makeManifest(distDir)
      }
    },
    buildEnd() {
      if (config.isDev) {
        return
      }
      makeManifest(publicDir)
    },
  }
}
