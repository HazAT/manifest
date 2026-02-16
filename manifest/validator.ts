import type { FieldDef, InputSchemaDef, StringFieldDef, IntegerFieldDef, NumberFieldDef, ArrayFieldDef } from './types'

export type ValidationErrors = Record<string, string>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const patternCache = new WeakMap<StringFieldDef, RegExp>()

function getPattern(field: StringFieldDef): RegExp {
  let cached = patternCache.get(field)
  if (!cached) {
    cached = new RegExp(field.pattern!)
    patternCache.set(field, cached)
  }
  return cached
}

function validateString(field: StringFieldDef, value: unknown): string | null {
  if (typeof value !== 'string') return 'invalid_type'
  if (field.format) {
    switch (field.format) {
      case 'email':
        if (!EMAIL_RE.test(value)) return 'invalid_format'
        break
      case 'url':
        try { new URL(value) } catch { return 'invalid_format' }
        break
      case 'uuid':
        if (!UUID_RE.test(value)) return 'invalid_format'
        break
      case 'date':
      case 'datetime':
        if (isNaN(Date.parse(value))) return 'invalid_format'
        break
    }
  }
  if (field.pattern) {
    try {
      if (!getPattern(field).test(value)) return 'invalid_format'
    } catch {
      return 'invalid_pattern'
    }
  }
  if (field.minLength !== undefined && value.length < field.minLength) return 'min_length'
  if (field.maxLength !== undefined && value.length > field.maxLength) return 'max_length'
  return null
}

function validateInteger(field: IntegerFieldDef, value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return 'invalid_type'
  if (field.min !== undefined && value < field.min) return 'min'
  if (field.max !== undefined && value > field.max) return 'max'
  return null
}

function validateNumber(field: { min?: number; max?: number }, value: unknown): string | null {
  if (typeof value !== 'number') return 'invalid_type'
  if (field.min !== undefined && value < field.min) return 'min'
  if (field.max !== undefined && value > field.max) return 'max'
  return null
}

function validateBoolean(_field: FieldDef, value: unknown): string | null {
  if (typeof value !== 'boolean') return 'invalid_type'
  return null
}

function validateArray(field: ArrayFieldDef, value: unknown): string | null {
  if (!Array.isArray(value)) return 'invalid_type'
  if (field.minItems !== undefined && value.length < field.minItems) return 'min_items'
  if (field.maxItems !== undefined && value.length > field.maxItems) return 'max_items'
  return null
}

/**
 * Validates input data against a schema. Returns an object mapping field names
 * to error types. An empty object means the input is valid.
 */
export function validateInput(schema: InputSchemaDef, data: Record<string, unknown>): ValidationErrors {
  const errors: ValidationErrors = {}

  for (const [name, field] of Object.entries(schema)) {
    const value = data[name]

    if (value === undefined || value === null) {
      if (field.required) errors[name] = 'required'
      continue
    }

    let error: string | null = null
    switch (field.type) {
      case 'string': error = validateString(field, value); break
      case 'integer': error = validateInteger(field, value); break
      case 'number': error = validateNumber(field, value); break
      case 'boolean': error = validateBoolean(field, value); break
      case 'array': error = validateArray(field, value); break
    }
    if (error) errors[name] = error
  }

  return errors
}
