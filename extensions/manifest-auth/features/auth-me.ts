import { defineFeature } from "../../../manifest";

export default defineFeature({
	name: "auth-me",
	description: `Returns the currently authenticated user's profile. Requires a valid
                session cookie. The user object is resolved by the server's auth
                middleware before this handler runs — no database lookup needed here.`,
	route: ["GET", "/api/auth/me"],
	authentication: "required",
	sideEffects: [],
	errorCases: [],

	input: {},

	async handle({ user, ok }) {
		return ok("Current user", { data: { user } });
	},
});
