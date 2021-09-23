import { cac } from 'cac'
import chalk from 'chalk'
import { BuildOptions } from './build'
import { ServerOptions } from './server'
import { createLogger, LogLevel } from './logger'
import { resolveConfig } from '.'
import { preview } from './preview'

const cli = cac('vite')

// global options
interface GlobalCLIOptions {
  '--'?: string[]
  debug?: boolean | string
  d?: boolean | string
  filter?: string
  f?: string
  config?: string
  c?: boolean | string
  root?: string
  base?: string
  r?: string
  mode?: string
  m?: string
  logLevel?: LogLevel
  l?: LogLevel
  clearScreen?: boolean
}

/**
 * removing global flags before passing as command specific sub-configs
 */
function cleanOptions(options: GlobalCLIOptions) {
  const ret = { ...options }
  delete ret['--']
  delete ret.debug
  delete ret.d
  delete ret.filter
  delete ret.f
  delete ret.config
  delete ret.c
  delete ret.root
  delete ret.base
  delete ret.r
  delete ret.mode
  delete ret.m
  delete ret.logLevel
  delete ret.l
  delete ret.clearScreen
  return ret
}

cli
  // 指定配置文件
  .option('-c, --config <file>', `[string] use specified config file`)
  // 指定项目根目录
  .option('-r, --root <path>', `[string] use specified root directory`)
  // 指定 base 目录
  .option('--base <path>', `[string] public base path (default: /)`)
  // 指定 日志 级别
  .option('-l, --logLevel <level>', `[string] silent | error | warn | all`)
  // 
  .option('--clearScreen', `[boolean] allow/disable clear screen when logging`)
  // 输出 debug 日志
  .option('-d, --debug [feat]', `[string | boolean] show debug logs`)
  // 过滤日志
  .option('-f, --filter <filter>', `[string] filter debug logs`)

// dev
cli
  // 开发命令
  // 设置别名 serve 
  // @example:
  // vite
  // vite serve
  .command('[root]') // default command
  .alias('serve')
  // 服务器
  .option('--host <host>', `[string] specify hostname`)
  // 端口
  .option('--port <port>', `[number] specify port`)
  // 是否开启 https
  .option('--https', `[boolean] use TLS + HTTP/2`)
  // 开启浏览器
  .option('--open [path]', `[boolean | string] open browser on startup`)
  // 是否允许跨域
  .option('--cors', `[boolean] enable CORS`)
  // 严格设置端口，如果占用就立即退出
  .option('--strictPort', `[boolean] exit if specified port is already in use`)
  // 模式
  .option('-m, --mode <mode>', `[string] set env mode`)
  // 强制不保留缓存
  .option(
    '--force',
    `[boolean] force the optimizer to ignore the cache and re-bundle`
  )
  .action(async (root: string, options: ServerOptions & GlobalCLIOptions) => {
    // output structure is preserved even after bundling so require()
    // is ok here
    const { createServer } = await import('./server')
    try {
      // 创建服务器
      const server = await createServer({
        root,
        base: options.base,
        mode: options.mode,
        configFile: options.config,
        logLevel: options.logLevel,
        clearScreen: options.clearScreen,
        server: cleanOptions(options) as ServerOptions
      })
      // 监听
      await server.listen()
    } catch (e) {
      createLogger(options.logLevel).error(
        chalk.red(`error when starting dev server:\n${e.stack}`)
      )
      process.exit(1)
    }
  })

// build
cli
  // 构建命令
  // @example
  // vite build
  .command('build [root]')
  // 目标
  .option('--target <target>', `[string] transpile target (default: 'modules')`)
  // 输出目录
  .option('--outDir <dir>', `[string] output directory (default: dist)`)
  // 资源文件目录
  .option(
    '--assetsDir <dir>',
    `[string] directory under outDir to place assets in (default: _assets)`
  )
  .option(
    '--assetsInlineLimit <number>',
    `[number] static asset base64 inline threshold in bytes (default: 4096)`
  )
  // 服务端渲染
  .option(
    '--ssr [entry]',
    `[string] build specified entry for server-side rendering`
  )
  // 是否保留调试Map
  .option(
    '--sourcemap',
    `[boolean] output source maps for build (default: false)`
  )
  // 是否压缩
  .option(
    '--minify [minifier]',
    `[boolean | "terser" | "esbuild"] enable/disable minification, ` +
      `or specify minifier to use (default: terser)`
  )
  .option('--manifest', `[boolean] emit build manifest json`)
  .option('--ssrManifest', `[boolean] emit ssr manifest json`)
  .option(
    '--emptyOutDir',
    `[boolean] force empty outDir when it's outside of root`
  )
  .option('-m, --mode <mode>', `[string] set env mode`)
  .action(async (root: string, options: BuildOptions & GlobalCLIOptions) => {
    const { build } = await import('./build')
    const buildOptions = cleanOptions(options) as BuildOptions

    try {
      await build({
        root,
        base: options.base,
        mode: options.mode,
        configFile: options.config,
        logLevel: options.logLevel,
        clearScreen: options.clearScreen,
        build: buildOptions
      })
    } catch (e) {
      createLogger(options.logLevel).error(
        chalk.red(`error during build:\n${e.stack}`)
      )
      process.exit(1)
    }
  })

// optimize
cli
  .command('optimize [root]')
  .option(
    '--force',
    `[boolean] force the optimizer to ignore the cache and re-bundle`
  )
  .action(
    async (root: string, options: { force?: boolean } & GlobalCLIOptions) => {
      const { optimizeDeps } = await import('./optimizer')
      try {
        const config = await resolveConfig(
          {
            root,
            base: options.base,
            configFile: options.config,
            logLevel: options.logLevel
          },
          'build',
          'development'
        )
        await optimizeDeps(config, options.force, true)
      } catch (e) {
        createLogger(options.logLevel).error(
          chalk.red(`error when optimizing deps:\n${e.stack}`)
        )
        process.exit(1)
      }
    }
  )

cli
  .command('preview [root]')
  .option('--port <port>', `[number] specify port`)
  .option('--open [path]', `[boolean | string] open browser on startup`)
  .action(
    async (
      root: string,
      options: { port?: number; open?: boolean | string } & GlobalCLIOptions
    ) => {
      try {
        const config = await resolveConfig(
          {
            root,
            base: options.base,
            configFile: options.config,
            logLevel: options.logLevel,
            server: {
              open: options.open
            }
          },
          'serve',
          'development'
        )
        await preview(config, options.port)
      } catch (e) {
        createLogger(options.logLevel).error(
          chalk.red(`error when starting preview server:\n${e.stack}`)
        )
        process.exit(1)
      }
    }
  )

cli.help()
cli.version(require('../../package.json').version)

cli.parse()
