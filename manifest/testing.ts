/**
 * Test client for Manifest features.
 * Calls features directly by name without starting an HTTP server.
 */

import { scanFeatures } from './scanner'
import { validateInput } from './validator'
import { createResultHelpers } from './envelope'
import type { FeatureResult, StreamFeatureDef } from './feature'
import type { FeatureRegistry } from './scanner'

export interface TestResult {
  success: boolean
  status: number
  message: string
  data: any
  errors: Record<string, string>
}

export interface StreamEvent {
  event?: string
  data: unknown
}

export interface TestClient {
  call(featureName: string, input: Record<string, unknown>): Promise<TestResult>
  stream(featureName: string, input: Record<string, unknown>): Promise<StreamEvent[]>
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
      if (feature.type === 'stream') {
        throw new Error(`Feature '${name}' is a stream feature. Use client.stream() instead of client.call().`)
      }
      const result = await feature.handle({ input, ok, fail })

      return {
        success: result.success,
        status: result.status,
        message: result.message,
        data: result.data,
        errors: result.errors,
      }
    },

    async stream(featureName: string, input: Record<string, unknown>): Promise<StreamEvent[]> {
      const registry = await getRegistry()
      const feature = registry[featureName]

      if (!feature) {
        throw new Error(`Feature "${featureName}" not found in ${options.featuresDir}`)
      }

      if (feature.type !== 'stream') {
        throw new Error(`Feature "${featureName}" is not a stream feature (type: "${feature.type || 'request'}")`)
      }

      const validationErrors = validateInput(feature.input, input)
      if (Object.keys(validationErrors).length > 0) {
        throw new Error(`Validation failed: ${JSON.stringify(validationErrors)}`)
      }

      const events: StreamEvent[] = []
      let closed = false

      const emit = (...args: unknown[]) => {
        if (closed) return
        if (args.length === 2) {
          events.push({ event: args[0] as string, data: args[1] })
        } else {
          events.push({ data: args[0] })
        }
      }

      const close = () => { closed = true }

      const fail = (message: string) => {
        events.push({ event: 'error', data: { message } })
        closed = true
      }

      const streamFeature = feature as StreamFeatureDef
      await streamFeature.stream({ input, emit, close, fail })

      return events
    },

    getRegistry() {
      return getRegistry()
    },
  }
}
