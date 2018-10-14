import parseArgs from 'minimist'
import consola from 'consola'
import { loadNuxtConfig } from '../common/utils'

export default async function dev() {
  const { Nuxt } = await import('@nuxtjs/core')
  const { Builder } = await import('@nuxtjs/builder')

  const argv = parseArgs(process.argv.slice(2), {
    alias: {
      h: 'help',
      H: 'hostname',
      p: 'port',
      c: 'config-file',
      s: 'spa',
      u: 'universal',
      v: 'version'
    },
    boolean: ['h', 's', 'u', 'v'],
    string: ['H', 'c'],
    default: {
      c: 'nuxt.config.js'
    }
  })

  if (argv.version) {
    process.stderr.write(version + '\n')
    process.exit(0)
  }

  if (argv.hostname === '') {
    consola.fatal('Provided hostname argument has no value')
  }

  if (argv.help) {
    process.stderr.write(`
    Description
      Starts the application in development mode (hot-code reloading, error
      reporting, etc)
    Usage
      $ nuxt dev <dir> -p <port number> -H <hostname>
    Options
      --port, -p          A port number on which to start the application
      --hostname, -H      Hostname on which to start the application
      --spa               Launch in SPA mode
      --universal         Launch in Universal mode (default)
      --config-file, -c   Path to Nuxt.js config file (default: nuxt.config.js)
      --help, -h          Displays this message
  `)
    process.exit(0)
  }

  const config = () => {
    // Force development mode for add hot reloading and watching changes
    return Object.assign(loadNuxtConfig(argv), { dev: true })
  }

  const errorHandler = (err, instance) => {
    instance && instance.builder.watchServer()
    consola.error(err)
  }

  // Start dev
  (function startDev(oldInstance) {
    let nuxt, builder

    try {
      nuxt = new Nuxt(config())
      builder = new Builder(nuxt)
      nuxt.hook('watch:fileChanged', (builder, fname) => {
        consola.debug(`[${fname}] changed, Rebuilding the app...`)
        startDev({ nuxt: builder.nuxt, builder })
      })
    } catch (err) {
      return errorHandler(err, oldInstance)
    }

    return (
      Promise.resolve()
        .then(() => oldInstance && oldInstance.nuxt.clearHook('watch:fileChanged'))
        .then(() => oldInstance && oldInstance.builder.unwatch())
        // Start build
        .then(() => builder.build())
        // Close old nuxt no mater if build successfully
        .catch((err) => {
          oldInstance && oldInstance.nuxt.close()
          // Jump to eventHandler
          throw err
        })
        .then(() => oldInstance && oldInstance.nuxt.close())
        // Start listening
        .then(() => nuxt.listen())
        // Show ready message first time, others will be shown through WebpackBar
        .then(() => !oldInstance && nuxt.showReady(false))
        .then(() => builder.watchServer())
        // Handle errors
        .catch(err => errorHandler(err, { builder, nuxt }))
    )
  })()
}
