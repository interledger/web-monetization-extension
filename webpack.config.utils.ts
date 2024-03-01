import { CleanWebpackPlugin } from 'clean-webpack-plugin'
import CopyWebpackPlugin from 'copy-webpack-plugin'
import ESLintPlugin from 'eslint-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import path from 'path'
import { DefinePlugin, ProgressPlugin } from 'webpack'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import WebpackExtensionManifestPlugin from 'webpack-extension-manifest-plugin'
import ZipPlugin from 'zip-webpack-plugin'

const ExtReloader = require('webpack-ext-reloader-mv3')

const manifestChrome = require('./src/manifest/chrome.json')
const manifestFirefox = require('./src/manifest/firefox.json')
const manifestOpera = require('./src/manifest/opera.json')
const manifestEdge = require('./src/manifest/edge.json')

const manifest = {
  chrome: manifestChrome,
  firefox: manifestFirefox,
  opera: manifestOpera,
  edge: manifestEdge,
}

const dotenv = require('dotenv').config({ path: __dirname + '/.env' })

interface EnvironmentConfig {
  NODE_ENV: string
  OUTPUT_DIR: string
  TARGET: string
}

export const Directories = {
  DEV_DIR: 'dev',
  DIST_DIR: 'dist',
  TEMP_DIR: 'temp',
  SRC_DIR: 'src',
}

/**
 * Environment Config
 *
 */
const EnvConfig: EnvironmentConfig = {
  OUTPUT_DIR:
    process.env.NODE_ENV === 'production'
      ? Directories.TEMP_DIR
      : process.env.NODE_ENV === 'upload'
        ? Directories.DIST_DIR
        : Directories.DEV_DIR,
  ...(process.env.NODE_ENV ? { NODE_ENV: process.env.NODE_ENV } : { NODE_ENV: 'development' }),
  ...(process.env.TARGET ? { TARGET: process.env.TARGET } : { TARGET: 'chrome-v3' }),
}

/**
 * Get HTML Plugins
 *
 * @param browserDir
 * @param outputDir
 * @param sourceDir
 * @returns
 */
export const getHTMLPlugins = (
  browserDir: string,
  outputDir = Directories.DEV_DIR,
  sourceDir = Directories.SRC_DIR,
) => [
  new HtmlWebpackPlugin({
    title: 'Popup',
    filename: path.resolve(__dirname, `${outputDir}/${browserDir}/popup/index.html`),
    template: path.resolve(__dirname, `${sourceDir}/popup/index.html`),
    chunks: ['popup'],
  }),
]

/**
 * Get DefinePlugins
 *
 * @param config
 * @returns
 */
export const getDefinePlugins = (config: { SIGNATURES_URL: string; WM_WALLET_ADDRESS: string }) => [
  new DefinePlugin({
    CONFIG_SIGNATURES_URL: JSON.stringify(config.SIGNATURES_URL),
    CONFIG_WM_WALLET_ADDRESS: JSON.stringify(config.WM_WALLET_ADDRESS),
  }),
]

/**
 * Get Output Configurations
 *
 * @param browserDir
 * @param outputDir
 * @returns
 */
export const getOutput = (browserDir: string, outputDir = Directories.DEV_DIR) => {
  return {
    path: path.resolve(process.cwd(), `${outputDir}/${browserDir}`),
    filename: '[name]/[name].js',
  }
}

/**
 * Get Entry Points
 *
 * @param sourceDir
 * @returns
 */
export const getEntry = (sourceDir = Directories.SRC_DIR) => {
  return {
    popup: [path.resolve(__dirname, `${sourceDir}/popup/index.tsx`)],
    content: [path.resolve(__dirname, `${sourceDir}/content/index.ts`)],
    contentStatic: [path.resolve(__dirname, `${sourceDir}/content/static/index.ts`)],
    background: [path.resolve(__dirname, `${sourceDir}/background/index.ts`)],
  }
}

/**
 * Get CopyPlugins
 *
 * @param browserDir
 * @param outputDir
 * @param sourceDir
 * @returns
 */
export const getCopyPlugins = (
  browserDir: string,
  outputDir = Directories.DEV_DIR,
  sourceDir = Directories.SRC_DIR,
) => {
  return [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, `${sourceDir}/assets`),
          to: path.resolve(__dirname, `${outputDir}/${browserDir}/assets`),
        },
        {
          from: path.resolve(__dirname, `${sourceDir}/_locales`),
          to: path.resolve(__dirname, `${outputDir}/${browserDir}/_locales`),
        },
        // Bundle OpenAPI schemas - the Open Payments client is using them to
        // validate responses.
        {
          from: path.resolve(__dirname, 'node_modules/@interledger/open-payments/dist/openapi'),
          to: path.resolve(__dirname, `${outputDir}/${browserDir}/openapi`),
          globOptions: {
            ignore: ['**/generated/**'],
          },
        },
      ],
    }),
  ]
}

/**
 * Get ZipPlugins
 *
 * @param browserDir
 * @param outputDir
 * @returns
 */
export const getZipPlugins = (browserDir: string, outputDir = Directories.DIST_DIR) => {
  return [
    new ZipPlugin({
      path: path.resolve(process.cwd(), `${outputDir}/${browserDir}`),
      filename: browserDir,
      extension: 'zip',
      fileOptions: {
        mtime: new Date(),
        mode: 0o100664,
        compress: true,
        forceZip64Format: false,
      },
      zipOptions: {
        forceZip64Format: false,
      },
    }),
  ]
}

/**
 * Get Analyzer Plugins
 *
 * @returns
 */
export const getAnalyzerPlugins = () => {
  return [
    new BundleAnalyzerPlugin({
      analyzerMode: 'server',
    }),
  ]
}

/**
 * Get CleanWebpackPlugins
 *
 * @param dirs
 * @returns
 */
export const getCleanWebpackPlugins = (...dirs: string[]) => {
  return [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [
        ...(dirs ? dirs.map(dir => path.join(process.cwd(), `${dir}`)) : []),
      ],
      cleanStaleWebpackAssets: false,
      verbose: true,
    }),
  ]
}

/**
 * Get Resolves
 *
 * @returns
 */
export const getResolves = () => {
  return {
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
      async_hooks: false,
    },
    alias: {
      '@/shared': path.resolve(__dirname, './src/shared/'),
      '@/popup': path.resolve(__dirname, './src/popup/'),
      '@/background': path.resolve(__dirname, './src/background/'),
      '@/content': path.resolve(__dirname, './src/content/'),
      '@/assets': path.resolve(__dirname, './src/assets/'),
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  }
}

/**
 * Get Extension Manifest Plugins
 *
 * @returns
 */
export const getExtensionManifestPlugins = () => {
  return [
    new WebpackExtensionManifestPlugin({
      config: { base: (manifest as any)[EnvConfig.TARGET] },
    }),
  ]
}

export const eslintOptions = {
  fix: true,
}

/**
 * Get Eslint Plugins
 *
 * @returns
 */
export const getEslintPlugins = (options = eslintOptions) => {
  return [new ESLintPlugin(options)]
}

/**
 * Get Progress Plugins
 *
 * @returns
 */
export const getProgressPlugins = () => {
  return [new ProgressPlugin()]
}

/**
 * Environment Configuration Variables
 *
 */
export const config = EnvConfig

/**
 * Get Extension Reloader Plugin
 *
 * @returns
 */
export const getExtensionReloaderPlugins = () => {
  return [
    new ExtReloader({
      port: 9090,
      reloadPage: true,
      entries: {
        contentScript: ['content'],
        background: 'background',
        extensionPage: ['popup', 'options'],
      },
    }),
  ]
}
