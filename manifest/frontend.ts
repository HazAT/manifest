import path from 'path'
import fs from 'fs'

interface FrontendConfig {
  entryPoint: string
  outputDir: string
  sourceMaps: boolean
  spaFallback: boolean
  devReload: boolean
  copyHtml: boolean
  bundleCss?: boolean
  postBuild?: string
  watchDirs?: string[]
}

export interface BuildResult {
  success: boolean
  outputs: string[]
  errors: string[]
}

async function loadConfig(projectDir: string): Promise<FrontendConfig> {
  const configPath = path.resolve(projectDir, 'config/frontend.ts')
  const mod = await import(configPath)
  return mod.default
}

function copyPublicDir(projectDir: string, outDir: string) {
  const publicDir = path.resolve(projectDir, 'frontend/public')
  if (!fs.existsSync(publicDir)) return
  fs.cpSync(publicDir, outDir, { recursive: true })
}

export async function buildFrontend(projectDir: string): Promise<BuildResult> {
  const config = await loadConfig(projectDir)
  const outDir = path.resolve(projectDir, config.outputDir)
  const entryPoint = path.resolve(projectDir, config.entryPoint)
  const isProd = process.env.NODE_ENV === 'production'

  let result: Awaited<ReturnType<typeof Bun.build>>
  try {
    result = await Bun.build({
      entrypoints: [entryPoint],
      outdir: outDir,
      target: 'browser',
      sourcemap: config.sourceMaps ? 'linked' : 'none',
      minify: isProd,
      naming: '[dir]/[name].[ext]',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Build error: ${msg}`)
    return { success: false, outputs: [], errors: [msg] }
  }

  // Copy HTML files from frontend/ to outDir
  if (config.copyHtml !== false) {
    const frontendDir = path.resolve(projectDir, 'frontend')
    for (const entry of fs.readdirSync(frontendDir)) {
      if (entry.endsWith('.html')) {
        fs.copyFileSync(path.join(frontendDir, entry), path.join(outDir, entry))
      }
    }
  }

  copyPublicDir(projectDir, outDir)

  // Filter out CSS files if bundleCss is false
  let filteredOutputs = result.outputs
  if (config.bundleCss === false) {
    for (const o of result.outputs) {
      if (o.path.endsWith('.css') || o.path.endsWith('.css.map')) {
        try { fs.unlinkSync(o.path) } catch {}
      }
    }
    filteredOutputs = result.outputs.filter(
      (o) => !o.path.endsWith('.css') && !o.path.endsWith('.css.map')
    )
  }

  const outputs = filteredOutputs.map((o) => {
    const rel = path.relative(projectDir, o.path)
    const kb = (o.size / 1024).toFixed(1)
    console.log(`  ${rel} (${kb} kB)`)
    return rel
  })

  if (!result.success) {
    for (const log of result.logs) console.error(`  Build error: ${log.message}`)
    return { success: false, outputs, errors: result.logs.map((l) => l.message) }
  }

  // Run post-build command if configured
  if (config.postBuild) {
    const proc = Bun.spawnSync(['sh', '-c', config.postBuild], {
      cwd: projectDir,
      stdout: 'inherit',
      stderr: 'inherit',
    })
    if (proc.exitCode !== 0) {
      return { success: false, outputs, errors: [`Post-build command failed with exit code ${proc.exitCode}`] }
    }
  }

  return { success: true, outputs, errors: [] }
}

// Module-level state for watch deduplication (survives hot reload)
let _watchActive = false
let _buildInProgress = false

export async function watchFrontend(projectDir: string, onRebuild?: () => void) {
  // Prevent duplicate watchers from hot reload re-executing this
  if (_watchActive) return
  _watchActive = true

  const config = await loadConfig(projectDir)
  try {
    await buildFrontend(projectDir)
  } catch (err) {
    console.error('[frontend] initial build failed:', err instanceof Error ? err.message : err)
  }
  console.log('[frontend] watching for changes...')

  const frontendDir = path.resolve(projectDir, 'frontend')
  let timeout: ReturnType<typeof setTimeout> | null = null

  const scheduleRebuild = () => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(async () => {
      if (_buildInProgress) return
      _buildInProgress = true
      try {
        const start = performance.now()
        const result = await buildFrontend(projectDir)
        const ms = Math.round(performance.now() - start)
        console.log(`[frontend] rebuilt in ${ms}ms`)
        if (result.success && onRebuild) onRebuild()
      } catch (err) {
        console.error('[frontend] rebuild failed:', err instanceof Error ? err.message : err)
      } finally {
        _buildInProgress = false
      }
    }, 100)
  }

  fs.watch(frontendDir, { recursive: true }, (_event, filename) => {
    if (filename && (filename.startsWith('public/') || filename.includes('/public/'))) return
    scheduleRebuild()
  })

  for (const dir of config.watchDirs ?? []) {
    const watchDir = path.resolve(projectDir, dir)
    if (fs.existsSync(watchDir)) {
      fs.watch(watchDir, { recursive: true }, () => scheduleRebuild())
    }
  }
}

function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

export function createStaticHandler(distDir: string, options: { spaFallback: boolean }) {
  const resolvedDistDir = path.resolve(distDir)

  return (pathname: string): Response | null => {
    // Never serve hidden files
    if (pathname.split('/').some((s) => s.startsWith('.'))) return null

    // Never serve API routes — let the API handler deal with them
    if (pathname.startsWith('/api/')) return null

    const filePath = path.resolve(resolvedDistDir, pathname.slice(1))

    // Path traversal guard: ensure resolved path stays within distDir
    if (!filePath.startsWith(resolvedDistDir + '/') && filePath !== resolvedDistDir) return null

    if (isFile(filePath)) {
      const file = Bun.file(filePath)
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache' }
      const mimeType = file.type
      if (mimeType && mimeType.startsWith('text/') && !mimeType.includes('charset')) {
        headers['Content-Type'] = `${mimeType}; charset=utf-8`
      }
      return new Response(file, { headers })
    }

    // Directory → index.html resolution
    const indexFilePath = path.join(filePath, 'index.html')
    if (isFile(indexFilePath)) {
      return new Response(Bun.file(indexFilePath), { headers: { 'Cache-Control': 'no-cache' } })
    }

    if (options.spaFallback) {
      const indexPath = path.join(distDir, 'index.html')
      if (isFile(indexPath)) {
        return new Response(Bun.file(indexPath), { headers: { 'Cache-Control': 'no-cache' } })
      }
    }

    return null
  }
}
