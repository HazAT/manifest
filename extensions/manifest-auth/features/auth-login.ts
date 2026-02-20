import { defineFeature, t } from "../../../manifest";
import { auth, buildSessionCookie, InvalidCredentialsError } from "../services/auth";

export default defineFeature({
	name: "auth-login",
	description: `Authenticates a user with email and password. On success, creates a
                session stored in SQLite and sets an HttpOnly session cookie.
                Returns the authenticated user object without sensitive fields.`,
	route: ["POST", "/api/auth/login"],
	authentication: "none",
	sideEffects: ["Creates one session row in sessions table", "Sets HttpOnly session cookie"],
	errorCases: ["401 - Invalid email or password"],

	input: {
		email: t.string({
			description: "User email address.",
			required: true,
			format: "email",
		}),
		password: t.string({
			description: "User password.",
			required: true,
		}),
	},

	async handle({ input, ok, fail }) {
		try {
			const { user, sessionToken } = await auth.login(String(input.email), String(input.password));
			return ok("Logged in", {
				data: { user },
				headers: { "Set-Cookie": buildSessionCookie(sessionToken) },
			});
		} catch (err) {
			if (err instanceof InvalidCredentialsError) return fail("Invalid credentials", 401);
			throw err;
		}
	},
});
