---
name: manifest-merge-conflicts
description: Resolve merge conflicts from upstream or other repos. Preserves application identity while accepting framework and tooling improvements. Use when you see merge conflict markers, failed cherry-picks, or the user says "resolve conflicts", "fix merge", or "merge conflict".
---

# Manifest Merge Conflict Resolution

Resolve merge conflicts intelligently. The cardinal rule: **never change what the app is supposed to be.** Framework improvements, prompt refinements, and documentation polish from upstream are welcome. Application-specific features, business logic, and identity are sacred.

**When to use:** You see conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), a cherry-pick has failed, or the user asks for help resolving conflicts.

---

## Philosophy

Manifest uses a two-branch model:

- **`manifest`** branch — a local, read-only mirror of the upstream framework repo
- **`main`** branch — YOUR application, where all development happens

Updates flow from `manifest` to `main` via **cherry-pick**. Conflicts happen when cherry-picking upstream commits onto your application branch. The two sides are always clear: your app (`main`) vs. the incoming upstream commit.

The upstream repo evolves the framework, CLI, docs, skills, and conventions. Your project evolves the application — features, schemas, services, config, and vision. When these collide, the app wins. Always.

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

# Are we in a cherry-pick?
test -f .git/CHERRY_PICK_HEAD && echo "Cherry-pick in progress" || echo "Not in a cherry-pick"

# How many files have conflicts?
git diff --name-only --diff-filter=U

# What commit is being cherry-picked?
cat .git/CHERRY_PICK_HEAD 2>/dev/null && git log --oneline -1 $(cat .git/CHERRY_PICK_HEAD)
```

### 2. Understand the Divergence

Look at what the cherry-picked commit does and how it relates to your `main` branch:

```bash
# See the cherry-picked commit's full message and diff
git log -1 -p $(cat .git/CHERRY_PICK_HEAD)

# See recent history on main for context
git log --oneline -10 HEAD
```

Read the commit message — it tells you the *intent* behind the change. In Manifest, commit messages are knowledge transfer — use them.

### 3. Categorize Each Conflicted File

For every conflicted file, decide which category it falls into:

```bash
# List all conflicted files
git diff --name-only --diff-filter=U
```

During a cherry-pick, `--ours` and `--theirs` are intuitive:
- **`--ours`** = your `main` branch (your application)
- **`--theirs`** = the cherry-picked commit from `manifest`

**Category A: Framework files (`manifest/`)**
Take the upstream version unless you've made deliberate local modifications. If you have local changes, read both versions and merge the intent — keep your customizations, adopt upstream's improvements.

```bash
# If you haven't modified this file locally, just take upstream
git checkout --theirs manifest/some-file.ts
```

**Category B: Application files (`features/`, `schemas/`, `services/`, `config/`)**
Keep YOUR version. These define what your app is. Upstream's versions are templates/examples — they have no authority over your application.

```bash
# Keep your version
git checkout --ours features/some-feature.ts
```

**Category C: Documentation and skills (`AGENTS.md`, `.claude/skills/`, `README.md`)**
This is nuanced. These files have two layers:
- **Framework documentation** (how Manifest works) — accept upstream improvements
- **Application documentation** (what YOUR app does) — keep yours

For `AGENTS.md`: upstream may have improved the framework sections (How to Write a Feature, Common Commands, The Framework table). Accept those. But any section describing YOUR app's architecture, conventions, or decisions stays yours.

For skills: upstream may have refined prompts, added better examples, or fixed instructions. These are generally safe to accept — they're improvements to the tooling, not changes to your app.

**Category D: Lockfile (`bun.lockb`)**
Reinstall after resolving — don't resolve manually.

```bash
git checkout --theirs bun.lockb 2>/dev/null || true
```

**Category E: Vision file (`VISION.md`)**
Always keep yours. No exceptions.

```bash
git checkout --ours VISION.md
```

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

### 7. Complete the Cherry-Pick

```bash
# Stage all resolved files
git add -A

# Continue the cherry-pick
git cherry-pick --continue
```

The cherry-pick will use the original upstream commit message. If you want to annotate it with what you adapted, amend:

```bash
git commit --amend
```

Add a note in the body explaining what you accepted, adapted, and rejected:

```
Accepted:
- manifest/server.ts: improved error handling for streams

Protected (kept ours):
- features/*: all application features preserved as-is
- VISION.md: our app identity unchanged

Adapted:
- AGENTS.md: accepted framework doc improvements, kept our
  custom architecture section and extension docs

All tests pass. tsc clean.
```

---

## Rules

1. **VISION.md is untouchable.** Always keep yours. It defines what the app IS.
2. **Features are sovereign.** Your `features/`, `schemas/`, `services/` are your application. Upstream versions are irrelevant templates.
3. **Framework improvements are welcome.** Better code in `manifest/` is a gift — accept it unless it breaks your customizations.
4. **Prompt and doc polish is safe.** Refined wording in skills, AGENTS.md framework sections, and README is almost always an improvement. Accept it.
5. **Config is yours.** Your `config/` reflects your deployment, your secrets, your choices. Keep it.
6. **When you don't know, ask the user.** If a conflict is ambiguous — both sides made meaningful changes and you can't tell which matters more — present both versions and ask.
7. **Test after resolving.** No cherry-pick is complete until `bun test` and `tsc` pass.
8. **Document what you did.** The commit should list what was accepted, protected, and adapted so the next update knows the decisions you made.

---

## Guiding the User

When helping a user through merge conflicts, be explicit about what you're doing and why:

1. **Show them the conflict count** — "There are 7 conflicted files. Here's how I'd categorize them..."
2. **Explain each decision** — "This is a framework file and upstream improved it. I'll take their version." or "This is your feature file. I'll keep yours."
3. **Flag ambiguous cases** — "AGENTS.md has conflicts in both framework docs and your custom section. I'll accept their wording improvements but keep your architecture notes. Sound right?"
4. **Summarize at the end** — List what was accepted, what was kept, and what was adapted.

The user should never feel like their app changed out from under them. They should feel like the tooling got better while their application stayed exactly what they built.
