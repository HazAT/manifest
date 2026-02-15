# Manifest Commit

Write a git commit for the current changes. In Manifest, commits are knowledge transfer — the primary way agents and humans understand what happened and why.

## Format

`<type>(<scope>): <summary>`

- `type` REQUIRED. `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `perf`.
- `scope` OPTIONAL. The area affected: a feature name, `manifest`, `cli`, `config`, etc.
- `summary` REQUIRED. Imperative, <= 72 chars, no trailing period.

## The Body Is Not Optional

Every commit gets a body unless it's a one-character typo fix. The body is how the next agent learns what you did. Write it for someone (or something) reading `git log` weeks from now with no other context.

**What to include:**

- **What** changed — which files, which behaviors, what's different now
- **Why** it changed — the reasoning, the problem it solves, the context that led here
- **How** it was done — the approach, key decisions, tradeoffs considered
- **Migration notes** — if this change requires other files to be updated, say so explicitly. Name the files. If the change is large, point to a plan: `See .pi/plans/2026-02-15-feature.md`
- **What was NOT done** — if you deliberately left something out or chose not to change something related, note it so the next person doesn't wonder

**Example — feature:**
```
feat(auth): add JWT token validation with RS256 signatures

Tokens are parsed and verified in a single pass to avoid double
deserialization. Invalid tokens return structured error responses
with specific failure reasons (expired, malformed, bad signature)
to help client-side debugging.

Expiry tolerance is 30s by default to account for clock skew.
This is configurable via config/manifest.ts `jwtExpiryTolerance`.

Files: manifest/server.ts (auth check in request handler),
       services/jwt.ts (new), features/Login.ts (updated to
       return token), config/manifest.ts (new jwt fields).
```

**Example — bug fix:**
```
fix(registration): handle null displayName from OAuth providers

OAuth providers can omit the display name field entirely. The
registration feature assumed it was always present because the
input schema marks it required — but OAuth-sourced registrations
bypass input validation and pass data directly.

Added nullish coalescing with fallback to email username part.
This only affects the OAuth code path; normal registration still
validates displayName as required.

Root cause: features/UserRegistration.ts line 34 accessed
input.displayName without a null check in the OAuth branch.
```

**Example — framework update from upstream:**
```
chore: update from upstream manifest (upstream@abc1234..def5678)

Applied:
- manifest/validator.ts: new UUID format validation
- manifest/cli/makeFeature.ts: --type flag for stream/event features

Skipped:
- Upstream changed default port to 3000. We use 8080 and have
  it configured in config/manifest.ts. Intentionally kept ours.

Adapted:
- manifest/router.ts: upstream added wildcard routes. Adapted the
  implementation to coexist with our prefix-based tenant routing
  (see services/tenantRouter.ts).

All tests pass. tsc clean. manifest check clean.
```

## Steps

1. Run `git status` and `git diff --staged` (or `git diff` if nothing staged) to understand the changes.
2. Read the changed files to understand context — don't just describe the diff, explain the intent.
3. Check `git log -n 20 --pretty=format:"%s"` to match the project's existing scope conventions.
4. If it's unclear which files should be included, ask.
5. Stage the files: `git add <files>` (all changes if none specified).
6. Commit: `git commit -m "<subject>" -m "<body>"`
7. Do NOT push. Only commit.

## What Makes a Manifest Commit Different

In most projects, commit messages are an afterthought. In Manifest, they're infrastructure. The commit history is:

- **How agents orient.** An agent reads `git log` to understand what happened recently, what's been fixed, what's been changed. Vague messages like "fix stuff" or "update" are dead ends.
- **How upstream updates work.** When someone runs the manifest-update skill, they read every commit message to decide what to apply, skip, or adapt. Your commit message is their migration guide.
- **How debugging works.** When something breaks, `git log --oneline -- features/UserRegistration.ts` shows exactly what changed and why. Good messages make `git bisect` unnecessary.

A commit message in Manifest is not a description of what you typed. It's a letter to the next agent explaining what you did and why.
