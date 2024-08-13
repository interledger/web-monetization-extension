/* eslint-disable no-console */
import path from 'node:path'
import { Configuration, Stats } from 'webpack'

export const TARGETS = ['chrome', 'firefox'] as const
export const ROOT_DIR = path.resolve(__dirname, '..')
export const DIRECTORIES = {
  DEV: './dev',
  DIST: './dist',
  TEMP: './temp',
  SRC: './src'
}

export const MANIFEST_PATH = path.resolve(
  ROOT_DIR,
  `${DIRECTORIES.SRC}/manifest.json`
)
export const OUTPUT_DIR =
  process.env.NODE_ENV === 'production'
    ? path.resolve(ROOT_DIR, DIRECTORIES.DIST)
    : path.resolve(ROOT_DIR, DIRECTORIES.DEV)

export const mainConfig: Configuration = {
  module: {
    rules: [
      {
        test: /\.css$/i,
        include: path.resolve(ROOT_DIR, DIRECTORIES.SRC),
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
