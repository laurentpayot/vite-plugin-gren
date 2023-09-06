/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-ignore
import { toESModule } from './dependencies/gren-esm'
//@ts-ignore
import compiler from './dependencies/node-gren-compiler'
import { normalize, relative, dirname } from 'path'
import type { ModuleNode, Plugin } from 'vite'
import findUp from 'find-up'
import { injectAssets } from './assetsInjector'
import { injectHMR } from './hmrInjector'
import { acquireLock } from './mutex'
/* eslint-enable @typescript-eslint/ban-ts-comment */

const trimDebugMessage = (code: string): string => code.replace(/(console\.warn\('Compiled in DEBUG mode)/, '// $1')
const viteProjectPath = (dependency: string) => `/${relative(process.cwd(), dependency)}`

const parseImportId = (id: string) => {
  const parsedId = new URL(id, 'file://')
  const pathname = parsedId.pathname
  const valid = pathname.endsWith('.gren') && !parsedId.searchParams.has('raw')
  const withParams = parsedId.searchParams.getAll('with')

  return {
    valid,
    pathname,
    withParams,
  }
}

const findClosestGrenJson = async (pathname: string) => {
  const grenJson = await findUp('gren.json', { cwd: dirname(pathname) })
  return grenJson ? dirname(grenJson) : undefined
}

type NodeGrenCompilerOptions = {
  cwd?: string
  docs?: string
  debug?: boolean
  optimize?: boolean
  processOpts?: Record<string, string>
  report?: string
  pathToGren?: string
  verbose?: boolean
}

export const plugin = (opts?: {
  debug?: boolean
  optimize?: boolean
  nodeGrenCompilerOptions: NodeGrenCompilerOptions
}): Plugin => {
  const compilableFiles: Map<string, Set<string>> = new Map()
  const debug = opts?.debug
  const optimize = opts?.optimize
  const compilerOptionsOverwrite = opts?.nodeGrenCompilerOptions ?? {}

  return {
    name: 'vite-plugin-gren',
    enforce: 'pre',
    handleHotUpdate({ file, server, modules }) {
      const { valid } = parseImportId(file)
      if (!valid) return

      const modulesToCompile: ModuleNode[] = []
      compilableFiles.forEach((dependencies, compilableFile) => {
        if (dependencies.has(normalize(file))) {
          const module = server.moduleGraph.getModuleById(compilableFile)
          if (module) modulesToCompile.push(module)
        }
      })

      if (modulesToCompile.length > 0) {
        server.ws.send({
          type: 'custom',
          event: 'hot-update-dependents',
          data: modulesToCompile.map(({ url }) => url),
        })
        return modulesToCompile
      } else {
        return modules
      }
    },
    async load(id) {
      const { valid, pathname, withParams } = parseImportId(id)
      if (!valid) return

      const accompanies = await (() => {
        if (withParams.length > 0) {
          const importTree = this.getModuleIds()
          let importer = ''
          for (const moduleId of importTree) {
            if (moduleId === id) break
            importer = moduleId
          }
          const resolveAcoompany = async (accompany: string) => (await this.resolve(accompany, importer))?.id ?? ''
          return Promise.all(withParams.map(resolveAcoompany))
        } else {
          return Promise.resolve([])
        }
      })()

      const targets = [pathname, ...accompanies].filter((target) => target !== '')

      compilableFiles.delete(id)
      const dependencies = (
        await Promise.all<string[]>(targets.map((target) => compiler.findAllDependencies(target) as string[]))
      ).flat()
      compilableFiles.set(id, new Set([...accompanies, ...dependencies]))

      const releaseLock = await acquireLock()
      try {
        const isBuild = process.env.NODE_ENV === 'production'
        const compiled: string = await compiler.compileToString(targets, {
          output: '.js',
          optimize: typeof optimize === 'boolean' ? optimize : !debug && isBuild,
          verbose: isBuild,
          debug: debug ?? !isBuild,
          cwd: await findClosestGrenJson(pathname),
          ...compilerOptionsOverwrite,
        })

        const esm = injectAssets(toESModule(compiled))

        // Apparently `addWatchFile` may not exist: https://github.com/hmsk/vite-plugin-gren/pull/36
        if (this.addWatchFile) {
          dependencies.forEach(this.addWatchFile.bind(this))
        }

        return {
          code: isBuild ? esm : trimDebugMessage(injectHMR(esm, dependencies.map(viteProjectPath))),
          map: null,
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('-- NO MAIN')) {
          const message = `${viteProjectPath(
            pathname,
          )}: NO MAIN .gren file is requested to transform by vite. Probably, this file is just a depending module`
          throw message
        } else {
          throw e
        }
      } finally {
        releaseLock()
      }
    },
  }
}

export default plugin
