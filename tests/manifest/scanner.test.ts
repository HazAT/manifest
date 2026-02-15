import { describe, test, expect } from 'bun:test'
import { scanFeatures } from '../../manifest/scanner'
import path from 'path'

describe('scanFeatures', () => {
  test('scans features directory and returns registry', async () => {
    const registry = await scanFeatures(path.resolve(__dirname, '../../features'))
    expect(Object.keys(registry).length).toBeGreaterThan(0)
    expect(registry['hello-world']).toBeDefined()
    expect(registry['hello-world']!.name).toBe('hello-world')
    expect(registry['hello-world']!.route).toEqual(['GET', '/api/hello'])
  })

  test('returns empty registry for empty directory', async () => {
    const tmpDir = path.join(import.meta.dir, '__empty_test_dir__')
    await Bun.write(path.join(tmpDir, '.gitkeep'), '')
    const registry = await scanFeatures(tmpDir)
    expect(Object.keys(registry)).toHaveLength(0)
    const fs = await import('fs')
    fs.rmSync(tmpDir, { recursive: true })
  })

  test('indexes features by name', async () => {
    const registry = await scanFeatures(path.resolve(__dirname, '../../features'))
    const feature = registry['hello-world']
    expect(feature).toBeDefined()
    expect(feature!.description).toContain('greeting')
  })
})
