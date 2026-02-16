import type { AnyFeatureDef, HttpMethod } from './feature'

interface RouteEntry {
  method: HttpMethod
  segments: string[]
  paramNames: string[]
  feature: AnyFeatureDef
}

export type MatchResult =
  | { kind: 'matched'; feature: AnyFeatureDef; params: Record<string, string> }
  | { kind: 'method_not_allowed' }
  | { kind: 'not_found' }

export interface Router {
  match(method: string, path: string): MatchResult
}

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean)
}

export function createRouter(registry: Record<string, AnyFeatureDef>): Router {
  const entries: RouteEntry[] = []

  for (const feature of Object.values(registry)) {
    if (!feature.route) continue

    const [method, pattern] = feature.route
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
    match(method: string, path: string): MatchResult {
      const pathSegments = splitPath(path)
      let pathMatched = false

      for (const entry of entries) {
        const params = tryMatch(entry, pathSegments)
        if (params) {
          if (entry.method === method) {
            return { kind: 'matched', feature: entry.feature, params }
          }
          pathMatched = true
        }
      }

      return pathMatched ? { kind: 'method_not_allowed' } : { kind: 'not_found' }
    },
  }
}
