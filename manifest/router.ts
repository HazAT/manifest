import type { FeatureDef, HttpMethod } from './feature'

interface RouteEntry {
  method: HttpMethod
  segments: string[]
  paramNames: string[]
  feature: FeatureDef
}

export interface RouteMatch {
  feature: FeatureDef
  params: Record<string, string>
}

export interface Router {
  match(method: string, path: string): RouteMatch | null
  isMethodNotAllowed(method: string, path: string): boolean
}

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean)
}

export function createRouter(registry: Record<string, FeatureDef>): Router {
  const entries: RouteEntry[] = []

  for (const feature of Object.values(registry)) {
    const route = feature.route as unknown as unknown[]
    if (!Array.isArray(route) || route.length < 2) continue

    const [method, pattern] = feature.route as [HttpMethod, string]
    const segments = splitPath(pattern)
    const paramNames: string[] = []

    for (const seg of segments) {
      if (seg.startsWith(':')) paramNames.push(seg.slice(1))
    }

    entries.push({ method, segments, paramNames, feature })
  }

  function tryMatch(entry: RouteEntry, pathSegments: string[]): Record<string, string> | null {
    if (entry.segments.length !== pathSegments.length) return null
    const params: Record<string, string> = {}
    for (let i = 0; i < entry.segments.length; i++) {
      const seg = entry.segments[i]!
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = pathSegments[i]!
      } else if (seg !== pathSegments[i]) {
        return null
      }
    }
    return params
  }

  return {
    match(method: string, path: string): RouteMatch | null {
      const pathSegments = splitPath(path)
      for (const entry of entries) {
        if (entry.method !== method) continue
        const params = tryMatch(entry, pathSegments)
        if (params) return { feature: entry.feature, params }
      }
      return null
    },

    isMethodNotAllowed(method: string, path: string): boolean {
      const pathSegments = splitPath(path)
      for (const entry of entries) {
        const params = tryMatch(entry, pathSegments)
        if (params && entry.method !== method) return true
      }
      return false
    },
  }
}
