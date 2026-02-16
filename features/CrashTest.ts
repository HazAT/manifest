import { defineFeature, t } from '../manifest'

export default defineFeature({
  name: 'crash-test',
  description: `A test feature that deliberately throws an error. Used to verify
                Spark event emission on 500 errors. Remove after testing.`,
  route: ['GET', '/api/crash'],
  authentication: 'none',
  sideEffects: [],
  errorCases: ['500 - Always throws'],

  input: {},

  async handle({ input, ok }) {
    throw new Error('Deliberate crash for Spark testing')
  },
})
