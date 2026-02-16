/**
 * Manifest Framework
 *
 * This is the barrel export for the framework. Features import from here:
 *   import { defineFeature, t } from '../manifest'
 *
 * This file re-exports everything a feature needs.
 */

export { defineFeature } from './feature'
export type { FeatureDef, FeatureResult, HandleContext, FeatureOptions, StreamFeatureDef, StreamFeatureOptions, StreamContext, EmitFn, AnyFeatureDef } from './feature'

export { t } from './types'
export type { FieldDef, InputSchemaDef, StringFieldDef, IntegerFieldDef, NumberFieldDef, BooleanFieldDef, ArrayFieldDef } from './types'

export { validateInput } from './validator'

export { createRouter } from './router'
export type { Router, MatchResult } from './router'

export { scanFeatures, scanAllFeatures } from './scanner'
export type { FeatureRegistry } from './scanner'

export { toEnvelope, createResultHelpers } from './envelope'
export type { ResponseEnvelope } from './envelope'

export { createManifestServer } from './server'
export type { ManifestServer, ManifestServerOptions } from './server'

export { createTestClient } from './testing'
export type { TestClient, TestResult, StreamEvent } from './testing'
