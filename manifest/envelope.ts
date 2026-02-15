import type { FeatureResult } from './feature'

export interface ResponseEnvelope {
  status: number
  message: string
  data?: unknown
  errors?: Record<string, string>
  meta: {
    feature: string
    request_id: string
    duration_ms: number
  }
}

interface EnvelopeMeta {
  featureName: string
  requestId: string
  durationMs: number
}

export function toEnvelope(result: FeatureResult, meta: EnvelopeMeta): ResponseEnvelope {
  const envelope: ResponseEnvelope = {
    status: result.status,
    message: result.message,
    meta: {
      feature: meta.featureName,
      request_id: meta.requestId,
      duration_ms: meta.durationMs,
    },
  }

  if (result.success) {
    envelope.data = result.data
  } else {
    envelope.errors = result.errors
  }

  return envelope
}

export function createResultHelpers(): {
  ok: (message: string, opts?: { data?: unknown; status?: number }) => FeatureResult
  fail: (message: string, status?: number) => FeatureResult
} {
  return {
    ok(message, opts = {}) {
      return {
        success: true,
        status: opts.status ?? 200,
        message,
        data: opts.data ?? null,
        errors: {},
      }
    },
    fail(message, status = 400) {
      return {
        success: false,
        status,
        message,
        data: null,
        errors: {},
      }
    },
  }
}
