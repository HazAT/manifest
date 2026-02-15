import type { InputSchemaDef } from './types'

/**
 * Standard response envelope returned by feature handlers.
 */
export interface FeatureResult {
  success: boolean
  status: number
  message: string
  data: unknown
  errors: Record<string, string>
}

/**
 * Context passed to a feature's handle() function.
 * Provides validated input and ok/fail response helpers.
 */
export interface HandleContext<TInput = Record<string, unknown>> {
  input: TInput
  ok: (message: string, opts?: { data?: unknown; status?: number }) => FeatureResult
  fail: (message: string, status?: number) => FeatureResult
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Options accepted by defineFeature(). Users pass this object to define a feature.
 */
export interface FeatureOptions<TInput = Record<string, unknown>> {
  name: string
  description: string
  route: [HttpMethod, string] | []
  type?: 'request' | 'action' | 'event'
  trigger?: string
  authentication?: 'none' | 'required' | 'optional'
  sideEffects?: string[]
  errorCases?: string[]
  input: InputSchemaDef
  handle: (ctx: HandleContext<TInput>) => Promise<FeatureResult>
}

/**
 * Resolved feature definition with all defaults applied.
 */
export interface FeatureDef<TInput = Record<string, unknown>> {
  name: string
  description: string
  route: [HttpMethod, string] | []
  type: 'request' | 'action' | 'event'
  trigger?: string
  authentication: 'none' | 'required' | 'optional'
  sideEffects: string[]
  errorCases: string[]
  input: InputSchemaDef
  handle: (ctx: HandleContext<TInput>) => Promise<FeatureResult>
}

/**
 * Define a feature. Takes a plain options object and returns a resolved
 * feature definition with defaults applied.
 *
 * Defaults:
 *   - type: 'request'
 *   - authentication: 'required'
 *   - sideEffects: []
 *   - errorCases: []
 */
export function defineFeature<TInput = Record<string, unknown>>(
  opts: FeatureOptions<TInput>,
): FeatureDef<TInput> {
  return {
    name: opts.name,
    description: opts.description,
    route: opts.route,
    type: opts.type ?? 'request',
    trigger: opts.trigger,
    authentication: opts.authentication ?? 'required',
    sideEffects: opts.sideEffects ?? [],
    errorCases: opts.errorCases ?? [],
    input: opts.input,
    handle: opts.handle,
  }
}
