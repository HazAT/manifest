import { defineFeature } from "../../../manifest";

export default defineFeature({
	name: "close-stream",
	description: "Test fixture: emits one event then closes early.",
	type: "stream",
	route: ["POST", "/api/test/close-stream"],
	authentication: "none",
	sideEffects: [],
	errorCases: [],
	input: {},
	async stream({ emit, close }) {
		emit("before-close", "ok");
		close();
		emit("after-close", "should not appear");
	},
});
