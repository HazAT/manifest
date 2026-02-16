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
    route: undefined,
    input: {},
    async handle({ ok }) { return ok('Sent') },
  }),
}

describe('createRouter', () => {
  const router = createRouter(features)

  test('matches exact routes', () => {
    const match = router.match('GET', '/api/hello')
    expect(match.kind).toBe('matched')
    if (match.kind === 'matched') {
      expect(match.feature.name).toBe('hello-world')
      expect(match.params).toEqual({})
    }
  })

  test('matches routes with correct method', () => {
    const match = router.match('POST', '/api/users')
    expect(match.kind).toBe('matched')
    if (match.kind === 'matched') {
      expect(match.feature.name).toBe('create-user')
    }
  })

  test('returns method_not_allowed for wrong method', () => {
    const match = router.match('DELETE', '/api/hello')
    expect(match.kind).toBe('method_not_allowed')
  })

  test('returns not_found for unknown path', () => {
    const match = router.match('GET', '/api/unknown')
    expect(match.kind).toBe('not_found')
  })

  test('matches path parameters', () => {
    const match = router.match('GET', '/api/users/abc-123')
    expect(match.kind).toBe('matched')
    if (match.kind === 'matched') {
      expect(match.feature.name).toBe('get-user')
      expect(match.params).toEqual({ id: 'abc-123' })
    }
  })

  test('skips event-type features (no route)', () => {
    const match = router.match('GET', '/order-webhook')
    expect(match.kind).toBe('not_found')
  })
})
