import type { BuildOptions, Plugin as ESBuildPlugin } from 'esbuild'
import type { BuildArgs } from './config'
import { getPlugins } from './plugins'
import { typecheckPlugin } from '@jgoz/esbuild-plugin-typecheck'
import webExt from 'web-ext'

export const getDevOptions = ({
  outDir,
  target,
  channel
}: Omit<BuildArgs, 'dev'> & {
  outDir: string
}): BuildOptions => {
  return {
    sourcemap: 'linked',
    metafile: false,
    minify: false,
    define: {
      NODE_ENV: JSON.stringify('development'),
      CONFIG_LOG_LEVEL: JSON.stringify('DEBUG'),
      CONFIG_PERMISSION_HOSTS: JSON.stringify({
        origins: ['http://*/*', 'https://*/*']
      }),
      CONFIG_ALLOWED_PROTOCOLS: JSON.stringify(['http:', 'https:']),
      CONFIG_OPEN_PAYMENTS_REDIRECT_URL: JSON.stringify(
        'https://webmonetization.org/welcome'
      )
    },
    plugins: getPlugins({ outDir, dev: true, target, channel }).concat([
      typecheckPlugin({ buildMode: 'readonly', watch: true }),
      liveReload({ outDir })
    ])
  }
}

function liveReload({outDir}): ESBuildPlugin {
  return {
    name: 'liveReload',
    setup(build) {
      webExt.cmd
        .run(
          {
            // These are command options derived from their CLI conterpart.
            // In this example, --source-dir is specified as sourceDir.
            sourceDir: outDir
          },
          {
            // These are non CLI related options for each function.
            // You need to specify this one so that your NodeJS application
            // can continue running after web-ext is finished.
            shouldExitProgram: false
          }
        )
        .then((extensionRunner) => {
          // The command has finished. Each command resolves its
          // promise with a different value.
          console.log(extensionRunner)
          // You can do a few things like:
          // extensionRunner.reloadAllExtensions();
          // extensionRunner.exit();
        })
    }
  }
}
