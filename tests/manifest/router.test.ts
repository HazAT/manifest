import { describe, test, expect } from 'bun:test'
import { createRouter } from '../../manifest/router'
import { defineFeature } from '../../manifest/feature'

const features = {
  'hello-world': defineFeature({
    name: 'hello-world',
    description: 'Says hello.',
    route: ['GET', '/api/hello'],
    input: {},
    async handle({ ok }) { return ok('Hello!') },
  }),
  'create-user': defineFeature({
    name: 'create-user',
    description: 'Creates user.',
    route: ['POST', '/api/users'],
    input: {},
    async handle({ ok }) { return ok('Created') },
  }),
  'get-user': defineFeature({
    name: 'get-user',
    description: 'Gets a user by ID.',
    route: ['GET', '/api/users/:id'],
    input: {},
    async handle({ ok }) { return ok('Got user') },
  }),
  'order-webhook': defineFeature({
    name: 'order-webhook',
    description: 'Internal event.',
    type: 'event' as const,
    trigger: 'order.shipped',
    route: [],
    input: {},
    async handle({ ok }) { return ok('Sent') },
  }),
}

describe('createRouter', () => {
  const router = createRouter(features)

  test('matches exact routes', () => {
    const match = router.match('GET', '/api/hello')
    expect(match).not.toBeNull()
    expect(match!.feature.name).toBe('hello-world')
    expect(match!.params).toEqual({})
  })

  test('matches routes with correct method', () => {
    const match = router.match('POST', '/api/users')
    expect(match).not.toBeNull()
    expect(match!.feature.name).toBe('create-user')
  })

  test('returns null for wrong method', () => {
    const match = router.match('DELETE', '/api/hello')
    expect(match).toBeNull()
  })

  test('returns null for unknown path', () => {
    const match = router.match('GET', '/api/unknown')
    expect(match).toBeNull()
  })

  test('matches path parameters', () => {
    const match = router.match('GET', '/api/users/abc-123')
    expect(match).not.toBeNull()
    expect(match!.feature.name).toBe('get-user')
    expect(match!.params).toEqual({ id: 'abc-123' })
  })

  test('skips event-type features (no route)', () => {
    const match = router.match('GET', '/order-webhook')
    expect(match).toBeNull()
  })

  test('isMethodNotAllowed detects wrong method', () => {
    const result = router.isMethodNotAllowed('DELETE', '/api/hello')
    expect(result).toBe(true)
  })

  test('isMethodNotAllowed returns false for unknown paths', () => {
    const result = router.isMethodNotAllowed('GET', '/api/unknown')
    expect(result).toBe(false)
  })
})
