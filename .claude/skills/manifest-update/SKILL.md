---
name: manifest-update
description: Update your Manifest project from the upstream base repository. Use when the user says "manifest update", "update from upstream", or "pull upstream changes". Reads upstream commits, understands intent, and applies changes intelligently.
---

# Manifest Update

Update your Manifest project from the upstream base repository.

**When to use:** The user says "manifest update", "update from upstream", "pull upstream changes", or similar.

---

## Philosophy

Manifest ships as source code in your project. You own it. You may have modified framework files, added features, changed conventions. A blind `git merge` from upstream will create conflicts and break things.

Instead, you read what upstream changed, understand the intent, and apply the ideas in the context of what this project has become. You're not merging code — you're transferring knowledge.

## Steps

### 1. Set Up the Upstream Remote (if not already done)

```bash
git remote get-url upstream 2>/dev/null || git remote add upstream https://github.com/hazat/manifest.git
```

### 2. Fetch Upstream

```bash
git fetch upstream main
```

### 3. Read the Upstream Commits

This is the critical step. **Do not merge yet.** Read what changed:

```bash
# See all commits since this project diverged from upstream
git log --oneline HEAD..upstream/main
```

Then read each commit message carefully:

```bash
# Read full commit messages with context
git log --format="medium" HEAD..upstream/main
```

For each commit, understand:
- **What** changed (which files, which concepts)
- **Why** it changed (the reasoning in the commit body)
- **Migration notes** (any instructions in the commit body about what to update)

### 4. Review the Actual Diff

```bash
# See the full diff of what's new upstream
git diff HEAD...upstream/main
```

For a file-by-file view:

```bash
git diff HEAD...upstream/main --stat
```

If specific files look important, read them individually:

```bash
git diff HEAD...upstream/main -- manifest/router.ts
```

### 5. Check for Conflicts with Local Changes

Before doing anything, understand what you've changed locally:

```bash
# Files you've modified in manifest/ compared to when you forked
git log --oneline --all -- manifest/
```

Compare your version of a file with upstream's:

```bash
git diff HEAD upstream/main -- manifest/server.ts
```

### 6. Decide Your Strategy

Based on what you've read, choose one of these approaches **per file or change**:

**A. Clean apply** — You haven't modified this file. The upstream change is straightforward. Apply it directly.

```bash
# Checkout a specific file from upstream
git checkout upstream/main -- manifest/some-file.ts
```

**B. Adapt and implement** — You've modified this file, or the upstream change doesn't apply cleanly. Read the upstream version, understand the intent, and implement the change yourself in a way that fits your project.

Don't copy-paste from upstream. Write the code that belongs in your codebase.

**C. Skip** — The upstream change doesn't apply to your project or conflicts with a deliberate decision you've made. Note it in your commit message so future updates know it was intentional.

### 7. Test

After applying changes:

```bash
bun test
bunx tsc --noEmit
bun run manifest check
```

All three must pass before committing.

### 8. Commit with Full Context

Write a commit message that explains what you pulled from upstream and how you applied it:

```
chore: update from upstream manifest (upstream@abc1234..def5678)

Applied:
- New rate limiting support in manifest/server.ts — adapted to work
  with our custom auth middleware
- Updated manifest/validator.ts with UUID format validation
- New make:schema CLI command

Skipped:
- Upstream changed envelope format to include `timestamp` field —
  we already have this via our custom envelope extension

Adapted:
- Router now supports wildcard routes upstream, but we modified the
  implementation to also support our prefix-based multi-tenant routing

All tests pass. tsc clean. manifest check clean.
```

This commit message is how the next update knows what happened. Make it thorough.

### 9. Update MANIFEST.md

If framework files changed:

```bash
bun run manifest index
```

---

## Rules

- **Never `git merge upstream/main` blindly.** Always read the commits first.
- **Never force-apply upstream changes over local modifications.** If you've customized a file, adapt the upstream change to your version — don't overwrite your work.
- **Always test after applying.** `bun test`, `bunx tsc --noEmit`, `bun run manifest check`.
- **Always write a thorough commit message.** List what was applied, skipped, and adapted. The next person (or agent) doing an update depends on this.
- **It's okay to skip things.** Upstream serves as reference and inspiration, not law. If a change doesn't fit your project, skip it and note why.
