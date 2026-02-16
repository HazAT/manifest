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

Instead, you read what upstream changed, understand the intent, and rebase your local work on top of upstream so your commits stay clean and linear.

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

This is the critical step. **Do not merge or rebase yet.** Read what changed:

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
# File-by-file summary of what's new upstream
git diff HEAD...upstream/main --stat
```

If specific files look important, read them individually:

```bash
git diff HEAD...upstream/main -- manifest/router.ts
```

### 5. Identify Overlap Between Local and Upstream Changes

Find which files **both sides** modified — these are potential conflict zones:

```bash
MERGE_BASE=$(git merge-base HEAD upstream/main)
comm -12 <(git diff --name-only $MERGE_BASE HEAD | sort) <(git diff --name-only $MERGE_BASE upstream/main | sort)
```

For each overlapping file, review both versions to understand the divergence:

```bash
git diff HEAD upstream/main -- path/to/file
```

Also check `git diff --name-only $MERGE_BASE HEAD` to see the full list of local changes.

### 6. Stash Uncommitted Work

If there are uncommitted changes, stash them before rebasing:

```bash
git stash
```

**Important:** The stash pop after rebase can also produce conflicts if stashed files were modified by upstream. Resolve those the same way as rebase conflicts.

### 7. Rebase onto Upstream

Rebase replays your local commits on top of upstream, keeping history linear:

```bash
git rebase upstream/main
```

**Critical: avoid vim.** When `git rebase --continue` needs a commit message (after resolving a conflict), it opens an editor. Use `GIT_EDITOR=true` to accept the existing message without blocking:

```bash
GIT_EDITOR=true git rebase --continue
```

### 8. Resolve Conflicts

When a conflict occurs, the rebase pauses. For each conflicted file, decide:

**A. Keep upstream's version** — You haven't meaningfully customized this file. The upstream change is the right one.

```bash
git checkout --ours path/to/file    # "ours" = upstream during rebase
```

**B. Keep your version** — This is project-specific (e.g., your Dockerfile, your deployment config).

```bash
git checkout --theirs path/to/file  # "theirs" = your commits during rebase
```

**C. Manual merge** — Both sides made meaningful changes. Edit the file to combine them, removing conflict markers.

⚠️ **Rebase flips ours/theirs!** During a rebase:
- `--ours` = the branch you're rebasing **onto** (upstream)
- `--theirs` = the commits being **replayed** (your local work)

This is the opposite of a normal merge. Double-check which version you're keeping.

After resolving all conflicts in a step:

```bash
git add <resolved-files>
GIT_EDITOR=true git rebase --continue
```

### 9. Pop the Stash

If you stashed in step 6:

```bash
git stash pop
```

If the stash pop has conflicts, resolve them the same way — edit the files, remove conflict markers, then `git add` the resolved files and `git stash drop`.

### 10. Test

After the rebase is complete and stash is restored:

```bash
bun test
bunx tsc --noEmit
bun run manifest check
```

All three must pass.

### 11. Update MANIFEST.md

If framework files changed:

```bash
bun run manifest index
```

---

## Rules

- **Prefer rebase over merge.** Keeps history linear and your commits on top.
- **Always use `GIT_EDITOR=true`** when running `git rebase --continue` to avoid blocking on an interactive editor.
- **Never force-apply upstream changes over local customizations.** If you've deliberately changed a file (Dockerfile, deployment config, etc.), keep your version.
- **Always read the commits first.** Understand what upstream changed before touching anything.
- **Always test after the rebase.** `bun test`, `bunx tsc --noEmit`, `bun run manifest check`.
- **It's okay to keep your version.** Upstream serves as reference and inspiration, not law. Project-specific files (Docker, nginx, deployment) are yours.
