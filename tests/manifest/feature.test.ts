import { describe, test, expect } from 'bun:test'
import { defineFeature } from '../../manifest/feature'
import { t } from '../../manifest/types'

describe('defineFeature', () => {
  test('returns a typed feature definition', () => {
    const feature = defineFeature({
      name: 'hello-world',
      description: 'Says hello.',
      route: ['GET', '/api/hello'],
      authentication: 'none',
      sideEffects: [],
      errorCases: [],
      input: {
        name: t.string({ description: 'Who to greet.', required: false }),
      },
      async handle({ input, ok }) {
        const name = input.name ?? 'World'
        return ok(`Hello, ${name}!`, { data: { greeting: `Hello, ${name}!` } })
      },
    })
    expect(feature.name).toBe('hello-world')
    expect(feature.description).toBe('Says hello.')
    expect(feature.route).toEqual(['GET', '/api/hello'])
    expect(feature.type).toBe('request')
    expect(feature.authentication).toBe('none')
    expect(feature.input.name!.type).toBe('string')
    expect(typeof feature.handle).toBe('function')
  })

  test('defaults type to request', () => {
    const feature = defineFeature({
      name: 'test',
      description: 'Test.',
      route: ['GET', '/test'],
      input: {},
      async handle({ ok }) { return ok('Done') },
    })
    expect(feature.type).toBe('request')
  })

  test('defaults authentication to required', () => {
    const feature = defineFeature({
      name: 'test',
      description: 'Test.',
      route: ['GET', '/test'],
      input: {},
      async handle({ ok }) { return ok('Done') },
    })
    expect(feature.authentication).toBe('required')
  })

  test('handle context provides ok and fail helpers', async () => {
    const feature = defineFeature({
      name: 'test',
      description: 'Test.',
      route: ['GET', '/test'],
      input: {},
      async handle({ ok }) {
        return ok('It works', { data: { value: 42 }, status: 201 })
      },
    })
    const result = await feature.handle({
      input: {},
      ok: (message, opts) => ({
        success: true,
        status: opts?.status ?? 200,
        message,
        data: opts?.data ?? null,
        errors: {},
      }),
      fail: (message, status) => ({
        success: false,
        status: status ?? 400,
        message,
        data: null,
        errors: {},
      }),
    })
    expect(result.success).toBe(true)
    expect(result.status).toBe(201)
    expect(result.message).toBe('It works')
    expect(result.data).toEqual({ value: 42 })
  })

  test('handle context provides fail helper', async () => {
    const feature = defineFeature({
      name: 'test',
      description: 'Test.',
      route: ['POST', '/test'],
      input: {},
      async handle({ fail }) {
        return fail('Something went wrong', 409)
      },
    })
    const result = await feature.handle({
      input: {},
      ok: (message, opts) => ({
        success: true,
        status: opts?.status ?? 200,
        message,
        data: opts?.data ?? null,
        errors: {},
      }),
      fail: (message, status) => ({
        success: false,
        status: status ?? 400,
        message,
        data: null,
        errors: {},
      }),
    })
    expect(result.success).toBe(false)
    expect(result.status).toBe(409)
  })
})
