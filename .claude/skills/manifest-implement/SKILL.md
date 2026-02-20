---
name: manifest-implement
description: |
  Structured implementation flow for Manifest features — from investigation through
  execution with subagents. Follows the full chain: investigate → clarify → explore →
  validate → plan → todos → branch → execute → review. No shortcuts.
  Invoke manually when building a new feature or significant change in a Manifest project.
---

# Manifest Implement

A structured implementation flow for building features in a Manifest project. This is the opinionated way to go from idea to shipped code — investigation, design, planning, execution, and review.

**Announce at start:** "Starting a Manifest implementation session. Let me investigate the codebase first, then we'll work through this step by step."

---

## ⚠️ MANDATORY: No Skipping Without Permission

**You MUST follow all phases.** Your judgment that something is "simple" or "straightforward" is NOT sufficient to skip steps.

The ONLY exception: The user explicitly says something like:
- "Skip the plan, just implement it"
- "Just do it quickly"
- "No need for the full process"

If the user hasn't said this, you follow the full flow. Period.

**Why this matters:** You will be tempted to rationalize. You'll think "this is just a small feature" or "this is obvious, no plan needed." That's exactly when the process matters most — consistency builds trust, and "small" changes have a way of growing.

---

## The Flow

```
Phase 1: Investigate the Manifest Project
    ↓
Phase 2: Clarify Requirements
    ↓
Phase 3: Explore Approaches (Manifest-aware)
    ↓
Phase 4: Present & Validate Design
    ↓
Phase 5: Write Plan
    ↓
Phase 6: Create Todos
    ↓
Phase 6.5: Create Feature Branch
    ↓
Phase 7: Execute with Subagents (scout → workers → review)
    ↓
Phase 8: Review
```

---

## 🛑 STOP — Before Writing Any Code

If you're about to edit or create source files, STOP and check:

1. ✅ Did you complete Phase 4 (design validation)?
2. ✅ Did you write a plan to `~/.pi/history/<project>/plans/`?
3. ✅ Did you create todos?

If any answer is NO and the user didn't explicitly skip → you're cutting corners. Go back.

---

## Phase 1: Investigate the Manifest Project

Before asking questions, understand the codebase. This is a Manifest project — you know the structure.

### Read the essentials

```bash
# Understand the app
cat VISION.md
cat AGENTS.md

# See what exists
ls features/
ls schemas/
ls services/
ls extensions/
ls config/

# Check recent activity
git log --oneline -n 10
```

### Look at existing patterns

```bash
# Read 2-3 existing features to understand the app's patterns
head -40 features/*.ts | head -120

# Check schemas for the data model
ls schemas/
head -30 schemas/*.ts | head -90

# Check what services exist
ls services/
```

### What you're looking for

- **What does the app do?** — VISION.md tells you the purpose
- **What features exist?** — Understand the current surface area
- **What's the data model?** — Schemas tell you what entities exist
- **What services are shared?** — Don't reinvent existing logic
- **What conventions does this specific project use?** — Every Manifest project follows the framework but may have its own patterns on top

**After investigating, share what you found:**
> "Here's what I see: [app purpose from VISION.md]. The app currently has [N] features covering [areas]. The data model includes [key tables]. Existing services handle [what]. Now let me understand what you're looking to build."

---

## Phase 2: Clarify Requirements

Work through requirements **one topic at a time**:

### Topics to Cover

1. **Purpose** — What problem does this solve? Who's it for?
2. **Scope** — What's in? What's explicitly out?
3. **Manifest mapping** — Is this a feature, a schema change, a service, or a combination?
4. **Constraints** — Performance, compatibility, timeline?
5. **Success criteria** — How do we know it's done?

### How to Ask

- Group related questions, use `/answer` for multiple questions
- Prefer multiple choice when possible (easier to answer)
- Don't overwhelm — if you have many questions, batch them logically

```
[After listing your questions]
execute_command(command="/answer", reason="Opening Q&A for requirements")
```

### Manifest-Specific Questions to Consider

- Does this need a new schema, or does it extend an existing one?
- Should this be a single feature or multiple features (one behavior per file)?
- Is there authentication required? What level?
- What side effects does this have? (Database writes, external API calls, emails)
- What are the error cases? (Think in HTTP status codes)
- Does this share logic with existing features? (Service extraction)
- Does this need rate limiting?

### Keep Going Until Clear

After each round of answers, either:
- Ask follow-up questions if something is still unclear
- Summarize your understanding and confirm: "So we're building X that does Y for Z. Right?"

**Don't move to Phase 3 until requirements are clear.**

---

## Phase 3: Explore Approaches (Manifest-Aware)

Once requirements are understood, propose 2-3 approaches. Every approach should be grounded in Manifest conventions.

### Think in Manifest Primitives

Every feature maps to one or more of these:
- **Feature** (`defineFeature()`) — The behavior. One file per behavior.
- **Schema** (`pgTable()`) — The data. One file per table.
- **Service** (plain object) — Shared logic. Only when two features need it.
- **Extension** — If it's reusable across projects.

### Present Options

> "A few ways we could approach this:
>
> 1. **Simple approach** — [description].
>    - Features: [list feature files]
>    - Schemas: [new/modified tables]
>    - Pros: fast, minimal
>    - Cons: less flexible
>
> 2. **Full approach** — [description].
>    - Features: [list feature files]
>    - Schemas: [new/modified tables]
>    - Services: [shared logic]
>    - Pros: extensible
>    - Cons: more work
>
> I'd lean toward #1 because [reason]. What do you think?"

### Key Principles

- **Lead with your recommendation** — don't make them guess
- **Be explicit about tradeoffs** — every choice has costs
- **YAGNI ruthlessly** — remove unnecessary complexity
- **One feature, one file** — if you're putting two behaviors in one file, rethink
- **Don't extract services prematurely** — wait for a second consumer
- **Trust the framework** — don't reach for external libraries when `manifest/` handles it

---

## Phase 4: Present & Validate Design

Present the design **in sections**, validating each before moving on.

### Why Sectioned?

- A wall of text gets skimmed; sections get read
- Catches misalignment early
- Easier to course-correct than rewrite

### Section by Section

**Keep each section to 200-300 words.**

#### Section 1: Feature Breakdown
Which features we're creating, what each does, their routes:
> "Does this breakdown make sense? Any behaviors missing or combined that shouldn't be?"

#### Section 2: Data Model
New or modified schemas, relationships:
> "Does this data model capture everything we need?"

#### Section 3: Logic Flow
How requests flow through features, what services are involved:
> "Does this flow make sense?"

#### Section 4: Error Handling & Edge Cases
What can go wrong, how we handle it, HTTP status codes:
> "Any edge cases I'm missing?"

#### Section 5: Testing Approach
How we'll verify it works:
> "Does this testing approach give you confidence?"

**Not every project needs all sections** — use judgment based on complexity. A simple single-feature change might only need Sections 1 and 3.

### Incorporating Feedback

If they suggest changes:
1. Acknowledge the feedback
2. Update your understanding
3. Re-present that section if needed
4. Continue to next section

---

## Phase 5: Write Plan

Once the design is validated:

> "Design is solid. Let me write up the plan."

Create: `~/.pi/history/<project>/plans/YYYY-MM-DD-[plan-name].md`

> `<project>` = basename of the current working directory (e.g., `my-app` for `/Users/haza/Projects/my-app`)

### Write the Full Plan

By this point, the design has been explored, validated, and refined through Phases 2–4. **Don't re-ask for approval on every section** — just write the complete plan and present it.

```markdown
# [Plan Name]

**Date:** YYYY-MM-DD
**Status:** Draft
**Directory:** /path/to/project

## Overview

[What we're building and why — 2-3 sentences]

## Goals

- Goal 1
- Goal 2
- Goal 3

## Approach

[High-level technical approach]

### Features

| Feature | Route | Description |
|---------|-------|-------------|
| feature-name | POST /api/path | What it does |

### Schemas

| Table | Purpose |
|-------|---------|
| table_name | What it stores |

### Services

| Service | Purpose |
|---------|---------|
| serviceName | What it provides (only if needed) |

### Key Decisions

- Decision 1: [choice] — because [reason]
- Decision 2: [choice] — because [reason]

## Dependencies

- Libraries needed (if any beyond what Manifest provides)

## Risks & Open Questions

- Risk 1
- Open question 1
```

After writing, briefly confirm:
> "Plan is written. Ready to create the todos, or anything you want to adjust?"

---

## Phase 6: Create Todos

After the plan is verified, break it into todos.

### Make Todos Bite-Sized

Each todo = **one focused action** (2-5 minutes).

❌ Too big: "Implement user registration"

✅ Granular:
- "Create `schemas/users.ts` with users table"
- "Create `features/register-user.ts` with validation and insert"
- "Create `tests/register-user.test.ts` with happy path and error cases"
- "Commit: 'feat(users): add user registration with email validation'"

### Manifest-Specific Todo Templates

**Feature todo:**
```markdown
Plan: ~/.pi/history/<project>/plans/YYYY-MM-DD-plan-name.md

## Task
Create feature `feature-name` at `features/feature-name.ts`

## Details
- Route: POST /api/path
- Authentication: required
- Input: field1 (string, required), field2 (integer, optional)
- Side effects: Inserts row into table_name
- Error cases: 409 if duplicate, 422 if validation fails

## Acceptance Criteria
- [ ] Uses defineFeature() with description, sideEffects, errorCases
- [ ] Every input field has a description
- [ ] handle() is linear — no deeply nested logic
- [ ] Returns standard envelope responses via ok()/fail()
```

**Schema todo:**
```markdown
Plan: ~/.pi/history/<project>/plans/YYYY-MM-DD-plan-name.md

## Task
Create schema `schemas/tableName.ts`

## Details
- Table: table_name
- Columns: id (uuid, pk), name (varchar), created_at (timestamp)
- Relationships: references other_table(id)

## Acceptance Criteria
- [ ] JSDoc on the table explaining what it stores
- [ ] JSDoc on every column explaining what it's for
- [ ] Uses Drizzle ORM patterns consistently
```

**Service todo:**
```markdown
Plan: ~/.pi/history/<project>/plans/YYYY-MM-DD-plan-name.md

## Task
Create service `services/serviceName.ts`

## Details
- Methods: doThing(input) → Result
- Used by: feature-a, feature-b

## Acceptance Criteria
- [ ] Plain exported object with methods — no class
- [ ] JSDoc on every method
- [ ] Typed parameters — no any
```

### Creating Todos

```
todo(action: "create", title: "Task 1: [description]", tags: ["plan-name"], body: "...")
```

---

## Phase 6.5: Create Feature Branch

**Always create a feature branch before executing.** Never work directly on `main`.

```bash
git checkout -b feat/<short-descriptive-name>
```

Branch naming:
- `feat/<name>` for features
- `fix/<name>` for bug fixes
- `refactor/<name>` for refactors

Keep the name short and descriptive (e.g., `feat/user-registration`, `fix/null-email`, `refactor/auth-service`).

---

## Phase 7: Execute with Subagents

**Always start with a scout, then run workers sequentially.** The scout gathers context about all relevant files upfront so workers spend less time on discovery.

### The Pattern

1. **Run scout first** — gathers context about all files relevant to the plan
2. **Run worker for each todo** — one at a time, each referencing the scout's context
3. **Check results** — verify files were created/modified correctly
4. **Handle failures** — if a worker fails, diagnose and retry or fix manually
5. **Run reviewer last** — only after all todos are complete

### Why Scout First?

Workers are expensive (Sonnet). Every minute a worker spends grepping and reading files to orient itself is wasted. The scout (Haiku) is fast and cheap — it maps out the codebase, identifies key files, notes patterns and conventions, and hands that context to each worker.

### Example

```typescript
// Step 1: Scout gathers context for the entire plan
{ agent: "scout", task: "Gather context for implementing [feature] in this Manifest project. Read the plan at ~/.pi/history/<project>/plans/YYYY-MM-DD-feature.md. Read VISION.md and AGENTS.md. Identify all files that will be created or modified. Map out existing features, schemas, services patterns that workers will need to follow." }

// Step 2: Workers execute todos sequentially
{ agent: "worker", task: "Implement TODO-xxxx. Use the commit skill to write a polished, descriptive commit message. Mark the todo as done. Plan: ~/.pi/history/<project>/plans/YYYY-MM-DD-feature.md\n\nScout context:\n{paste scout context}" }

// More workers for each todo...

// After all todos, review
{ agent: "reviewer", task: "Review the feature branch against main. Plan: ~/.pi/history/<project>/plans/YYYY-MM-DD-feature.md" }
```

### Practical Implementation

The scout writes its findings to `~/.pi/history/<project>/context.md`. Before spawning each worker, **read the scout's context file and paste it into the worker's task**:

```typescript
// 1. Run scout
subagent({ agent: "scout", task: "Gather context for [feature]. Read the plan at ~/.pi/history/<project>/plans/YYYY-MM-DD-feature.md. Read VISION.md and AGENTS.md for project context. Map existing features, schemas, services, and conventions." })

// 2. Read the scout's output
const scoutContext = read("~/.pi/history/<project>/context.md")

// 3. Pass it to each worker
subagent({ agent: "worker", task: `Implement TODO-xxxx. Use the commit skill to write a polished, descriptive commit message. Mark the todo as done. Plan: ~/.pi/history/<project>/plans/YYYY-MM-DD-feature.md

Scout context (your starting baseline — still do targeted discovery as needed):
${scoutContext}` })
```

### What the Scout Should Cover

Tell the scout to focus on:
- **VISION.md and AGENTS.md** — app purpose and project conventions
- **Files from the plan** — read the plan, identify every file mentioned
- **Existing features** — how similar features are structured in this project
- **Schemas** — current data model, relationships
- **Services** — what shared logic already exists
- **manifest/ framework** — relevant framework source if the plan touches it

### Handling Reviewer Findings

When the reviewer returns with issues, **act on the important ones**:

1. **Triage the findings:**
   - **P0 (Drop everything)** — Real bugs, security holes, data loss. Must fix now.
   - **P1 (Foot gun)** — Genuine traps, real maintenance dangers. Should fix.
   - **P2 (Worth mentioning)** — Fix if quick, otherwise note for later.
   - **P3 (Almost irrelevant)** — Skip.

2. **Create todos for P0s and P1s:**
   ```typescript
   todo({ action: "create", title: "Fix: [issue from reviewer]", body: "..." })
   ```

3. **Kick off workers to fix them:**
   ```typescript
   { agent: "worker", task: "Fix TODO-xxxx (from review). Use the commit skill. Mark todo as done." }
   ```

4. **Don't re-review minor fixes** — only run reviewer again if fixes were substantial.

---

### ⚠️ MANDATORY: Always Run Reviewer

**After all workers complete, you MUST run the reviewer.** No exceptions. The workflow is not complete until the reviewer has run.

```typescript
// This is NOT optional. Always end with:
{ agent: "reviewer", task: "Review the feature branch against main. Plan: ~/.pi/history/<project>/plans/YYYY-MM-DD-feature.md" }
```

### ⚠️ Avoid Parallel Workers in Git Repos

**Do NOT use parallel workers when they share a git repository.** Workers that commit to the same repo will conflict. **Always run workers sequentially.**

**When parallel IS safe:**
- Read-only tasks (e.g., multiple scouts gathering info)
- Workers operate on completely separate git repos

### Alternative: Same Session

If the user prefers hands-on work:

> "Would you rather I work through these myself while you review?"

Then work through todos sequentially:
1. Claim the todo
2. Implement
3. Verify
4. Commit using the `manifest-commit` skill (polished, descriptive message)
5. Close the todo
6. Move to next

---

## Phase 8: Review (Mandatory)

The reviewer agent is Manifest-aware. It checks:
- Implementation matches the plan
- Manifest conventions are followed (descriptions, sideEffects, errorCases, JSDoc)
- Code quality and correctness
- Security considerations

### 🛑 STOP — Before Reporting Completion

Check:
1. ✅ All worker todos are closed?
2. ✅ **Every completed todo has a polished commit** (using the `manifest-commit` skill)?
3. ✅ **Reviewer has run?** ← If no, run it now
4. ✅ Reviewer findings triaged and addressed?

**Do NOT tell the user the work is done until all four are true.**

**Do NOT squash merge or merge the feature branch into main.** The feature branch stays as-is with its individual, well-crafted commits.

---

## Commit Strategy

**Do NOT squash merge or merge feature branches back into main.** Every completed todo gets its own polished, descriptive commit on the feature branch using the `manifest-commit` skill — always, no exceptions.

### What Makes a Good Manifest Commit

Load the `manifest-commit` skill every time. Commits in Manifest are knowledge transfer — the primary way agents and humans understand what happened. A reader of `git log` should understand the change without looking at the diff.

- **Subject line:** `<type>(<scope>): <summary>`, <= 72 chars
- **Body:** What changed, why, how, which files, any migration notes
- **Be thorough** — not just "implement X" but explain the approach and rationale

---

## Working with Todos During Implementation

### Claiming
```
todo(action: "claim", id: "TODO-xxxx")
```
Claim when you start working. Don't claim if sub-agents will pick it up.

### Progress Notes
```
todo(action: "append", id: "TODO-xxxx", body: "Implemented the validation logic...")
```

### Closing
```
todo(action: "update", id: "TODO-xxxx", status: "closed")
```

### Viewing
- `/todos` — visual todo manager
- `todo(action: "list")` — open and assigned
- `todo(action: "get", id: "TODO-xxxx")` — full details

---

## Tips

### Read the Room
- If they have a clear vision → validate rather than over-question
- If they're eager to start → move faster through phases (but still hit all phases)
- If they're uncertain → spend more time exploring

### Stay Conversational
- This is a dialogue, not an interrogation
- Phases can be quick depending on complexity, but don't skip them

### Be Opinionated
- You know Manifest. Share your perspective on the right way to do things.
- "I'd suggest a single feature for this because..." is more helpful than listing options
- Push back if something violates Manifest conventions

### Keep It Focused
- One topic at a time
- Don't let scope creep during planning
- Parking lot items for later: "Good thought — let's note that for v2"

### Trust the Framework
- Don't add dependencies when `manifest/` already handles it
- Don't create abstractions when a linear `handle()` works
- Don't extract services until you have two consumers
- Read the framework source if you're unsure what it provides
