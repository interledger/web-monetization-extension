import react from '@vitejs/plugin-react'
import path, { resolve } from 'path'
import { defineConfig } from 'vite'

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
