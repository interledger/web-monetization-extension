import { Configuration, DefinePlugin } from 'webpack'
import { DIRECTORIES, ROOT_DIR, Target, mainConfig } from './config'
import path from 'node:path'
import { getMainPlugins } from './plugins'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'

export const getProfileConfig = (target: Target): Configuration => {
  return {
    ...mainConfig,
    output: {
      path: path.resolve(ROOT_DIR, `${DIRECTORIES.TEMP}/${target}`),
      filename: '[name]/[name].js',
      clean: true
    },
    mode: 'production',
    devtool: 'source-map',
    stats: {
      all: false,
      builtAt: true,
      errors: true,
      hash: true
    },
    plugins: getMainPlugins(DIRECTORIES.DEV, target).concat([
      new BundleAnalyzerPlugin({
        analyzerMode: 'server'
      }),
      new DefinePlugin({
        CONFIG_LOG_LEVEL: JSON.stringify('DEBUG')
      })
    ])
  }
}
