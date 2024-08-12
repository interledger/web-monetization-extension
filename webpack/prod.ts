import { Configuration, DefinePlugin } from 'webpack'
import { DIRECTORIES, ROOT_DIR, mainConfig, type Target } from './config'
import path from 'node:path'
import { getMainPlugins } from './plugins'
import TerserPlugin from 'terser-webpack-plugin'
import ZipPlugin from 'zip-webpack-plugin'

export const getProdConfig = (target: Target): Configuration => {
  process.env.NODE_ENV = 'production'
  return {
    ...mainConfig,
    output: {
      path: path.resolve(ROOT_DIR, `${DIRECTORIES.DIST}/${target}`),
      filename: '[name]/[name].js',
      clean: true
    },
    mode: 'production',
    devtool: undefined,
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          parallel: true,
          terserOptions: {
            mangle: true,
            format: {
              comments: false
            }
          },
          extractComments: false
        })
      ]
    },
    plugins: getMainPlugins(DIRECTORIES.DIST, target).concat([
      new ZipPlugin({
        path: path.resolve(ROOT_DIR, `${DIRECTORIES.DIST}`),
        filename: target,
        extension: 'zip',
        fileOptions: {
          mtime: new Date(),
          mode: 0o100664,
          compress: true,
          forceZip64Format: false
        },
        zipOptions: {
          forceZip64Format: false
        }
      }),
      new DefinePlugin({
        CONFIG_LOG_LEVEL: JSON.stringify('WARN'),
        CONFIG_PERMISSION_HOSTS: JSON.stringify({ origins: ['https://*/*'] }),
        CONFIG_ALLOWED_PROTOCOLS: JSON.stringify(['https:']),
        CONFIG_OPEN_PAYMENTS_REDIRECT_URL: JSON.stringify(
          'https://webmonetization.org/welcome'
        )
      })
    ])
  }
}
