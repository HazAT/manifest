import { describe, test, expect } from 'bun:test'
import { toEnvelope, createResultHelpers } from '../../manifest/envelope'

describe('toEnvelope', () => {
  test('formats a success result', () => {
    const envelope = toEnvelope(
      {
        success: true,
        status: 201,
        message: 'User registered',
        data: { id: '123', email: 'user@example.com' },
        errors: {},
      },
      {
        featureName: 'user-registration',
        requestId: 'req_abc123',
        durationMs: 42,
      },
    )
    expect(envelope.status).toBe(201)
    expect(envelope.message).toBe('User registered')
    expect(envelope.data).toEqual({ id: '123', email: 'user@example.com' })
    expect(envelope.meta.feature).toBe('user-registration')
    expect(envelope.meta.request_id).toBe('req_abc123')
    expect(envelope.meta.duration_ms).toBe(42)
    expect(envelope.errors).toBeUndefined()
  })

  test('formats an error result', () => {
    const envelope = toEnvelope(
      {
        success: false,
        status: 422,
        message: 'Validation failed',
        data: null,
        errors: { email: 'required', password: 'required' },
      },
      {
        featureName: 'user-registration',
        requestId: 'req_abc123',
        durationMs: 5,
      },
    )
    expect(envelope.status).toBe(422)
    expect(envelope.errors).toEqual({ email: 'required', password: 'required' })
    expect(envelope.data).toBeUndefined()
  })
})

describe('createResultHelpers', () => {
  test('ok() creates a success result', () => {
    const { ok } = createResultHelpers()
    const result = ok('Done', { data: { id: 1 }, status: 201 })
    expect(result.success).toBe(true)
    expect(result.status).toBe(201)
    expect(result.message).toBe('Done')
    expect(result.data).toEqual({ id: 1 })
  })

  test('ok() defaults to status 200', () => {
    const { ok } = createResultHelpers()
    const result = ok('Done')
    expect(result.status).toBe(200)
  })

  test('fail() creates a failure result', () => {
    const { fail } = createResultHelpers()
    const result = fail('Not found', 404)
    expect(result.success).toBe(false)
    expect(result.status).toBe(404)
    expect(result.message).toBe('Not found')
  })

  test('fail() defaults to status 400', () => {
    const { fail } = createResultHelpers()
    const result = fail('Bad request')
    expect(result.status).toBe(400)
  })
})
