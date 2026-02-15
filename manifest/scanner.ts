import type { FeatureDef } from './feature'
import { readdirSync } from 'fs'
import path from 'path'

export type FeatureRegistry = Record<string, FeatureDef>

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
      const feature = mod.default as FeatureDef | undefined
      if (feature && typeof feature === 'object' && feature.name) {
        registry[feature.name] = feature
      }
    } catch (err) {
      console.error(`[manifest] Failed to load feature from ${file}:`, err)
    }
  }

  return registry
}
