---
name: manifest-merge-conflicts
description: Resolve merge conflicts from upstream syncs or other merges. Preserves application identity while accepting framework and tooling improvements. Use when you see merge conflict markers or the user says "resolve conflicts", "fix merge", or "merge conflict".
---

# Manifest Merge Conflict Resolution

Resolve merge conflicts intelligently. The cardinal rule: **never change what the app is supposed to be.** Framework improvements, prompt refinements, and documentation polish from upstream are welcome. Application-specific features, business logic, and identity are sacred.

**When to use:** You see conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), `git apply --3way` left conflicts after a manifest update, or the user asks for help resolving conflicts.

---

## Philosophy

Manifest uses a two-branch model:

- **`manifest`** branch — a local, read-only mirror of the upstream framework repo
- **`main`** branch — YOUR application, where all development happens

Updates flow from `manifest` to `main` via **atomic diff** (see the `manifest-update` skill). Conflicts happen when upstream changes touch files you've also modified locally. The two sides are always clear: your app (`main`) vs. upstream's changes.

The upstream repo evolves the framework, docs, skills, and conventions. Your project evolves the application — features, schemas, services, config, and vision. When these collide, the app wins. Always.

**Accept from upstream:**
- Framework code improvements (`manifest/`)
- Prompt and skill text refinements (`.claude/skills/`, `AGENTS.md` framework sections)
- Documentation polish and typo fixes
- New conventions that don't break existing patterns
- New extensions and extension updates

**Protect from your project:**
- `VISION.md` — this is YOUR app's soul, upstream has no say
- `features/` — your application behavior, never overwritten
- `schemas/` — your data model
- `services/` — your business logic
- `config/` — your configuration choices
- Application-specific sections of `AGENTS.md`
- Any custom extensions you've built

---

## Steps

### 1. Assess the Situation

Before touching anything, understand what happened:

```bash
# What state are we in?
git status

# How many files have conflicts?
grep -rl '<<<<<<<' . --include='*.ts' --include='*.md' --include='*.json' 2>/dev/null

# If coming from a manifest update, check the sync range
LAST_SYNC=$(cat .manifest-sync 2>/dev/null)
echo "Last sync: $LAST_SYNC"
```

### 2. Understand the Divergence

Look at what upstream changed and how it relates to your local changes:

```bash
# See what upstream changed in the conflicted files
LAST_SYNC=$(cat .manifest-sync)
git diff "$LAST_SYNC"..manifest -- <conflicted-file>

# See what you changed locally
git diff "$LAST_SYNC"..HEAD -- <conflicted-file>

# Read upstream commit messages for context
git log --format="medium" "$LAST_SYNC"..manifest -- <conflicted-file>
```

Read the commit messages — they tell you the *intent* behind the change. In Manifest, commit messages are knowledge transfer — use them.

### 3. Categorize Each Conflicted File

For every conflicted file, decide which category it falls into:

```bash
# List all conflicted files
git diff --name-only --diff-filter=U
```

**Category A: Framework files (`manifest/`)**
Take the upstream version unless you've made deliberate local modifications. If you have local changes, read both versions and merge the intent — keep your customizations, adopt upstream's improvements.

```bash
# If you haven't modified this file locally, just take upstream
git checkout manifest -- manifest/some-file.ts
```

**Category B: Application files (`features/`, `schemas/`, `services/`, `config/`)**
Keep YOUR version. These define what your app is. Upstream's versions are templates/examples — they have no authority over your application. Remove the conflict markers and keep your code.

**Category C: Documentation and skills (`AGENTS.md`, `.claude/skills/`, `README.md`)**
This is nuanced. These files have two layers:
- **Framework documentation** (how Manifest works) — accept upstream improvements
- **Application documentation** (what YOUR app does) — keep yours

For `AGENTS.md`: upstream may have improved the framework sections (How to Write a Feature, Common Commands, The Framework table). Accept those. But any section describing YOUR app's architecture, conventions, or decisions stays yours.

For skills: upstream may have refined prompts, added better examples, or fixed instructions. These are generally safe to accept — they're improvements to the tooling, not changes to your app.

**Category D: Lockfile (`bun.lockb`)**
Reinstall after resolving — don't merge manually. Just run `bun install` after all other conflicts are resolved.

**Category E: Vision file (`VISION.md`)**
Always keep yours. No exceptions. Remove any upstream changes to this file.

### 4. Resolve Each Conflict

Work through files one at a time. For each:

1. **Read the full file** — don't just look at the conflict markers
2. **Read both sides of each conflict block** — understand what each is trying to do
3. **Decide** — based on the categories above
4. **Edit** — resolve the conflict, keeping the right intent from each side
5. **Stage** — `git add <file>` when resolved

For complex conflicts in shared files (like `AGENTS.md`), read the conflict blocks carefully:

```bash
# See the conflict in context
git diff <file>
```

The markers look like:
```
<<<<<<< HEAD (yours — main branch, your app)
Your version of this section
=======
Their version of this section
>>>>>>> <commit-hash> (theirs — cherry-picked from manifest)
```

### 5. Handle AGENTS.md Specifically

`AGENTS.md` is the most common and trickiest conflict. It has framework docs AND project docs in one file.

**Framework sections that upstream may improve** (accept improvements):
- "How to Write a Feature/Test/Schema/Service" examples
- "Common Commands" table
- "The Framework" file table (line counts, descriptions)
- "Response Envelope" format
- Principles text (wording refinements)

**Project sections you must protect** (keep yours):
- Any custom conventions you've added
- Project-specific architecture notes
- Custom extensions documentation
- Anything referencing YOUR features, schemas, or services by name

When in doubt: if a change makes the documentation more accurate or clear without changing what the app does, accept it.

### 6. Verify

After resolving all conflicts:

```bash
# Reinstall dependencies (in case package.json or lockfile changed)
bun install

# Run all checks
bun test
bunx tsc --noEmit
```

Both must pass before completing the cherry-pick.

### 7. Stage and Continue

After resolving all conflicts, stage the resolved files. The next step depends on context:

**If resolving during a `manifest update`:**
The update skill handles the commit — just stage the resolved files with `git add -A` and continue following the update skill's step 6.

**If resolving a standalone merge or cherry-pick:**

```bash
git add -A
GIT_EDITOR=true git cherry-pick --continue  # or git merge --continue
```

---

## Rules

1. **VISION.md is untouchable.** Always keep yours. It defines what the app IS.
2. **Features are sovereign.** Your `features/`, `schemas/`, `services/` are your application. Upstream versions are irrelevant templates.
3. **Framework improvements are welcome.** Better code in `manifest/` is a gift — accept it unless it breaks your customizations.
4. **Prompt and doc polish is safe.** Refined wording in skills, AGENTS.md framework sections, and README is almost always an improvement. Accept it.
5. **Config is yours.** Your `config/` reflects your deployment, your secrets, your choices. Keep it.
6. **When you don't know, ask the user.** If a conflict is ambiguous — both sides made meaningful changes and you can't tell which matters more — present both versions and ask.
7. **Test after resolving.** No sync is complete until `bun test` and `tsc` pass.
8. **Document what you did.** The commit should list what was accepted, protected, and adapted so the next update knows the decisions you made.

---

## Guiding the User

When helping a user through merge conflicts, be explicit about what you're doing and why:

1. **Show them the conflict count** — "There are 7 conflicted files. Here's how I'd categorize them..."
2. **Explain each decision** — "This is a framework file and upstream improved it. I'll take their version." or "This is your feature file. I'll keep yours."
3. **Flag ambiguous cases** — "AGENTS.md has conflicts in both framework docs and your custom section. I'll accept their wording improvements but keep your architecture notes. Sound right?"
4. **Summarize at the end** — List what was accepted, what was kept, and what was adapted.

The user should never feel like their app changed out from under them. They should feel like the tooling got better while their application stayed exactly what they built.
