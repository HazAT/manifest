import path from 'path'
import fs from 'fs'

interface FrontendConfig {
  entryPoint: string
  outputDir: string
  sourceMaps: boolean
  spaFallback: boolean
  devReload: boolean
  copyHtml: boolean
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

  const result = await Bun.build({
    entrypoints: [entryPoint],
    outdir: outDir,
    target: 'browser',
    sourcemap: config.sourceMaps ? 'linked' : 'none',
    minify: isProd,
    naming: '[dir]/[name].[ext]',
  })

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

  const outputs = result.outputs.map((o) => {
    const rel = path.relative(projectDir, o.path)
    const kb = (o.size / 1024).toFixed(1)
    console.log(`  ${rel} (${kb} kB)`)
    return rel
  })

  if (!result.success) {
    for (const log of result.logs) console.error(`  Build error: ${log.message}`)
  }

  return { success: result.success, outputs, errors: result.logs.map((l) => l.message) }
}

export async function watchFrontend(projectDir: string, onRebuild?: () => void) {
  await buildFrontend(projectDir)
  console.log('[frontend] watching for changes...')

  const frontendDir = path.resolve(projectDir, 'frontend')
  let timeout: ReturnType<typeof setTimeout> | null = null

  fs.watch(frontendDir, { recursive: true }, (_event, filename) => {
    if (filename && (filename.startsWith('public/') || filename.includes('/public/'))) return
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(async () => {
      const start = performance.now()
      const result = await buildFrontend(projectDir)
      const ms = Math.round(performance.now() - start)
      console.log(`[frontend] rebuilt in ${ms}ms`)
      if (result.success && onRebuild) onRebuild()
    }, 100)
  })
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

    const file = Bun.file(filePath)

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return new Response(file, { headers: { 'Cache-Control': 'no-cache' } })
    }

    // Directory → index.html resolution
    const indexFilePath = path.join(filePath, 'index.html')
    if (fs.existsSync(indexFilePath) && fs.statSync(indexFilePath).isFile()) {
      return new Response(Bun.file(indexFilePath), { headers: { 'Cache-Control': 'no-cache' } })
    }

    if (options.spaFallback) {
      const indexPath = path.join(distDir, 'index.html')
      if (fs.existsSync(indexPath)) {
        return new Response(Bun.file(indexPath), { headers: { 'Cache-Control': 'no-cache' } })
      }
    }

    return null
  }
}
