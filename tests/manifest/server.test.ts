import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import path from "node:path";
import { createManifestServer } from "../../manifest/server";

describe("createManifestServer", () => {
	let server: Awaited<ReturnType<typeof createManifestServer>>;
	let baseUrl: string;

	beforeAll(async () => {
		server = await createManifestServer({
			projectDir: path.resolve(__dirname, "../.."),
			port: 0,
		});
		baseUrl = `http://localhost:${server.port}`;
	});

	afterAll(() => {
		server.stop();
	});

	test("responds to a known feature route", async () => {
		const res = await fetch(`${baseUrl}/api/hello?name=Jane`);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.message).toBe("Hello, Jane!");
		expect(body.data.greeting).toBe("Hello, Jane!");
		expect(body.meta.feature).toBe("hello-world");
		expect(body.meta.request_id).toBeDefined();
		expect(body.meta.duration_ms).toBeDefined();
	});

	test("returns 404 for unknown routes", async () => {
		const res = await fetch(`${baseUrl}/api/nonexistent`);
		const body = await res.json();
		expect(res.status).toBe(404);
		expect(body.message).toBe("Not found");
	});

	test("returns 405 for wrong HTTP method", async () => {
		const res = await fetch(`${baseUrl}/api/hello`, { method: "DELETE" });
		const body = await res.json();
		expect(res.status).toBe(405);
		expect(body.message).toBe("Method not allowed");
	});

	test("returns proper content-type header", async () => {
		const res = await fetch(`${baseUrl}/api/hello`);
		expect(res.headers.get("content-type")).toContain("application/json");
	});

	test("handles feature with no input (defaults)", async () => {
		const res = await fetch(`${baseUrl}/api/hello`);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.message).toBe("Hello, World!");
	});
});
