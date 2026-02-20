import { describe, expect, test } from "bun:test";
import path from "node:path";
import { createTestClient } from "../manifest/testing";

const client = createTestClient({
	featuresDir: path.resolve(__dirname, "../extensions/manifest-sse-example/features"),
});

describe("token-stream", () => {
	test("streams tokens from prompt", async () => {
		const events = await client.stream("token-stream", {
			prompt: "Hello world test",
			delay: 0,
		});
		expect(events.length).toBe(5);
		expect(events[0]).toEqual({ event: "start", data: { totalTokens: 3 } });
		expect(events[1]).toEqual({ event: "token", data: "Hello" });
		expect(events[2]).toEqual({ event: "token", data: "world" });
		expect(events[3]).toEqual({ event: "token", data: "test" });
		expect(events[4]).toEqual({ event: "done", data: { totalTokens: 3 } });
	});

	test("rejects empty prompt", async () => {
		const events = await client.stream("token-stream", { prompt: "   " });
		expect(events.some((e) => e.event === "error")).toBe(true);
	});
});
