import path from 'path'
import TerserPlugin from 'terser-webpack-plugin'

import {
  config,
  Directories,
  getAnalyzerPlugins,
  getCleanWebpackPlugins,
  getCopyPlugins,
  getDefinePlugins,
  getEntry,
  getEslintPlugins,
  getExtensionManifestPlugins,
  getExtensionReloaderPlugins,
  getHTMLPlugins,
  getOutput,
  getProgressPlugins,
  getResolves,
  getZipPlugins,
} from './webpack.config.utils'

let generalConfig: any = {
  mode:
    config.NODE_ENV === 'production' || config.NODE_ENV === 'upload' ? 'production' : 'development',
  module: {
    rules: [
      {
        test: /\.css$/i,
        include: path.resolve(__dirname, 'src'),
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: {
                  tailwindcss: {},
                  autoprefixer: {},
                },
              },
            },
          },
        ],
      },
      {
        test: /\.(js|jsx|ts|tsx)$/,
        use: [
          {
            loader: 'ts-loader',
            // options: {
            //     transpileOnly: true,
            // },
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.scss$/,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
          },
          {
            loader: 'sass-loader',
          },
        ],
      },
    ],
  },
  resolve: getResolves(),
  entry: getEntry(Directories.SRC_DIR),
  output: getOutput(config.TARGET, config.OUTPUT_DIR),
}

let plugins: any[] = [
  ...getCleanWebpackPlugins(
    `${config.OUTPUT_DIR}/${config.TARGET}`,
    `${Directories.DIST_DIR}/${config.TARGET}`,
  ),
  ...getProgressPlugins(),
  ...getEslintPlugins(),
  ...getExtensionManifestPlugins(),
  ...getHTMLPlugins(config.TARGET, config.OUTPUT_DIR, Directories.SRC_DIR),
  ...getCopyPlugins(config.TARGET, config.OUTPUT_DIR, Directories.SRC_DIR),
]

if (config.NODE_ENV === 'development') {
  generalConfig = {
    ...generalConfig,
    devtool: 'source-map',
    stats: {
      all: false,
      builtAt: true,
      errors: true,
      hash: true,
    },
    watch: true,
    watchOptions: {
      aggregateTimeout: 200,
      poll: 1000,
    },
  }

  plugins = [
    ...plugins,
    ...getDefinePlugins({
      SIGNATURES_URL: 'http://localhost:3000',
      WM_WALLET_ADDRESS: 'https://ilp.rafiki.money/wm-dev',
    }),
    ...getExtensionReloaderPlugins(),
  ]
}

if (config.NODE_ENV === 'profile') {
  generalConfig = {
    ...generalConfig,
    devtool: 'source-map',
    stats: {
      all: false,
      builtAt: true,
      errors: true,
      hash: true,
    },
  }

  plugins = [
    ...plugins,
    ...getDefinePlugins({
      SIGNATURES_URL: 'http://localhost:3000',
      WM_WALLET_ADDRESS: 'https://ilp.rafiki.money/wm-dev',
    }),
    ...getAnalyzerPlugins(),
  ]
}

if (config.NODE_ENV === 'production') {
  generalConfig = {
    ...generalConfig,
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          parallel: true,
          terserOptions: {
            format: {
              comments: false,
            },
          },
          extractComments: false,
        }),
      ],
    },
  }

  plugins = [
    ...plugins,
    ...getDefinePlugins({
      SIGNATURES_URL: 'https://europe-west3-rafiki-testnet.cloudfunctions.net/sign',
      WM_WALLET_ADDRESS: 'https://ilp.rafiki.money/interledger',
    }),

    ...getZipPlugins(config.TARGET, Directories.DIST_DIR),
  ]
}

export default [
  {
    ...generalConfig,
    plugins,
  },
]
