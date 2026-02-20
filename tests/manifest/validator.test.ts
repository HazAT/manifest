import { describe, expect, test } from "bun:test";
import { t } from "../../manifest/types";
import { validateInput } from "../../manifest/validator";

const schema = {
	email: t.string({ description: "Email.", required: true, format: "email" }),
	password: t.string({
		description: "Password.",
		required: true,
		minLength: 8,
		maxLength: 128,
	}),
	displayName: t.string({
		description: "Name.",
		required: true,
		maxLength: 50,
	}),
	bio: t.string({ description: "Bio.", required: false, maxLength: 500 }),
	age: t.integer({ description: "Age.", required: false, min: 0, max: 150 }),
	score: t.number({ description: "Score.", required: false, min: 0 }),
	acceptTerms: t.boolean({ description: "Terms.", required: true }),
	tags: t.array({ description: "Tags.", itemType: "string", required: false }),
};

describe("validateInput", () => {
	test("passes with valid input", () => {
		const errors = validateInput(schema, {
			email: "user@example.com",
			password: "secure-pass-123",
			displayName: "Jane",
			acceptTerms: true,
		});
		expect(errors).toEqual({});
	});

	test("catches missing required fields", () => {
		const errors = validateInput(schema, {});
		expect(errors.email).toBe("required");
		expect(errors.password).toBe("required");
		expect(errors.displayName).toBe("required");
		expect(errors.acceptTerms).toBe("required");
		expect(errors.bio).toBeUndefined();
		expect(errors.age).toBeUndefined();
	});

	test("catches invalid email format", () => {
		const errors = validateInput(schema, {
			email: "not-an-email",
			password: "secure-pass-123",
			displayName: "Jane",
			acceptTerms: true,
		});
		expect(errors.email).toBe("invalid_format");
	});

	test("catches string too short", () => {
		const errors = validateInput(schema, {
			email: "user@example.com",
			password: "short",
			displayName: "Jane",
			acceptTerms: true,
		});
		expect(errors.password).toBe("min_length");
	});

	test("catches string too long", () => {
		const errors = validateInput(schema, {
			email: "user@example.com",
			password: "secure-pass-123",
			displayName: "A".repeat(51),
			acceptTerms: true,
		});
		expect(errors.displayName).toBe("max_length");
	});

	test("catches integer out of range", () => {
		const errors = validateInput(schema, {
			email: "user@example.com",
			password: "secure-pass-123",
			displayName: "Jane",
			acceptTerms: true,
			age: -1,
		});
		expect(errors.age).toBe("min");
	});

	test("catches number out of range", () => {
		const errors = validateInput(schema, {
			email: "user@example.com",
			password: "secure-pass-123",
			displayName: "Jane",
			acceptTerms: true,
			score: -5,
		});
		expect(errors.score).toBe("min");
	});

	test("ignores optional fields when absent", () => {
		const errors = validateInput(schema, {
			email: "user@example.com",
			password: "secure-pass-123",
			displayName: "Jane",
			acceptTerms: true,
		});
		expect(errors).toEqual({});
	});
});
