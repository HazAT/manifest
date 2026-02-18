---
name: manifest-contribute
description: Contribute framework improvements back to the upstream Manifest repo via PR. Use when the user says "contribute back", "open a PR upstream", "send this fix upstream", or wants to share a framework improvement.
---

# Manifest Contribute

Contribute improvements from your application back to the upstream Manifest repository.

**When to use:** The user says "contribute back", "open a PR upstream", "send this fix upstream", or similar.

---

## Philosophy

The reverse of `manifest-update`. Update pulls from upstream into your app. Contribute pushes from your app back to upstream. Only framework-level changes are contributed — app-specific code stays local.

The `manifest` branch is your local read-only copy of the upstream framework. Contributions branch off `manifest`, cherry-pick framework commits from `main`, and open a PR against `manifest-upstream`.

## What's Contributable

- Framework improvements (`manifest/` files)
- Skill refinements (`.claude/skills/`)
- Extension improvements or new extensions (`extensions/`)
- Documentation improvements (`AGENTS.md` framework sections, `SPARK.md`)

## What's NOT Contributable

- App-specific features (`features/`)
- App-specific schemas (`schemas/`)
- App-specific services (`services/`)
- `VISION.md` — this is your app's identity
- App-specific config (`config/`)

## Steps

### 1. Ensure Setup Is Correct

Verify the two-branch model is in place:

```bash
# Check manifest-upstream remote
git remote get-url manifest-upstream 2>/dev/null || echo "MISSING"

# Check manifest branch exists
git branch --list manifest | grep -q manifest || echo "MISSING"
```

If either is missing, set them up first (see the `manifest-update` skill).

### 2. Identify Contributable Commits

Find commits on `main` (or the current feature branch) that touch framework files:

```bash
git log main --not manifest -- manifest/ .claude/skills/ extensions/ AGENTS.md SPARK.md --oneline
```

Read the full commit messages for context:

```bash
git log main --not manifest -- manifest/ .claude/skills/ extensions/ AGENTS.md SPARK.md --format="medium"
```

Present the list to the user. **Ask which commits to contribute.** Never auto-select everything.

### 3. Check for Mixed Commits

Some commits may touch both framework and app-specific files. Identify them:

```bash
# For each candidate commit, check what files it touches
git show --stat <hash> --name-only
```

If a commit touches both framework and app files, warn the user: "This commit includes app-specific changes. I'll cherry-pick it and then strip the app-specific parts."

### 4. Sync Manifest Branch

Make sure `manifest` is up to date before branching:

```bash
git fetch manifest-upstream
git checkout manifest
git merge --ff-only manifest-upstream/main
```

If fast-forward fails, warn the user — someone committed directly to `manifest`. This needs manual resolution before continuing.

### 5. Create a Contribution Branch

```bash
git checkout manifest
git checkout -b contribute/<descriptive-name>
```

Use a descriptive name that reflects what's being contributed (e.g., `contribute/router-path-validation`, `contribute/spark-web-dashboard`).

### 6. Cherry-Pick Selected Commits

```bash
git cherry-pick <hash1> <hash2> ...
```

**For mixed commits** (framework + app-specific changes):

1. Cherry-pick the commit
2. Remove app-specific file changes:
   ```bash
   git checkout manifest -- <app-specific-files>
   git add -A
   GIT_EDITOR=true git commit --amend
   ```
3. Verify only framework files remain in the diff

**If a cherry-pick conflicts:**

1. Read both versions and resolve
2. Stage and continue:
   ```bash
   git add <resolved-file>
   GIT_EDITOR=true git cherry-pick --continue
   ```

Always use `GIT_EDITOR=true` to avoid blocking on an interactive editor.

### 7. Verify the Contribution

Run standard checks on the contribution branch:

```bash
bun test
bunx tsc --noEmit
```

Both must pass. Fix any issues before proceeding.

### 8. Push and Open PR

Determine whether you can push directly to the upstream repo or need to fork.

**Check push access:**

```bash
# Extract owner/repo from the manifest-upstream remote URL
UPSTREAM_URL=$(git remote get-url manifest-upstream)
UPSTREAM_REPO=$(echo "$UPSTREAM_URL" | sed -E 's#.+github\.com[:/]([^/]+/[^/.]+)(\.git)?$#\1#')

# Check if the authenticated user has push access
gh api "repos/$UPSTREAM_REPO" --jq '.permissions.push' 2>/dev/null
```

**If you have push access** (result is `true`) — push directly:

```bash
git push manifest-upstream contribute/<descriptive-name>
```

Then open the PR:

```bash
gh pr create \
  --repo "$UPSTREAM_REPO" \
  --base main \
  --head contribute/<descriptive-name> \
  --title "<type>(<scope>): <summary>" \
  --body "<description>"
```

**If you do NOT have push access** (result is `false` or the check fails) — fork first:

```bash
# Fork the upstream repo (idempotent — no-ops if fork already exists)
gh repo fork "$UPSTREAM_REPO" --clone=false

# Get the authenticated user's GitHub username
GH_USER=$(gh api user --jq '.login')

# Add the fork as a remote (skip if already exists)
git remote get-url my-fork 2>/dev/null || git remote add my-fork "https://github.com/$GH_USER/$(basename $UPSTREAM_REPO).git"

# Push to the fork
git push my-fork contribute/<descriptive-name>
```

Then open the PR from the fork against the upstream repo:

```bash
gh pr create \
  --repo "$UPSTREAM_REPO" \
  --base main \
  --head "$GH_USER:contribute/<descriptive-name>" \
  --title "<type>(<scope>): <summary>" \
  --body "<description>"
```

Note the `--head "$GH_USER:contribute/..."` syntax — GitHub needs the fork owner prefix when the PR comes from a fork.

---

**PR guidelines** (apply to both flows):

- `--base main` targets the UPSTREAM repo's main branch (the framework). This is NOT your local `main` branch (your app). On GitHub, `main` = the framework. Locally, `main` = your app and `manifest` = the framework mirror.

The PR title should follow conventional commit format. The body should:
- Explain **what** was improved and **why**
- List the files changed and their purpose
- Note any migration steps if the change affects existing users
- Follow the `manifest-commit` skill conventions for knowledge-transfer writing

### 9. Return to Your Branch

```bash
git checkout main   # or your feature branch
```

The contribution branch stays around until the PR is merged or closed. Don't delete it prematurely.

---

## Rules

- **Only contribute framework-level changes.** App code stays local.
- **Never auto-select commits.** The agent identifies candidates, the user decides.
- **Always strip app-specific changes** from mixed commits before contributing.
- **Always verify before pushing.** `bun test`, `bunx tsc --noEmit`.
- **Always use `GIT_EDITOR=true`** when git commands might open an editor.
- **Write a clear PR description.** The upstream maintainer needs to understand the improvement without context about your specific app.
- **Never modify the `manifest` branch directly.** Contribution branches are created from it, but it remains a read-only mirror.
- **Return to your working branch** when done — don't leave the repo on the contribution branch.
