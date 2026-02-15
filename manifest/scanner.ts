import type { AnyFeatureDef } from './feature'
import { readdirSync, existsSync, statSync } from 'fs'
import path from 'path'

export type FeatureRegistry = Record<string, AnyFeatureDef>

export async function scanFeatures(featuresDir: string): Promise<FeatureRegistry> {
  const registry: FeatureRegistry = {}

  let files: string[]
  try {
    files = readdirSync(featuresDir)
  } catch {
    return registry
  }

  const tsFiles = files.filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  for (const file of tsFiles) {
    const fullPath = path.resolve(featuresDir, file)
    try {
      const mod = await import(fullPath)
      const feature = mod.default as AnyFeatureDef | undefined
      if (feature && typeof feature === 'object' && feature.name) {
        ;(feature as any)._sourcePath = path.relative(process.cwd(), fullPath)
        registry[feature.name] = feature
      }
    } catch (err) {
      console.error(`[manifest] Failed to load feature from ${file}:`, err)
    }
  }

  return registry
}

export async function scanAllFeatures(projectDir: string): Promise<FeatureRegistry> {
  // Scan extensions first so project features win on name collision
  const registry: FeatureRegistry = {}

  const extensionsDir = path.join(projectDir, 'extensions')
  if (existsSync(extensionsDir)) {
    let entries: string[]
    try {
      entries = readdirSync(extensionsDir)
    } catch {
      entries = []
    }

    for (const entry of entries) {
      const entryPath = path.join(extensionsDir, entry)
      if (!statSync(entryPath).isDirectory()) continue

      const extFeaturesDir = path.join(entryPath, 'features')
      if (!existsSync(extFeaturesDir)) continue

      const extRegistry = await scanFeatures(extFeaturesDir)
      Object.assign(registry, extRegistry)
    }
  }

  // Scan project features last — they override extensions on collision
  const projectRegistry = await scanFeatures(path.join(projectDir, 'features'))
  for (const [name, feature] of Object.entries(projectRegistry)) {
    if (registry[name]) {
      console.warn(`[manifest] Feature '${name}' in project overrides extension feature at ${(registry[name] as any)._sourcePath}`)
    }
    registry[name] = feature
  }

  return registry
}
