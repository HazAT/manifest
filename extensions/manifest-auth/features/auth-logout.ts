import { defineFeature } from "../../../manifest";
import config from "../config";
import { auth, buildClearCookie } from "../services/auth";

export default defineFeature({
	name: "auth-logout",
	description: `Logs out the current user by deleting their session from the database
                and clearing the session cookie. Requires authentication. The session
                token is read from the cookie header sent with the request.`,
	route: ["POST", "/api/auth/logout"],
	authentication: "required",
	sideEffects: ["Deletes one session row from sessions table", "Clears session cookie"],
	errorCases: [],

	input: {},

	async handle({ request, ok }) {
		const cookieHeader = request.headers.get("cookie");
		if (cookieHeader) {
			for (const cookie of cookieHeader.split(";")) {
				const eq = cookie.indexOf("=");
				if (eq === -1) continue;
				const key = cookie.slice(0, eq).trim();
				if (key === config.cookie.name) {
					const token = decodeURIComponent(cookie.slice(eq + 1).trim());
					auth.logout(token);
					break;
				}
			}
		}
		return ok("Logged out", {
			headers: { "Set-Cookie": buildClearCookie() },
		});
	},
});
