import type { AuthUser } from "../../../manifest/feature";
import config from "../config";
import { authDb } from "./authDb";

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}

export class EmailExistsError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EmailExistsError";
	}
}

export class InvalidCredentialsError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvalidCredentialsError";
	}
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Generate a 64-character hex session token using crypto.getRandomValues. */
function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/** Parse a named cookie from the Cookie header string. */
function parseCookies(cookieHeader: string): Record<string, string> {
	const cookies: Record<string, string> = {};
	for (const part of cookieHeader.split(";")) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;
		const key = part.slice(0, eq).trim();
		const value = part.slice(eq + 1).trim();
		cookies[key] = decodeURIComponent(value);
	}
	return cookies;
}

// ---------------------------------------------------------------------------
// Cookie helpers (exported — used by features to set/clear the session cookie)
// ---------------------------------------------------------------------------

/** Build a Set-Cookie string that sets the session cookie for the given token. */
export function buildSessionCookie(token: string): string {
	const maxAge = config.sessionDurationSeconds;
	const parts = [
		`${config.cookie.name}=${token}`,
		`Path=${config.cookie.path}`,
		`Max-Age=${maxAge}`,
		"HttpOnly",
		`SameSite=${config.cookie.sameSite}`,
	];
	if (config.cookie.secure) parts.push("Secure");
	return parts.join("; ");
}

/** Build a Set-Cookie string that immediately clears the session cookie. */
export function buildClearCookie(): string {
	const parts = [
		`${config.cookie.name}=`,
		`Path=${config.cookie.path}`,
		"Max-Age=0",
		"HttpOnly",
		`SameSite=${config.cookie.sameSite}`,
	];
	if (config.cookie.secure) parts.push("Secure");
	return parts.join("; ");
}

// ---------------------------------------------------------------------------
// Auth service
// ---------------------------------------------------------------------------

/**
 * Core auth business logic for the manifest-auth extension.
 * Handles registration, login, session management, and request auth resolution.
 * Uses SQLite via authDb and Bun's built-in bcrypt password hashing.
 */
export const auth = {
	/**
	 * Register a new user. Normalizes the email to lowercase, validates password
	 * length, checks uniqueness, hashes with Bun.password (bcrypt), and inserts
	 * into the database.
	 *
	 * Throws `ValidationError` if the password is too short.
	 * Throws `EmailExistsError` if the email is already registered.
	 */
	async register(
		email: string,
		password: string,
	): Promise<{ id: string; email: string; createdAt: string }> {
		const normalizedEmail = email.toLowerCase().trim();

		if (password.length < config.validation.minPasswordLength) {
			throw new ValidationError(
				`Password must be at least ${config.validation.minPasswordLength} characters`,
			);
		}

		// Fast fail before hashing (which is intentionally slow)
		const existing = authDb.getUserByEmail(normalizedEmail);
		if (existing) throw new EmailExistsError("Email already registered");

		const hash = await Bun.password.hash(password);
		const id = crypto.randomUUID();
		const createdAt = new Date().toISOString();

		try {
			authDb.createUser({ id, email: normalizedEmail, passwordHash: hash });
		} catch (err: unknown) {
			// Guard against a race condition where two requests register the same email
			if (err instanceof Error && err.message?.includes("UNIQUE constraint")) {
				throw new EmailExistsError("Email already registered");
			}
			throw err;
		}

		return { id, email: normalizedEmail, createdAt };
	},

	/**
	 * Login with email and password. Returns the user and a session token on
	 * success. Both wrong-email and wrong-password produce the same error to
	 * prevent email enumeration.
	 *
	 * Throws `InvalidCredentialsError` if credentials are invalid.
	 */
	async login(email: string, password: string): Promise<{ user: AuthUser; sessionToken: string }> {
		const normalizedEmail = email.toLowerCase().trim();
		const user = authDb.getUserByEmail(normalizedEmail);
		if (!user) throw new InvalidCredentialsError("Invalid credentials");

		const match = await Bun.password.verify(password, user.password_hash);
		if (!match) throw new InvalidCredentialsError("Invalid credentials");

		const sessionToken = generateSessionToken();
		const expiresAt = new Date(Date.now() + config.sessionDurationSeconds * 1000).toISOString();
		authDb.createSession({ id: sessionToken, userId: user.id, expiresAt });

		return { user: { id: user.id, email: user.email }, sessionToken };
	},

	/**
	 * Logout — delete the session identified by the given token.
	 * No-op if the session does not exist.
	 */
	logout(sessionToken: string): void {
		authDb.deleteSession(sessionToken);
	},

	/**
	 * Validate a session token. Checks existence and expiry, then resolves the
	 * associated user. Deletes expired sessions on the way out.
	 *
	 * Returns the authenticated user or null if the session is absent or expired.
	 */
	validateSession(sessionToken: string): AuthUser | null {
		const session = authDb.getSession(sessionToken);
		if (!session) return null;

		if (new Date(session.expires_at) < new Date()) {
			authDb.deleteSession(sessionToken);
			return null;
		}

		const user = authDb.getUserById(session.user_id);
		if (!user) return null;

		return { id: user.id, email: user.email };
	},

	/**
	 * Create an auth resolver function suitable for passing to the Manifest server.
	 * The returned function reads the session cookie from the request, validates it,
	 * and returns the authenticated user or null.
	 */
	createAuthResolver(): (req: Request) => Promise<AuthUser | null> {
		return async (req: Request): Promise<AuthUser | null> => {
			const cookieHeader = req.headers.get("cookie");
			if (!cookieHeader) return null;

			const cookies = parseCookies(cookieHeader);
			const token = cookies[config.cookie.name];
			if (!token) return null;

			return auth.validateSession(token);
		};
	},
};
