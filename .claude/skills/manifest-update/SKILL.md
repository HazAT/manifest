---
name: manifest-update
description: Update your Manifest project from the upstream base repository. Use when the user says "manifest update", "update from upstream", or "pull upstream changes". Reads upstream commits, understands intent, and applies changes intelligently.
---

# Manifest Update

Update your Manifest project from the upstream Manifest repository using interactive cherry-pick.

**When to use:** The user says "manifest update", "update from upstream", "pull upstream changes", or similar.

---

## Philosophy

You control what enters your app. The agent reads upstream commits, batches them by area, detects dependencies, and recommends what to pick or skip — but **you decide**. Cherry-pick over rebase: selective, intentional, no surprises.

The `manifest` branch is your local read-only copy of the upstream framework. `main` is your application. Updates flow from `manifest-upstream` remote → `manifest` branch → cherry-pick onto `main`.

## Steps

### 1. Ensure Setup Is Correct

Verify the two-branch model is in place:

```bash
# Check manifest-upstream remote
git remote get-url manifest-upstream 2>/dev/null || echo "MISSING"

# Check manifest branch exists
git branch --list manifest | grep -q manifest || echo "MISSING"
```

**If `manifest-upstream` remote is missing:**

```bash
git remote add manifest-upstream https://github.com/HazAT/manifest.git
```

**If `manifest` branch is missing (migration from old setup):**

The user likely cloned with the old flow (no branch separation). Offer migration:

```bash
# Fetch upstream so we have a reference
git fetch manifest-upstream

# Create manifest branch from upstream's main
git branch manifest manifest-upstream/main
```

If the old `upstream` remote exists, clean it up:

```bash
git remote remove upstream 2>/dev/null
```

### 2. Sync the Manifest Branch

Fast-forward `manifest` to match upstream:

```bash
git fetch manifest-upstream
git checkout manifest
git merge --ff-only manifest-upstream/main
git checkout -    # back to previous branch
```

**If fast-forward fails:** Someone committed directly to the `manifest` branch. This should never happen — `manifest` is a read-only mirror. Warn the user and abort. They need to manually resolve (likely `git reset --hard manifest-upstream/main` on the `manifest` branch after backing up any commits they want to keep).

### 3. Discover What's New

Find commits on `manifest` that haven't been cherry-picked onto `main` yet.

**If a `manifest-sync-*` tag exists** (previous update was done):

```bash
# Find the most recent sync tag
LAST_SYNC=$(git tag -l 'manifest-sync-*' --sort=-creatordate | head -1)
git log --oneline "$LAST_SYNC"..manifest
```

**If no sync tag exists** (first time):

```bash
git log --oneline main..manifest
```

Read the **full commit messages** for every new commit — the body contains context about what changed and why:

```bash
git log --format="medium" "$LAST_SYNC"..manifest
# or for first time:
git log --format="medium" main..manifest
```

If there are no new commits, tell the user they're up to date and stop.

### 4. Batch and Categorize

Group commits by the area they touch:

| Area | Path pattern | Description |
|------|-------------|-------------|
| **Framework** | `manifest/` | Core framework improvements |
| **Skills** | `.claude/skills/` | Prompt and workflow refinements |
| **Docs** | `AGENTS.md`, `SPARK.md`, `README.md` | Documentation updates |
| **Extensions** | `extensions/` | New or updated extensions |
| **Config** | `config/` | Config structure changes |

**Detect dependencies between commits:**
- If commit B modifies a file that commit A created → they're linked
- If commit B's message references commit A → they're linked
- Present linked commits as an **atomic batch**: "pick all or none"

A single commit touching multiple areas goes into whichever area has the most significant changes.

### 5. Present Recommendations

For each batch, present:

```
### Batch 1: Framework — Router improvements
Commits: abc1234, def5678
Files: manifest/router.ts, manifest/server.ts
Recommendation: **Pick** ✅
Reasoning: Adds path parameter validation. No conflicts with local changes.

### Batch 2: Docs — Updated AGENTS.md
Commits: 111aaaa
Files: AGENTS.md
Recommendation: **Review carefully** ⚠️
Reasoning: You've customized AGENTS.md. Cherry-pick will likely conflict.
Compare your version with upstream before deciding.

### Batch 3: Skills — New brainstorm skill
Commits: 222bbbb, 333cccc (linked — 333cccc depends on 222bbbb)
Files: .claude/skills/brainstorm/SKILL.md
Recommendation: **Pick** ✅
Reasoning: New file, no conflicts possible.
```

**Before recommending**, check if the user has modified any of the files that upstream commits touch:

```bash
# For each file in a batch, check if main has diverged from the common ancestor
MERGE_BASE=$(git merge-base main manifest)
git diff --name-only "$MERGE_BASE" main -- <file>
```

If a file was modified locally, flag the batch as "Review carefully" and explain what the user changed vs what upstream changed.

**Ask the user which batches to take.** Never auto-pick everything.

### 6. Cherry-Pick Selected Batches

Apply the user's chosen commits in order:

```bash
git cherry-pick <hash1> <hash2> ...
```

**If a cherry-pick conflicts:**

1. Read both versions of the conflicted file
2. Determine the right resolution:
   - **Framework file the user hasn't customized** → accept upstream's version
   - **Framework file the user has customized** → merge both changes, preserving the user's customizations while incorporating the upstream improvement
   - **App-specific file** (`VISION.md`, user features, user services) → keep the user's version
3. Resolve, stage, and continue:

```bash
# After editing the conflicted file
git add <resolved-file>
GIT_EDITOR=true git cherry-pick --continue
```

Always use `GIT_EDITOR=true` to avoid blocking on an interactive editor.

If a cherry-pick is hopelessly conflicted, abort it and tell the user:

```bash
git cherry-pick --abort
```

### 7. Tag the Sync Point

After all selected commits are applied, tag so the next update knows where to start:

```bash
git tag manifest-sync-$(date +%Y-%m-%d)
```

If a tag for today already exists, append a sequence number:

```bash
# Check if today's tag exists
DATE=$(date +%Y-%m-%d)
if git tag -l "manifest-sync-$DATE" | grep -q .; then
  SEQ=2
  while git tag -l "manifest-sync-$DATE-$SEQ" | grep -q .; do
    SEQ=$((SEQ + 1))
  done
  git tag "manifest-sync-$DATE-$SEQ"
else
  git tag "manifest-sync-$DATE"
fi
```

### 8. Verify

Run the standard checks to make sure nothing broke:

```bash
bun test
bunx tsc --noEmit
bun run manifest check
```

All three must pass. If something fails, investigate and fix before considering the update complete.

---

## Rules

- **Never auto-pick everything.** The agent recommends, the user decides.
- **Never modify the `manifest` branch.** It's a read-only mirror of upstream.
- **Always tag after syncing** so the next update knows where to start.
- **Always use `GIT_EDITOR=true`** when git commands might open an editor.
- **Always read commits first.** Understand what upstream changed before applying anything.
- **Always test after cherry-picking.** `bun test`, `bunx tsc --noEmit`, `bun run manifest check`.
- **Warn about local modifications.** If the user has customized files that upstream also changed, flag it before cherry-picking.
- **Preserve app identity.** `VISION.md`, user features, user services, and deployment configs are the user's — never overwrite them with upstream versions.
