import { Configuration, DefinePlugin } from 'webpack'
import { DIRECTORIES, ROOT_DIR, Target, mainConfig } from './config'
import path from 'node:path'
import { getMainPlugins } from './plugins'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExtentionReloader = require('webpack-ext-reloader-mv3')

export const getDevConfig = (target: Target): Configuration => {
  return {
    ...mainConfig,
    output: {
      path: path.resolve(ROOT_DIR, `${DIRECTORIES.DEV}/${target}`),
      filename: '[name]/[name].js',
      clean: true
    },
    mode: 'development',
    devtool: 'inline-source-map',
    stats: {
      all: false,
      builtAt: true,
      errors: true,
      hash: true
    },
    watch: true,
    watchOptions: {
      aggregateTimeout: 200,
      poll: 1000
    },
    plugins: getMainPlugins(DIRECTORIES.DEV, target).concat(
      [
        new ExtentionReloader({
          port: 9090,
          reloadPage: true,
          entries: {
            contentScript: ['content'],
            background: 'background',
            extensionPage: ['popup', 'options']
          }
        })
      ],
      new DefinePlugin({
        CONFIG_LOG_LEVEL: JSON.stringify('DEBUG')
      })
    )
  }
}
