import { describe, test, expect, beforeEach } from 'bun:test'
import { checkRateLimit, reset } from '../services/rateLimiter'

const config = { max: 5, windowSeconds: 60 }

beforeEach(() => {
  reset()
})

describe('rateLimiter', () => {
  test('allows requests under the limit', () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit('test-key', config)
      expect(result.allowed).toBe(true)
    }
  })

  test('blocks when limit exceeded', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-key', config)
    }
    const result = checkRateLimit('test-key', config)
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  test('remaining counts down correctly', () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit('test-key', config)
      expect(result.remaining).toBe(4 - i)
    }
  })

  test('window expires and allows again', async () => {
    const shortConfig = { max: 2, windowSeconds: 1 }
    checkRateLimit('test-key', shortConfig)
    checkRateLimit('test-key', shortConfig)
    expect(checkRateLimit('test-key', shortConfig).allowed).toBe(false)

    await Bun.sleep(1100)

    const result = checkRateLimit('test-key', shortConfig)
    expect(result.allowed).toBe(true)
  })

  test('different keys are independent', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('key-a', config)
    }
    expect(checkRateLimit('key-a', config).allowed).toBe(false)
    expect(checkRateLimit('key-b', config).allowed).toBe(true)
  })

  test('reset clears all state', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-key', config)
    }
    expect(checkRateLimit('test-key', config).allowed).toBe(false)

    reset()

    expect(checkRateLimit('test-key', config).allowed).toBe(true)
  })

  test('retryAfter is correct', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-key', config)
    }
    const result = checkRateLimit('test-key', config)
    expect(result.allowed).toBe(false)
    // retryAfter should be close to windowSeconds (ceiling to whole seconds)
    expect(result.retryAfter).toBeGreaterThan(0)
    expect(result.retryAfter).toBeLessThanOrEqual(config.windowSeconds)
  })
})
