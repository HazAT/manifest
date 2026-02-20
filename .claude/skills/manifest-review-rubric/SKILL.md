---
name: manifest-review-rubric
description: |
  Code review guidelines and quality rubric for Manifest projects. Covers framework
  conventions, feature structure, schema quality, and security. Shared by the reviewer
  subagent and available for manual reviews. Use when reviewing code changes.
---

# Manifest Code Review Rubric

You are reviewing code in a **Manifest** project. This means the code follows specific framework conventions that are part of the review — not just general quality.

## Manifest Convention Checks

Before applying the general rubric below, verify these Manifest-specific requirements:

### Features

- [ ] Every feature uses `defineFeature()` — not raw route handlers or middleware
- [ ] `description` is present and meaningful (2-3 sentences, written for an agent reading cold)
- [ ] Every `input` field has a `description`
- [ ] `sideEffects` array is present and accurate (database writes, emails, API calls)
- [ ] `errorCases` array is present with HTTP status codes
- [ ] `authentication` is explicitly set (`'required'`, `'none'`, or `'optional'`)
- [ ] One feature per file — no behavior scattered across multiple files
- [ ] Feature name is kebab-case and unique
- [ ] `handle()` is linear — no deeply nested conditionals or hidden branches

### Schemas

- [ ] Every table has a JSDoc comment explaining what it stores
- [ ] Every column has a JSDoc comment explaining what it's for
- [ ] Uses Drizzle ORM patterns consistently

### Services

- [ ] Plain exported objects with methods — no classes, no DI
- [ ] JSDoc on every exported function
- [ ] Only created when two or more features share the logic (not premature extraction)
- [ ] Typed parameters — no `any`

### General Manifest Principles

- [ ] Explicit over elegant — no auto-discovered middleware, no decorator magic
- [ ] Trust the defaults — don't introduce Express/validation libraries when manifest/ handles it
- [ ] Self-describing — every piece of code carries machine-readable metadata
- [ ] Framework code read before modification — changes to `manifest/` should show understanding

### Frontend (if applicable)

- [ ] `cursor: pointer` on all interactive elements (buttons, clickable cards, anything with onClick)

---

## Determining What to Flag

Flag issues that:
1. Meaningfully impact the accuracy, performance, security, or maintainability of the code.
2. Are discrete and actionable (not general issues or multiple combined issues).
3. Don't demand rigor inconsistent with the rest of the codebase.
4. Were introduced in the changes being reviewed (not pre-existing bugs).
5. The author would likely fix if aware of them.
6. Don't rely on unstated assumptions about the codebase or author's intent.
7. Have provable impact on other parts of the code (not speculation).
8. Are clearly not intentional changes by the author.
9. Be particularly careful with untrusted user input.

## Untrusted User Input

1. Be careful with open redirects — always check they go to trusted domains
2. Always flag SQL that is not parameterized
3. In systems with user-supplied URL input, HTTP fetches must be protected against access to local resources (intercept DNS resolver)
4. Escape, don't sanitize if you have the option (e.g., HTML escaping)

## Comment Guidelines

1. Be clear about why the issue is a problem.
2. Communicate severity appropriately — don't exaggerate.
3. Be brief — at most 1 paragraph.
4. Keep code snippets under 3 lines, wrapped in inline code or code blocks.
5. Explicitly state scenarios/environments where the issue arises.
6. Use a matter-of-fact tone — helpful, not accusatory.
7. Write for quick comprehension without close reading.

## Review Priorities

1. Call out newly added dependencies explicitly and explain why they're needed.
2. Prefer simple, direct solutions over wrappers or abstractions without clear value.
3. Favor fail-fast behavior; avoid logging-and-continue patterns that hide errors.
4. Prefer predictable production behavior; crashing is better than silent degradation.
5. Treat back pressure handling as critical to system stability.
6. Apply system-level thinking; flag changes that increase operational risk.
7. Ensure errors are checked against codes or stable identifiers, never error messages.

## Priority Levels — Be Ruthlessly Pragmatic

The bar for flagging something is HIGH. Ask yourself: "Will this actually cause a real problem in practice?" If the answer is "well, theoretically..." — don't flag it.

Tag each finding with a priority level:
- **[P0]** — Drop everything. Will break in production, lose data, or create a security hole. Must be provable with a concrete scenario.
- **[P1]** — Genuine foot gun. Someone WILL trip over this and waste hours, or it creates a real maintenance trap.
- **[P2]** — Worth mentioning. A real improvement, but the code works fine without it. Not urgent.
- **[P3]** — Almost irrelevant. Barely worth the ink.

### What NOT to Flag

- **Naming preferences** — Unless a name is actively misleading, leave it alone.
- **Hypothetical edge cases** — "What if someone passes null here?" Is that actually possible? Check before flagging.
- **Style differences** — You'd write it differently? Cool. That's not a finding.
- **"Best practice" violations** — If the code works, is readable, and doesn't cause problems, the "best practice" police can stand down.
- **Speculative future problems** — "This might not scale if..." Unless there's evidence it needs to scale NOW, skip it.
- **Missing descriptions that exist** — Don't flag a missing feature description if it's actually there. Read the whole file.

### What TO Flag

- Real bugs that will manifest in actual usage.
- Security issues with concrete exploit scenarios.
- Logic errors where the code doesn't do what the plan intended.
- Missing error handling where errors WILL occur.
- Code that is genuinely confusing and will cause the next person to introduce bugs.
- **Manifest convention violations** — Missing feature descriptions, undescribed input fields, missing sideEffects, schema columns without JSDoc. These aren't style nits — they're how agents understand the codebase.

## Output Format

Provide your findings in a clear, structured format:
1. List each finding with its priority tag, file location, and explanation.
2. Keep line references short (avoid ranges over 5-10 lines).
3. At the end, provide an overall verdict: "correct" (no blocking issues) or "needs attention" (has blocking issues).
4. If the code works and is readable, a short review with few findings is the RIGHT answer. Don't manufacture findings.

Output findings the author would genuinely benefit from knowing. If there are no qualifying findings, explicitly state the code looks good.
