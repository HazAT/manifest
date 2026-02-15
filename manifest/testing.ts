/**
 * Test client for Manifest features.
 * Calls features directly by name without starting an HTTP server.
 */

import { scanFeatures } from './scanner'
import { validateInput } from './validator'
import { createResultHelpers } from './envelope'
import type { FeatureResult } from './feature'
import type { FeatureRegistry } from './scanner'

export interface TestResult {
  success: boolean
  status: number
  message: string
  data: any
  errors: Record<string, string>
}

export interface TestClient {
  call(featureName: string, input: Record<string, unknown>): Promise<TestResult>
  getRegistry(): Promise<FeatureRegistry>
}

export function createTestClient(options: {
  featuresDir: string
}): TestClient {
  let registryPromise: Promise<FeatureRegistry> | null = null

  async function getRegistry(): Promise<FeatureRegistry> {
    if (!registryPromise) {
      registryPromise = scanFeatures(options.featuresDir)
    }
    return registryPromise
  }

  return {
    async call(featureName: string, input: Record<string, unknown>): Promise<TestResult> {
      const registry = await getRegistry()
      const feature = registry[featureName]

      if (!feature) {
        throw new Error(`Feature "${featureName}" not found in ${options.featuresDir}`)
      }

      const validationErrors = validateInput(feature.input, input)
      if (Object.keys(validationErrors).length > 0) {
        return {
          success: false,
          status: 422,
          message: 'Validation failed',
          data: null,
          errors: validationErrors,
        }
      }

      const { ok, fail } = createResultHelpers()
      const result = await feature.handle({ input, ok, fail })

      return {
        success: result.success,
        status: result.status,
        message: result.message,
        data: result.data,
        errors: result.errors,
      }
    },

    getRegistry() {
      return getRegistry()
    },
  }
}
