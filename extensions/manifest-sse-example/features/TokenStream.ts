import { defineFeature, t } from "../../../manifest";

export default defineFeature({
	name: "token-stream",
	description: `Streams text back token by token via Server-Sent Events. Accepts a prompt
                and echoes it word-by-word with a short delay between each token. This is a
                demo feature that simulates AI-style token streaming without external dependencies.`,
	type: "stream",
	route: ["POST", "/api/stream/tokens"],
	authentication: "none",
	sideEffects: [],
	errorCases: ["400 - Empty prompt"],

	input: {
		prompt: t.string({
			description: "Text to echo back token by token.",
			required: true,
		}),
		delay: t.integer({
			description: "Milliseconds between each token. Defaults to 80.",
			required: false,
			min: 0,
			max: 2000,
		}),
	},

	async stream({ input, emit, fail }) {
		const text = String(input.prompt).trim();
		if (!text) return fail("Empty prompt");

		const delayMs = Number(input.delay ?? 80);
		const tokens = text.split(/\s+/);

		emit("start", { totalTokens: tokens.length });

		for (const token of tokens) {
			await new Promise((r) => setTimeout(r, delayMs));
			emit("token", token);
		}

		emit("done", { totalTokens: tokens.length });
	},
});
