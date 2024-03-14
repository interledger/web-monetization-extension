import { Configuration } from 'webpack'
import { DIRECTORIES, ROOT_DIR, Target, mainConfig } from './config'
import path from 'node:path'
import { getMainPlugins } from './plugins'
import TerserPlugin from 'terser-webpack-plugin'
import ZipPlugin from 'zip-webpack-plugin'

export const getProdConfig = (target: Target): Configuration => {
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
      })
    ])
  }
}
