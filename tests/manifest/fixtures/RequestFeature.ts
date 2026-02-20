import { defineFeature } from "../../../manifest";

export default defineFeature({
	name: "request-feature",
	description: "Test fixture: a regular request feature for testing stream() rejection.",
	route: ["GET", "/api/test/request"],
	authentication: "none",
	sideEffects: [],
	errorCases: [],
	input: {},
	async handle({ ok }) {
		return ok("Hello");
	},
});
