import react from '@vitejs/plugin-react'
import path, { resolve } from 'path'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

import manifest from './manifest'
import addHmr from './utils/plugins/add-hmr'
import customDynamicImport from './utils/plugins/custom-dynamic-import'
import makeManifest from './utils/plugins/make-manifest'
import watchRebuild from './utils/plugins/watch-rebuild'

const rootDir = resolve(__dirname)
const srcDir = resolve(rootDir, 'src')
const pagesDir = resolve(srcDir, 'pages')
const assetsDir = resolve(srcDir, 'assets')
const publicDir = resolve(rootDir, 'public')

const isDev = process.env.__DEV__ === 'true'
const isProduction = !isDev
const isFirefox = process.env.__FIREFOX__ === 'true'
const outDir = isFirefox ? resolve(rootDir, 'dist-firefox-v2') : resolve(rootDir, 'dist')

// ENABLE HMR IN BACKGROUND SCRIPT
const enableHmrInBackgroundScript = true

export default defineConfig({
  resolve: {
    alias: {
      '@/src': srcDir,
      '@/assets': assetsDir,
      '@/pages': pagesDir,
      '@/polyfills': resolve(srcDir, 'polyfills'),
      '@/lib': resolve(srcDir, 'lib'),
      '@/utils': resolve(srcDir, 'utils'),
      '@/hooks': resolve(srcDir, 'hooks'),
    },
  },
  plugins: [
    react(),
    makeManifest(manifest, {
      isDev,
      isFirefox,
      // contentScriptCssKey: regenerateCacheInvalidationKey(),
    }),
    customDynamicImport(),
    addHmr({ background: enableHmrInBackgroundScript, view: true }),
    watchRebuild(),
    nodePolyfills({
      // To add only specific polyfills, add them here. If no option is passed, adds all polyfills
      include: ['path'],
      // To exclude specific polyfills, add them to this list. Note: if include is provided, this has no effect
      exclude: [
        'fs', // Excludes the polyfill for `fs` and `node:fs`.
      ],
      // Whether to polyfill specific globals.
      globals: {
        Buffer: true, // can also be 'build', 'dev', or false
        global: true,
        process: true,
      },
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
  ],
  publicDir,
  build: {
    outDir,
    // sourcemap: isDev,
    minify: isProduction,
    reportCompressedSize: isProduction,
    rollupOptions: {
      input: {
        content: resolve(pagesDir, 'content', 'index.ts'),
        background: resolve(pagesDir, 'background', 'index.ts'),
        popup: resolve(pagesDir, 'popup', 'index.html'),
      },
      output: {
        entryFileNames: 'src/pages/[name]/index.js',
        chunkFileNames: isDev ? 'assets/js/[name].js' : 'assets/js/[name].[hash].js',
        assetFileNames: assetInfo => {
          // if (assetInfo.name === 'wm-polyfill.js') {
          //   return 'wm-polyfill.js'
          // }
          const { dir, name: _name } = path.parse(assetInfo.name)
          const assetFolder = dir.split('/').at(-1)
          const name = assetFolder + firstUpperCase(_name)
          // if (name === 'contentStyle') {
          //   return `assets/css/contentStyle${cacheInvalidationKey}.chunk.css`
          // }
          return `assets/[ext]/${name}.chunk.[ext]`
        },
      },
    },
  },
})

function firstUpperCase(str: string) {
  const firstAlphabet = new RegExp(/( |^)[a-z]/, 'g')
  return str.toLowerCase().replace(firstAlphabet, L => L.toUpperCase())
}

// let cacheInvalidationKey: string = generateKey()
// function regenerateCacheInvalidationKey() {
//   cacheInvalidationKey = generateKey()
//   return cacheInvalidationKey
// }
//
// function generateKey(): string {
//   return `${(Date.now() / 100).toFixed()}`
// }
