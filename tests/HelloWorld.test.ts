import { describe, test, expect } from 'bun:test'
import { createTestClient } from '../manifest/testing'
import path from 'path'

describe('hello-world', () => {
  const client = createTestClient({
    featuresDir: path.resolve(__dirname, '../features'),
  })

  test('greets by name', async () => {
    const result = await client.call('hello-world', { name: 'Jane' })
    expect(result.status).toBe(200)
    expect(result.message).toBe('Hello, Jane!')
    expect(result.data.greeting).toBe('Hello, Jane!')
  })

  test('greets World by default', async () => {
    const result = await client.call('hello-world', {})
    expect(result.status).toBe(200)
    expect(result.message).toBe('Hello, World!')
  })

  test('returns error for unknown feature', async () => {
    await expect(client.call('nonexistent', {})).rejects.toThrow('Feature "nonexistent" not found')
  })
})
