---
name: manifest-learn
description: Reflect on recent large changes and check if the rest of the codebase needs to catch up. Use after adding features, installing extensions, changing services, updating schemas, or making any significant structural change.
---

# Manifest Learn

After making significant changes to the codebase — adding features, installing extensions, creating services, modifying schemas, changing framework code — stop and reflect. The codebase is a living system. When one part changes, other parts may need to catch up.

**When to use:** After any change that isn't a trivial bug fix. The bigger the change, the more important this is. Especially after:
- Adding or removing features
- Installing or updating extensions
- Adding new services or schemas
- Changing framework code in `manifest/`
- Adding new dependencies
- Changing config structure
- Introducing new patterns or conventions

---

## The Checklist

Work through each item. Not everything will need updating every time — but you must **check** every time.

### 1. AGENTS.md

Read `AGENTS.md` (the project root one, not the pi-level one). Ask yourself:

- **Principles** — Did this change introduce a new pattern or convention? Should it be documented as a principle so future agents follow it?
- **Project Structure** — Did the directory layout change? New directories? New file types?
- **How to Write a Feature/Test/Schema/Service** — Did this change alter any of these patterns? New fields? New conventions?
- **Common Commands** — Any new commands the agent should know about?
- **The Framework table** — Did framework files change? Are line counts still accurate?
- **Extensions section** — New extensions installed?

If any section is stale, update it. AGENTS.md is the first thing an agent reads — if it's wrong, every subsequent action is built on a lie.

### 2. Skills

Check each skill in `.claude/skills/`:

- **manifest-commit** — Does the commit format still match current conventions? Are there new scopes to document?
- **manifest-update** — Does the update process need new steps given what changed?
- **manifest-learn** (this skill) — Does this checklist need new items?
- **Any project-specific skills** — Are they still accurate?

Also ask: **should a new skill exist?** If you've introduced a repeatable pattern (e.g., "how to add an extension", "how to write a migration"), it might deserve its own skill.

### 3. Config

Read `config/manifest.ts` and any other config files:

- Are there new config values needed for what was just added?
- Are existing config values still relevant?
- Did an extension bring its own config that should be documented?

### 4. Extensions

If extensions were added or modified:

- Does each extension have an `EXTENSION.md`?
- Does `AGENTS.md` mention the extension?
- Are the extension's dependencies installed?

### 5. Tests

- Do new features have corresponding test files?
- Did changes to schemas/services break existing tests?

```bash
bun test
```

### 6. Types and Build

```bash
bunx tsc --noEmit
```

Does everything still compile?

### 7. Dependencies

If new packages were installed:

- Are they imported explicitly where used?
- Is there a reason documented somewhere (commit message, AGENTS.md, or feature description) for why this dependency exists?

### 8. Git Log Coherence

Read the recent commit history:

```bash
git log -n 10 --pretty=format:"%s"
```

Does the story make sense? Would an agent reading this cold understand the progression of changes? If not, the next commit should include context that ties things together.

---

## How to Run This

Work through the checklist above item by item. The goal is semantic accuracy — is the documentation *actually correct*, not just *present*?

---

## The Mindset

This isn't busywork. The codebase is a shared workspace between you and the next agent (or human) who touches it. When you change something significant and don't update the surrounding documentation, you're leaving a trap. The next reader will trust AGENTS.md, follow its instructions, and produce wrong code because the instructions are stale.

**Think of it like a pair programming partner.** When your pair changes an interface, you update the callers. When they add a new module, you update the README. This is the same thing — except your pair might be a future version of yourself that has no memory of what you did today.

Every time you finish a significant change: stop, work through the checklist, and make it right.
