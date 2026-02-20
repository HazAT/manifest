/**
 * Manifest Framework
 *
 * This is the barrel export for the framework. Features import from here:
 *   import { defineFeature, t } from '../manifest'
 *
 * This file re-exports everything a feature needs.
 */

export type { RateLimitConfig } from "../services/rateLimiter";
export type { ResponseEnvelope } from "./envelope";
export { createResultHelpers, toEnvelope } from "./envelope";
export type {
	AnyFeatureDef,
	AuthUser,
	EmitFn,
	FeatureDef,
	FeatureOptions,
	FeatureResult,
	HandleContext,
	StreamContext,
	StreamFeatureDef,
	StreamFeatureOptions,
} from "./feature";
export { defineFeature } from "./feature";
export type { MatchResult, Router } from "./router";
export { createRouter } from "./router";
export type { FeatureRegistry } from "./scanner";
export { scanAllFeatures, scanFeatures } from "./scanner";
export type { ManifestServer, ManifestServerOptions } from "./server";
export { createManifestServer } from "./server";
export type { StreamEvent, TestClient, TestResult } from "./testing";
export { createTestClient } from "./testing";
export type {
	ArrayFieldDef,
	BooleanFieldDef,
	FieldDef,
	InputSchemaDef,
	IntegerFieldDef,
	NumberFieldDef,
	StringFieldDef,
} from "./types";
export { t } from "./types";
export { validateInput } from "./validator";
