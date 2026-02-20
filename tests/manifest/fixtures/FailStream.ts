import { defineFeature } from "../../../manifest";

export default defineFeature({
	name: "fail-stream",
	description: "Test fixture: emits one event then fails.",
	type: "stream",
	route: ["POST", "/api/test/fail-stream"],
	authentication: "none",
	sideEffects: [],
	errorCases: [],
	input: {},
	async stream({ emit, fail }) {
		emit("before-fail", "ok");
		fail("Something went wrong");
		emit("after-fail", "should not appear");
	},
});
