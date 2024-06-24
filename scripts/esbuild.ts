import path from 'node:path'
import { readFileSync } from 'node:fs'
import esbuild from 'esbuild'
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill'

export const ROOT_DIR = path.resolve(__dirname, '..')

void esbuild.build({
  bundle: true,
  sourcemap: 'linked',
  logLevel: 'info',
  outdir: 'dev/chrome',
  entryPoints: [
    {
      in: 'src/content/index.ts',
      out: 'content/content'
    },
    {
      in: 'src/background/index.ts',
      out: 'background/background'
    }
  ],
  platform: 'browser',
  format: 'iife',
  legalComments: 'external',
  plugins: [
    nodeModulesPolyfillPlugin({}),
    ignorePackagePlugin([/@apidevtools\/json-schema-ref-parser/]),
    dirnamePlugin()
  ],
  alias: {
    '@/shared': path.resolve(ROOT_DIR, `src/shared/`),
    '@/popup': path.resolve(ROOT_DIR, `src/popup/`),
    '@/background': path.resolve(ROOT_DIR, `src/background/`),
    '@/content': path.resolve(ROOT_DIR, `src/content/`),
    '@/assets': path.resolve(ROOT_DIR, `src/assets/`)
  },
  define: {
    NODE_ENV: JSON.stringify('development'),
    CONFIG_LOG_LEVEL: JSON.stringify('DEBUG'),
    CONFIG_PERMISSION_HOSTS: JSON.stringify({
      origins: ['http://*/*', 'https://*/*']
    }),
    CONFIG_ALLOWED_PROTOCOLS: JSON.stringify(['http:', 'https:'])
  }
})

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

function dirnamePlugin(): esbuild.Plugin {
  const nodeModules = new RegExp(/^(?:.*[\\/])?node_modules(?:[\\/].*)?$/)

  return {
    name: 'dirname',
    setup(build) {
      build.onLoad({ filter: /.*/ }, ({ path: filePath }) => {
        if (!filePath.match(nodeModules)) {
          let contents = readFileSync(filePath, 'utf8')
          const loader = path.extname(filePath).substring(1) as esbuild.Loader
          const dirname = path.dirname(filePath)
          contents = contents
            .replace('__dirname', `"${dirname}"`)
            .replace('__filename', `"${filePath}"`)
          return { contents, loader }
        }
      })
    }
  }
}
