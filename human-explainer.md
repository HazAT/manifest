# What is Manifest?

You know how every web framework assumes a human is writing the code?

Manifest doesn't.

---

Manifest is a TypeScript/Bun web framework designed from the ground up for AI agents. Not "AI-friendly" as a marketing bullet point — structurally, fundamentally built so that an agent can read your entire codebase, understand every behavior, and modify code in production with confidence.

**The core insight:** When you build a framework for agent comprehension, you accidentally build the most readable, maintainable framework humans have ever used too.

---

### How it's different

In most frameworks, understanding what happens when a user hits `/api/register` requires reading 6+ files — a route file, a controller, a validator, a middleware chain, a service, an error handler. The execution flow is invisible, scattered across conventions and auto-discovery.

In Manifest, it's one file:

```typescript
export default defineFeature({
  name: 'user-registration',
  description: 'Creates a new user account...',
  route: ['POST', '/api/users/register'],
  sideEffects: ['Inserts row into users table', 'Sends welcome email'],
  errorCases: ['409 - Email already registered'],
  input: {
    email: t.string({ description: 'User email.', required: true, format: 'email' }),
  },
  async handle({ input, ok, fail }) {
    // Everything happens here. No hidden branches.
  },
})
```

One file. Every behavior. Every side effect declared. Every input described. An agent — or a human — reads this and knows exactly what's going on.

---

### The weird part

The framework itself ships as source code inside your project. Not an npm package. Not a black box. About 1,000 lines of TypeScript that you own, your agent reads, and you both evolve together.

When the agent needs to understand how routing works, it reads `manifest/router.ts` (76 lines). When it needs a new validation rule, it edits `manifest/validator.ts` (92 lines). The framework isn't a dependency — it's part of the codebase.

---

### The vision

An agent monitors your app in production. An error fires. The agent reads `MANIFEST.md`, finds the feature, reads the single file, understands the bug, edits the code, and Bun hot-reloads it instantly. No deploy. No CI. No restart. Fixed.

That's what Manifest is building toward.

---

### Want to try it?

Paste this into any AI agent with terminal access:

```
Download and follow the steps from https://github.com/hazat/manifest/blob/main/SPARK.md
```

Your agent handles the rest.

Or just read the [README](README.md) if you prefer to go manual.
