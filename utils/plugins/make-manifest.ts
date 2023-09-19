import { createHash } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import type { PluginOption } from 'vite'

import { wmPolyfill } from '../../src/polyfills/wmPolyfill'
import colorLog from '../log'
import ManifestParser from '../manifest-parser'

const { resolve } = path

const rootDir = resolve(__dirname, '..', '..')
const isFirefox = process.env.__FIREFOX__ === 'true'
const distDir = isFirefox ? resolve(rootDir, 'dist-firefox-v2') : resolve(rootDir, 'dist')
const publicDir = resolve(rootDir, 'public')
//
// const scriptHash = crypto.createHash('sha256').update(wmPolyfill).digest('base64')
// const polyfillFilePath = resolve(rootDir, 'src', 'wm-polyfill.js')
// fs.writeFileSync(polyfillFilePath, wmPolyfill)
const data = Buffer.from(wmPolyfill, 'utf-8')
const digest = createHash('sha256').update(data).digest()
const polyfillHash = `sha256-${digest.toString('base64')}`

export default function createManifest(
  manifest,
  config: {
    isDev: boolean
    isFirefox: boolean
    contentScriptCssKey?: string
  },
): PluginOption {
  function makeManifest(to: string) {
    if (!fs.existsSync(to)) {
      fs.mkdirSync(to)
    }
    const manifestPath = resolve(to, 'manifest.json')
    // manifest.content_security_policy = {
    //   extension_pages: `script-src 'self' '${polyfillHash}' 'unsafe-eval'; object-src 'self'`,
    //   sandbox:
    //     "sandbox allow-scripts allow-forms allow-popups allow-modals; script-src 'self' 'unsafe-inline' 'unsafe-eval'; child-src 'self';",
    // }

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
      // copyFile(polyfillFilePath, resolve(distDir, 'wm-polyfill.js'), err => {
      //   if (err) {
      //     console.error('Error copying polyfill:', err)
      //   } else {
      //     console.log('Polyfill copied successfully')
      //   }
      // })
    },
  }
}
