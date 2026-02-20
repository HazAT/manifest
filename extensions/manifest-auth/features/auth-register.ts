import { defineFeature, t } from '../../../manifest'
import { auth, EmailExistsError, ValidationError } from '../services/auth'

export default defineFeature({
  name: 'auth-register',
  description: `Registers a new user with email and password. Validates email format,
                hashes password with bcrypt via Bun.password, and stores credentials
                in SQLite. Returns the created user object without the password hash.`,
  route: ['POST', '/api/auth/register'],
  authentication: 'none',
  sideEffects: ['Inserts one row into users table'],
  errorCases: [
    '409 - Email already registered',
    '422 - Validation failed (password too short)',
  ],

  input: {
    email: t.string({
      description: 'User email address. Must be unique across all users. Stored lowercase.',
      required: true,
      format: 'email',
    }),
    password: t.string({
      description: 'User password. Minimum 8 characters.',
      required: true,
      minLength: 8,
    }),
  },

  async handle({ input, ok, fail }) {
    try {
      const user = await auth.register(String(input.email), String(input.password))
      return ok('User registered', { data: { user }, status: 201 })
    } catch (err) {
      if (err instanceof EmailExistsError) return fail('Email already registered', 409)
      if (err instanceof ValidationError) return fail(err.message, 422)
      throw err
    }
  },
})
