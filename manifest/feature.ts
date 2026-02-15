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

// --- Stream feature types ---

/**
 * Emit function for stream features. Pushes SSE events to the client.
 * - emit(data) sends a data-only event
 * - emit(event, data) sends a named event with data
 */
export interface EmitFn {
  (data: string | object): void
  (event: string, data: string | object): void
}

/**
 * Context passed to a stream feature's stream() function.
 * Provides validated input and SSE control (emit, close, fail).
 */
export interface StreamContext<TInput = Record<string, unknown>> {
  input: TInput
  emit: EmitFn
  close: () => void
  fail: (message: string) => void
}

/**
 * Options for defining a stream feature. Uses stream() instead of handle().
 */
export interface StreamFeatureOptions<TInput = Record<string, unknown>> {
  name: string
  description: string
  route: [HttpMethod, string]
  type: 'stream'
  authentication?: 'none' | 'required' | 'optional'
  sideEffects?: string[]
  errorCases?: string[]
  input: InputSchemaDef
  stream: (ctx: StreamContext<TInput>) => Promise<void>
}

/**
 * Resolved stream feature definition with all defaults applied.
 */
export interface StreamFeatureDef<TInput = Record<string, unknown>> {
  name: string
  description: string
  route: [HttpMethod, string]
  type: 'stream'
  authentication: 'none' | 'required' | 'optional'
  sideEffects: string[]
  errorCases: string[]
  input: InputSchemaDef
  stream: (ctx: StreamContext<TInput>) => Promise<void>
}

/**
 * Union of all resolved feature definitions.
 * Use `feature.type` to discriminate between request and stream features.
 */
export type AnyFeatureDef = FeatureDef | StreamFeatureDef

/**
 * Define a feature. Takes a plain options object and returns a resolved
 * feature definition with defaults applied.
 *
 * Defaults:
 *   - type: 'request' (when not specified)
 *   - authentication: 'required'
 *   - sideEffects: []
 *   - errorCases: []
 *
 * Accepts both request/action/event features (with handle()) and
 * stream features (with stream()). The returned type discriminates
 * on the `type` field.
 */
export function defineFeature<TInput = Record<string, unknown>>(
  opts: StreamFeatureOptions<TInput>,
): StreamFeatureDef<TInput>
export function defineFeature<TInput = Record<string, unknown>>(
  opts: FeatureOptions<TInput>,
): FeatureDef<TInput>
export function defineFeature<TInput = Record<string, unknown>>(
  opts: FeatureOptions<TInput> | StreamFeatureOptions<TInput>,
): FeatureDef<TInput> | StreamFeatureDef<TInput> {
  if (opts.type === 'stream') {
    const streamOpts = opts as StreamFeatureOptions<TInput>
    return {
      name: streamOpts.name,
      description: streamOpts.description,
      route: streamOpts.route,
      type: 'stream',
      authentication: streamOpts.authentication ?? 'required',
      sideEffects: streamOpts.sideEffects ?? [],
      errorCases: streamOpts.errorCases ?? [],
      input: streamOpts.input,
      stream: streamOpts.stream,
    }
  }

  const reqOpts = opts as FeatureOptions<TInput>
  return {
    name: reqOpts.name,
    description: reqOpts.description,
    route: reqOpts.route,
    type: reqOpts.type ?? 'request',
    trigger: reqOpts.trigger,
    authentication: reqOpts.authentication ?? 'required',
    sideEffects: reqOpts.sideEffects ?? [],
    errorCases: reqOpts.errorCases ?? [],
    input: reqOpts.input,
    handle: reqOpts.handle,
  }
}
