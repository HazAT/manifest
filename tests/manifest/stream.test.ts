import { describe, expect, test } from "bun:test";
import path from "node:path";
import { createTestClient } from "../../manifest/testing";

const client = createTestClient({
	featuresDir: path.resolve(__dirname, "fixtures"),
});

describe("stream features", () => {
	test("plain text emit", async () => {
		const events = await client.stream("basic-stream", { message: "hello" });
		expect(events[0]).toEqual({ data: "hello" });
	});

	test("JSON object emit", async () => {
		const events = await client.stream("basic-stream", { message: "test" });
		expect(events[1]).toEqual({ data: { key: "value" } });
	});

	test("named event + text", async () => {
		const events = await client.stream("basic-stream", { message: "test" });
		expect(events[2]).toEqual({ event: "named", data: "hello" });
	});

	test("named event + JSON", async () => {
		const events = await client.stream("basic-stream", { message: "test" });
		expect(events[3]).toEqual({ event: "named-json", data: { text: "world" } });
	});

	test("all emit types in sequence", async () => {
		const events = await client.stream("basic-stream", { message: "hi" });
		expect(events).toEqual([
			{ data: "hi" },
			{ data: { key: "value" } },
			{ event: "named", data: "hello" },
			{ event: "named-json", data: { text: "world" } },
		]);
	});

	test("fail() emits error event and stops", async () => {
		const events = await client.stream("fail-stream", {});
		expect(events).toEqual([
			{ event: "before-fail", data: "ok" },
			{ event: "error", data: { message: "Something went wrong" } },
		]);
	});

	test("close() stops collection", async () => {
		const events = await client.stream("close-stream", {});
		expect(events).toEqual([{ event: "before-close", data: "ok" }]);
	});

	test("input validation throws on bad input", async () => {
		expect(client.stream("basic-stream", {})).rejects.toThrow("Validation failed");
	});

	test("stream() on request feature throws", async () => {
		expect(client.stream("request-feature", {})).rejects.toThrow("not a stream feature");
	});

	test("empty stream returns empty array", async () => {
		const events = await client.stream("empty-stream", {});
		expect(events).toEqual([]);
	});
});
