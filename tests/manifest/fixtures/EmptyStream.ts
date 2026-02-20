import { defineFeature } from "../../../manifest";

export default defineFeature({
	name: "empty-stream",
	description: "Test fixture: returns immediately with no emits.",
	type: "stream",
	route: ["POST", "/api/test/empty-stream"],
	authentication: "none",
	sideEffects: [],
	errorCases: [],
	input: {},
	async stream() {
		// intentionally empty
	},
});
