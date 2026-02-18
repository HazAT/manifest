---
name: manifest-update
description: Update your Manifest project from the upstream base repository. Use when the user says "manifest update", "update from upstream", or "pull upstream changes". Computes the aggregate diff since last sync and applies it atomically.
---

# Manifest Update

Update your Manifest project from the upstream Manifest repository using diff-based atomic sync.

**When to use:** The user says "manifest update", "update from upstream", "pull upstream changes", or similar.

---

## Philosophy

You control what enters your app. The agent computes what changed upstream since your last sync, shows the changes grouped by area, and applies them as a single atomic diff. No per-commit cherry-picking, no replay of already-applied changes, no cascade of false conflicts.

The `manifest` branch is your local read-only copy of the upstream framework. `main` is your application. Updates flow from `manifest-upstream` remote → `manifest` branch → aggregate diff onto `main`.

## How It Works

A `.manifest-sync` file in the project root stores the upstream commit hash that `main` was last synced to. On update:

1. Fetch upstream and fast-forward the `manifest` branch
2. Diff between `.manifest-sync` hash and current `manifest` HEAD
3. Show what changed (commits for context, files for review)
4. Apply the aggregate diff as a single commit
5. Update `.manifest-sync` to the new upstream hash

Conflicts are resolved **once per file** — not once per upstream commit.

## Steps

### 1. Ensure Setup Is Correct

```bash
# Check manifest-upstream remote
git remote get-url manifest-upstream 2>/dev/null || echo "MISSING"

# Check manifest branch exists
git branch --list manifest | grep -q manifest || echo "MISSING"

# Check .manifest-sync exists
test -f .manifest-sync && echo "Sync file: $(cat .manifest-sync)" || echo "MISSING"
```

**If `manifest-upstream` remote is missing:**

```bash
git remote add manifest-upstream https://github.com/HazAT/manifest.git
```

**If `manifest` branch is missing:**

```bash
git fetch manifest-upstream
git branch manifest manifest-upstream/main
```

**If `.manifest-sync` is missing:**

This means the project hasn't synced before with the new mechanism. Set it to the current `manifest` HEAD so that future updates diff from here:

```bash
echo "$(git rev-parse manifest)" > .manifest-sync
git add .manifest-sync
git commit -m "chore: initialize manifest sync marker"
```

Then tell the user: "Sync marker initialized. Run `manifest update` again next time upstream has new changes."

### 2. Sync the Manifest Branch

Fast-forward `manifest` to match upstream:

```bash
git fetch manifest-upstream
git checkout manifest
git merge --ff-only manifest-upstream/main
git checkout -    # back to previous branch
```

**If fast-forward fails:** Someone committed directly to the `manifest` branch. This should never happen — `manifest` is a read-only mirror. Warn the user and offer `git reset --hard manifest-upstream/main` on the `manifest` branch.

### 3. Check for New Changes

```bash
LAST_SYNC=$(cat .manifest-sync)
UPSTREAM=$(git rev-parse manifest)
```

If `$LAST_SYNC` equals `$UPSTREAM`, tell the user they're up to date and stop.

Show upstream commits for context (the "why"):

```bash
git log --oneline "$LAST_SYNC".."$UPSTREAM"
```

Show aggregate file changes (the "what"):

```bash
git diff --stat "$LAST_SYNC".."$UPSTREAM"
```

Read the full commit messages to understand intent:

```bash
git log --format="medium" "$LAST_SYNC".."$UPSTREAM"
```

### 4. Categorize and Present

Group changed files by area:

| Area | Path pattern | Description |
|------|-------------|-------------|
| **Framework** | `manifest/` | Core framework improvements |
| **Skills** | `.claude/skills/` | Prompt and workflow refinements |
| **Docs** | `AGENTS.md`, `SPARK.md`, `README.md` | Documentation updates |
| **Extensions** | `extensions/` | New or updated extensions |
| **Config** | `config/` | Config structure changes |
| **Root** | `index.ts`, `package.json`, `tsconfig.json` | Project root files |

For each area, check if the user has locally modified any of the same files since the last sync:

```bash
UPSTREAM_FILES=$(git diff --name-only "$LAST_SYNC".."$UPSTREAM")

for file in $UPSTREAM_FILES; do
  LOCAL_CHANGE=$(git diff --name-only "$LAST_SYNC"..HEAD -- "$file")
  if [ -n "$LOCAL_CHANGE" ]; then
    echo "⚠️  $file — changed both upstream and locally (will need merge)"
  fi
done
```

Present a summary like:

```
### Framework (manifest/)
Files: manifest/server.ts, manifest/frontend.ts
Status: Clean — no local changes ✅

### Docs
Files: AGENTS.md
Status: ⚠️ Locally modified — will need merge
```

**Ask the user to confirm before applying.**

### 5. Apply the Diff

Generate and apply the aggregate patch:

```bash
git diff "$LAST_SYNC".."$UPSTREAM" > /tmp/manifest-update.patch
git apply --3way /tmp/manifest-update.patch
```

**If everything applies cleanly** — proceed to step 6.

**If `git apply --3way` reports conflicts:**

The working tree will have conflict markers in affected files. Resolve them:

1. Read both versions of each conflicted file
2. Resolution rules:
   - **Framework file not locally customized** → take upstream's version: `git checkout manifest -- <file>`
   - **Framework file locally customized** → merge both changes, preserving local customizations while incorporating the upstream improvement
   - **App-specific file** (`VISION.md`, user features, user services) → keep your version
3. Stage resolved files: `git add <resolved-file>`

**If `git apply --3way` fails entirely** (e.g., binary files, renames), fall back to per-file application:

```bash
# For each changed file, decide:
# - No local changes → take upstream version directly
git checkout manifest -- <file>

# - Local changes exist → 3-way merge manually
# Read the base (last sync), upstream, and local versions, then merge
```

### 6. Commit the Sync

```bash
# Update the sync marker
echo "$UPSTREAM" > .manifest-sync

# Stage all changes
git add -A

# Commit
git commit -m "sync: update manifest framework to $(echo $UPSTREAM | head -c 7)

Synced from $(echo $LAST_SYNC | head -c 7) to $(echo $UPSTREAM | head -c 7).

Upstream commits:
$(git log --oneline "$LAST_SYNC".."$UPSTREAM")

Changed files:
$(git diff --stat "$LAST_SYNC".."$UPSTREAM" | tail -1)"
```

### 7. Verify

```bash
bun test
bunx tsc --noEmit
```

Both must pass. If something fails, investigate and fix before considering the update complete.

---

## Rules

- **Always show what changed before applying.** The agent presents areas and conflict risk. The user confirms.
- **Never modify the `manifest` branch.** It's a read-only mirror of upstream.
- **Always update `.manifest-sync` after syncing** so the next update starts from the right place.
- **Always use `GIT_EDITOR=true`** when git commands might open an editor.
- **Always read upstream commits first.** The commit messages explain why things changed — show them to the user.
- **Always test after syncing.** `bun test`, `bunx tsc --noEmit`.
- **Warn about local modifications.** Flag files changed on both sides before applying.
- **Preserve app identity.** `VISION.md`, user features, user services, and deployment configs are the user's — never overwrite them with upstream versions.
- **One commit per sync.** The entire update is a single descriptive commit, not a replay of upstream history.
