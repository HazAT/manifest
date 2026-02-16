import { defineFeature, t } from '../manifest'

export default defineFeature({
  name: 'hello-world',
  description: `A simple greeting endpoint. Returns a hello message with the
                provided name, or "World" if no name is given. This is the
                default demo feature that ships with every Manifest project.`,
  route: ['GET', '/api/hello'],
  authentication: 'none',
  rateLimit: { max: 5, windowSeconds: 10 },
  sideEffects: [],
  errorCases: [],

  input: {
    name: t.string({
      description: 'The name to greet. Defaults to "World" if not provided.',
      required: false,
      maxLength: 100,
    }),
  },

  async handle({ input, ok }) {
    const name = String(input.name ?? 'World')
    return ok(`Hello, ${name}!`, {
      data: { greeting: `Hello, ${name}!` },
    })
  },
})
