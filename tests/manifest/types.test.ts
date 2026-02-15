import { describe, test, expect } from 'bun:test'
import { t } from '../../manifest/types'

describe('t.string()', () => {
  test('creates a string field definition', () => {
    const field = t.string({
      description: 'User email address.',
      required: true,
      format: 'email',
    })
    expect(field.type).toBe('string')
    expect(field.description).toBe('User email address.')
    expect(field.required).toBe(true)
    expect(field.format).toBe('email')
  })

  test('defaults to not required', () => {
    const field = t.string({ description: 'Optional field.' })
    expect(field.required).toBe(false)
  })

  test('supports minLength and maxLength', () => {
    const field = t.string({
      description: 'Password.',
      required: true,
      minLength: 8,
      maxLength: 128,
    })
    expect(field.minLength).toBe(8)
    expect(field.maxLength).toBe(128)
  })
})

describe('t.integer()', () => {
  test('creates an integer field definition', () => {
    const field = t.integer({
      description: 'User age.',
      required: true,
      min: 0,
      max: 150,
    })
    expect(field.type).toBe('integer')
    expect(field.min).toBe(0)
    expect(field.max).toBe(150)
  })
})

describe('t.boolean()', () => {
  test('creates a boolean field definition', () => {
    const field = t.boolean({
      description: 'Accept terms.',
      required: true,
    })
    expect(field.type).toBe('boolean')
    expect(field.required).toBe(true)
  })
})

describe('t.array()', () => {
  test('creates an array field definition', () => {
    const field = t.array({
      description: 'Tags list.',
      itemType: 'string',
    })
    expect(field.type).toBe('array')
    expect(field.itemType).toBe('string')
  })
})

describe('t.number()', () => {
  test('creates a number field definition', () => {
    const field = t.number({
      description: 'Price in cents.',
      required: true,
      min: 0,
    })
    expect(field.type).toBe('number')
    expect(field.min).toBe(0)
  })
})
