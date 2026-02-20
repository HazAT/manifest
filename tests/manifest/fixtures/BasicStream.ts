import { defineFeature, t } from "../../../manifest";

export default defineFeature({
	name: "basic-stream",
	description: "Test fixture: emits various event types.",
	type: "stream",
	route: ["POST", "/api/test/basic-stream"],
	authentication: "none",
	sideEffects: [],
	errorCases: [],
	input: {
		message: t.string({ description: "Test message.", required: true }),
	},
	async stream({ input, emit }) {
		emit(String(input.message));
		emit({ key: "value" });
		emit("named", "hello");
		emit("named-json", { text: "world" });
	},
});
