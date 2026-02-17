# Manifest: manifest

## System
- Runtime: Bun 1.3.1, TypeScript, Manifest 0.1.x
- Generated: 2026-02-17

## Architecture
This is a Manifest application. All behavior lives in feature files.
- features/ - One file per application behavior (2 features)
- schemas/ - Drizzle ORM table definitions (0 schemas)
- services/ - Shared services (2 services)
- commands/ - CLI commands (0 commands)

## Conventions
- NEVER use decorator-based patterns. Features are defined with defineFeature().
- NEVER create event listeners or middleware. Side effects go in the feature's handle() function.
- NEVER scatter one behavior across multiple files. One feature = one file.
- Every input field MUST have a description.
- Features MUST declare all side effects in the feature definition.
- Schema fields MUST have JSDoc descriptions.
- All dependencies MUST be explicit imports. No global state, no service locators.

## Feature Index
| Name | Route | Type | Description |
|------|-------|------|-------------|
| token-stream | POST /api/stream/tokens | stream | Streams text back token by token via Server-Sent Events. Accepts a prompt and ec |
| hello-world | GET /api/hello | request | A simple greeting endpoint. Returns a hello message with the provided name, or " |

## Extensions
| Name | Version | Description |
|------|---------|-------------|
| manifest-sse-example | 0.1.0 | Example SSE streaming extension with a demo feature and frontend consumption guides. |
| manifest-content-blog | 0.1.0 | Markdown blog with static HTML output. Posts in content/posts/, built with marked + Tailwind Typography. |
| spark-web | 0.1.0 | Browser dashboard for the Spark AI sidekick. Runs as a sidecar process on its own port, serving a real-time web UI for interacting with Spark. |
| manifest-drizzle-postgres | 0.1.0 | Drizzle ORM + Postgres preset. Provides templates and setup instructions for database access. |
| manifest-frontend-static | 0.1.0 | HTML + Tailwind CSS + vanilla TypeScript frontend preset. No framework, no virtual DOM. |
| manifest-frontend-reactive | 0.1.0 | SolidJS + Tailwind CSS frontend preset. Fine-grained reactivity without a virtual DOM. |
| spark | 0.1.0 | Reactive AI sidekick for Manifest apps. Captures errors and access logs in a SQLite database, polled by a Pi agent extension for real-time investigation and fixes. |


## CLI Commands
| Command | Description |
|---------|-------------|
| `bun manifest status` | Quick project health check — the first command to run when arriving at a codebase |
| `bun manifest serve [--port=8080]` | Start the development server |
| `bun manifest index` | Rebuild MANIFEST.md from the current codebase state |
| `bun manifest check` | Validate that features, extensions, and routes follow Manifest conventions |
| `bun manifest learn` | Scan for staleness and inconsistencies after changes |
| `bun manifest doctor` | Diagnose system issues, check extensions, show debugging guidance |
| `bun manifest feature make <Name> [--route="METHOD /path"] [--auth=none|required] [--type=stream]` | Output an agent prompt for scaffolding a new feature (no files written) |
| `bun manifest service make <Name>` | Output an agent prompt for scaffolding a new service (no files written) |
| `bun manifest extension make <name>` | Output an agent prompt for scaffolding a new extension (no files written) |
| `bun manifest extension install <url|name>` | Output an agent prompt for installing an extension from GitHub or npm |
| `bun manifest extension list` | List all installed extensions with version and description |
| `bun manifest frontend install` | Output an agent prompt to choose and install a frontend preset |
| `bun manifest frontend build` | Build the frontend for production |
| `bun manifest frontend dev` | Start a standalone frontend file watcher with live reload |
| `bun manifest run <command> [args...]` | Run a command with output logging and Spark error reporting |
| `bun manifest spark init` | Initialize Spark sidekick (config, Pi extension, .gitignore) |
| `bun manifest spark status` | Show current Spark status (enabled, environment, events, DB) |

Start here: `bun manifest status` for a quick health check.

## Known Issues
- None currently.
