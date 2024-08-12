/* eslint-disable no-console */
import path from 'node:path'
import { Configuration, Stats } from 'webpack'

export const TARGETS = ['chrome', 'firefox', 'opera', 'edge'] as const
export const ROOT_DIR = path.resolve(__dirname, '..')

const DIR_SRC = path.resolve(ROOT_DIR, 'src')
const DIR_DEV = path.resolve(ROOT_DIR, 'dev')
const DIR_DIST = path.resolve(ROOT_DIR, 'dist')

export const IS_PRODUCTION = process.env.NODE_ENV === 'production'

export const MANIFEST_PATH = path.join(DIR_SRC, 'manifest.json')
export const OUTPUT_DIR =
  process.env.NODE_ENV === 'production' ? DIR_DIST : DIR_DEV

export const mainConfig: Configuration = {
  module: {
    rules: [
      {
        test: /\.css$/i,
        include: DIR_SRC,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: {
                  tailwindcss: {},
                  autoprefixer: {}
                }
              }
            }
          }
        ]
      },
      {
        test: /\.(js|jsx|ts|tsx)$/,
        use: [
          {
            loader: 'ts-loader'
          }
        ],
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    fallback: {
      events: require.resolve('events/'),
      crypto: require.resolve('crypto-browserify'),
      path: require.resolve('path-browserify'),
      constants: require.resolve('constants-browserify'),
      buffer: require.resolve('buffer/'),
      stream: require.resolve('stream-browserify'),
      util: require.resolve('util/'),
      process: false,
      fs: false,
      net: false,
      async_hooks: false
    },
    alias: {
      '@/shared': path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/shared/`),
      '@/popup': path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/popup/`),
      '@/background': path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/background/`),
      '@/content': path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/content/`),
      '@/assets': path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/assets/`)
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  },
  entry: {
    popup: [path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/popup/index.tsx`)],
    content: [path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/content/index.ts`)],
    polyfill: [
      path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/content/polyfill.ts`)
    ],
    background: [
      path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/background/index.ts`)
    ]
  }
}

export const callbackFn = (_: Error | null, stats: Stats | undefined) => {
  if (!stats) return
  if (stats.hasErrors()) {
    console.log(stats.compilation.errors)
    process.exit(1)
  } else {
    console.log('Compilation complete', `${stats.endTime - stats.startTime}ms`)
  }
}

export type Target = (typeof TARGETS)[number]
