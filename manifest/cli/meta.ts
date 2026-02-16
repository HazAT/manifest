/**
 * Centralized command metadata registry.
 *
 * Each command file exports a `meta` object (or array of objects) with:
 *   - name: command name as the user types it (e.g. 'check', 'spark init')
 *   - description: one-line description for help text and MANIFEST.md
 *   - usage: full usage string (e.g. 'bun manifest check')
 *
 * This module collects them all for help generation and MANIFEST.md indexing.
 */

export interface CommandMeta {
  name: string
  description: string
  usage: string
}

function flatten(meta: CommandMeta | CommandMeta[]): CommandMeta[] {
  return Array.isArray(meta) ? meta : [meta]
}

export function getAllCommandMeta(): CommandMeta[] {
  // Import meta from each command file synchronously via require
  // This avoids async import chains just for metadata
  const modules: Array<{ meta: CommandMeta | CommandMeta[] }> = []

  try { modules.push(require('./status')) } catch {}
  try { modules.push(require('./serve')) } catch {}
  try { modules.push(require('./indexManifest')) } catch {}
  try { modules.push(require('./check')) } catch {}
  try { modules.push(require('./learn')) } catch {}
  try { modules.push(require('./doctor')) } catch {}
  try { modules.push(require('./makeFeature')) } catch {}
  try { modules.push(require('./extension')) } catch {}
  try { modules.push(require('./frontend')) } catch {}
  try { modules.push(require('./run')) } catch {}
  try { modules.push(require('./spark')) } catch {}

  const all: CommandMeta[] = []
  for (const mod of modules) {
    if (mod.meta) {
      all.push(...flatten(mod.meta))
    }
  }
  return all
}
