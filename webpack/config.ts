/* eslint-disable no-console */
import path from 'node:path'
import { Configuration } from 'webpack'

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
      url: require.resolve('url/'),
      util: require.resolve('util/'),
      assert: require.resolve('assert/'),
      querystring: require.resolve('querystring-es3'),
      constants: require.resolve('constants-browserify'),
      buffer: require.resolve('buffer/'),
      zlib: require.resolve('browserify-zlib'),
      stream: require.resolve('stream-browserify'),
      http: require.resolve('stream-http'),
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
    contentStatic: [
      path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/content/static/index.ts`)
    ],
    background: [
      path.resolve(ROOT_DIR, `${DIRECTORIES.SRC}/background/index.ts`)
    ]
  }
}

export type Target = (typeof TARGETS)[number]
