/**
 * Input field definition. Describes a single input parameter for a feature.
 * Used by defineFeature() to declare inputs and by validateInput() to validate data.
 *
 * An agent reads these definitions to understand what a feature expects.
 * Every field MUST have a description explaining what it's for.
 */

export type FieldType = 'string' | 'integer' | 'number' | 'boolean' | 'array'

export interface BaseFieldDef {
  type: FieldType
  description: string
  required: boolean
}

export interface StringFieldDef extends BaseFieldDef {
  type: 'string'
  minLength?: number
  maxLength?: number
  format?: 'email' | 'url' | 'uuid' | 'date' | 'datetime'
  pattern?: string
}

export interface IntegerFieldDef extends BaseFieldDef {
  type: 'integer'
  min?: number
  max?: number
}

export interface NumberFieldDef extends BaseFieldDef {
  type: 'number'
  min?: number
  max?: number
}

export interface BooleanFieldDef extends BaseFieldDef {
  type: 'boolean'
}

export interface ArrayFieldDef extends BaseFieldDef {
  type: 'array'
  itemType: string
  minItems?: number
  maxItems?: number
}

export type FieldDef = StringFieldDef | IntegerFieldDef | NumberFieldDef | BooleanFieldDef | ArrayFieldDef

/**
 * Input schema is a plain object mapping field names to field definitions.
 */
export type InputSchemaDef = Record<string, FieldDef>

/**
 * Type builders for input field definitions.
 *
 * Usage:
 *   input: {
 *     email: t.string({ description: 'User email.', required: true, format: 'email' }),
 *     age: t.integer({ description: 'User age.', min: 0 }),
 *   }
 */
export const t = {
  string(opts: {
    description: string
    required?: boolean
    minLength?: number
    maxLength?: number
    format?: 'email' | 'url' | 'uuid' | 'date' | 'datetime'
    pattern?: string
  }): StringFieldDef {
    return {
      type: 'string',
      description: opts.description,
      required: opts.required ?? false,
      ...(opts.minLength !== undefined && { minLength: opts.minLength }),
      ...(opts.maxLength !== undefined && { maxLength: opts.maxLength }),
      ...(opts.format !== undefined && { format: opts.format }),
      ...(opts.pattern !== undefined && { pattern: opts.pattern }),
    }
  },

  integer(opts: {
    description: string
    required?: boolean
    min?: number
    max?: number
  }): IntegerFieldDef {
    return {
      type: 'integer',
      description: opts.description,
      required: opts.required ?? false,
      ...(opts.min !== undefined && { min: opts.min }),
      ...(opts.max !== undefined && { max: opts.max }),
    }
  },

  number(opts: {
    description: string
    required?: boolean
    min?: number
    max?: number
  }): NumberFieldDef {
    return {
      type: 'number',
      description: opts.description,
      required: opts.required ?? false,
      ...(opts.min !== undefined && { min: opts.min }),
      ...(opts.max !== undefined && { max: opts.max }),
    }
  },

  boolean(opts: {
    description: string
    required?: boolean
  }): BooleanFieldDef {
    return {
      type: 'boolean',
      description: opts.description,
      required: opts.required ?? false,
    }
  },

  array(opts: {
    description: string
    required?: boolean
    itemType: string
    minItems?: number
    maxItems?: number
  }): ArrayFieldDef {
    return {
      type: 'array',
      description: opts.description,
      required: opts.required ?? false,
      itemType: opts.itemType,
      ...(opts.minItems !== undefined && { minItems: opts.minItems }),
      ...(opts.maxItems !== undefined && { maxItems: opts.maxItems }),
    }
  },
}
