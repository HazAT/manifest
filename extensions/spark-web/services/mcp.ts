import crypto from 'crypto'

/**
 * Config passed to handleMcp() from the sidecar.
 * Mirrors the same session references used by the WebSocket bridge.
 */
export interface McpConfig {
  session: any
  sessionReady: boolean
  sessionError: string | null
  token: string
}

/** Active MCP session IDs (created on initialize, removed on DELETE). */
const mcpSessions = new Set<string>()

/** JSON-RPC 2.0 error codes. */
const RPC_PARSE_ERROR = -32700
const RPC_INVALID_REQUEST = -32600
const RPC_METHOD_NOT_FOUND = -32601
const RPC_INVALID_PARAMS = -32602
const RPC_INTERNAL_ERROR = -32603

/** Accepted MCP protocol versions. */
const ACCEPTED_VERSIONS = new Set(['2025-03-26', '2024-11-05'])

/** The single tool this MCP server exposes. */
const TALK_TO_SPARK_TOOL = {
  name: 'talk_to_spark',
  description:
    'Send a message to Spark, the AI sidekick watching your Manifest application. Spark has full context of the codebase, can investigate errors, read files, and fix issues. The conversation is stateful — Spark remembers previous messages.',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Your message to Spark',
      },
    },
    required: ['message'],
  },
}

/** Constant-time Bearer token comparison to prevent timing attacks. */
function validateBearer(req: Request, token: string): boolean {
  const auth = req.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return false
  const provided = auth.slice(7)
  if (provided.length !== token.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(token))
  } catch {
    return false
  }
}

/** Build a JSON-RPC 2.0 success response object. */
function rpcOk(id: string | number | null, result: unknown) {
  return { jsonrpc: '2.0', id, result }
}

/** Build a JSON-RPC 2.0 error response object. */
function rpcError(id: string | number | null, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

/** Return a plain JSON response. */
function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

/** Return a 401 Unauthorized response (outside of JSON-RPC). */
function unauthorized(): Response {
  return new Response('Unauthorized', { status: 401 })
}

/**
 * Handle an MCP Streamable HTTP request.
 *
 * Accepts POST /mcp (JSON-RPC messages) and DELETE /mcp (session termination).
 * Bearer token must be present on every request.
 */
export async function handleMcp(req: Request, config: McpConfig): Promise<Response> {
  // --- Auth ---
  if (!validateBearer(req, config.token)) return unauthorized()

  // --- DELETE: terminate MCP session ---
  if (req.method === 'DELETE') {
    const sessionId = req.headers.get('mcp-session-id')
    if (sessionId) mcpSessions.delete(sessionId)
    return new Response(null, { status: 200 })
  }

  // --- Only POST from here on ---
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // --- Parse JSON-RPC body ---
  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonResponse(rpcError(null, RPC_PARSE_ERROR, 'Parse error'))
  }

  if (typeof body !== 'object' || body === null || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return jsonResponse(rpcError(body?.id ?? null, RPC_INVALID_REQUEST, 'Invalid Request'))
  }

  const id = body.id ?? null
  const method: string = body.method
  const params = body.params ?? {}

  // --- Route by method ---

  // initialize — creates an MCP session, no Mcp-Session-Id required yet
  if (method === 'initialize') {
    const version = params.protocolVersion
    if (!ACCEPTED_VERSIONS.has(version)) {
      return jsonResponse(
        rpcError(id, RPC_INVALID_PARAMS, `Unsupported protocol version: ${version}`),
      )
    }
    const mcpSessionId = crypto.randomUUID()
    mcpSessions.add(mcpSessionId)

    return jsonResponse(
      rpcOk(id, {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'spark', version: '0.1.0' },
        instructions:
          'Spark is an AI sidekick that watches your running Manifest application. It can investigate errors, read source files, run commands, and fix issues. Use the talk_to_spark tool to have a stateful conversation with Spark — it remembers the full conversation history.',
      }),
      200,
      { 'Mcp-Session-Id': mcpSessionId },
    )
  }

  // notifications/initialized — acknowledge only, no session check needed
  if (method === 'notifications/initialized') {
    return new Response(null, { status: 202 })
  }

  // ping — heartbeat
  if (method === 'ping') {
    return jsonResponse(rpcOk(id, {}))
  }

  // All remaining methods require a valid Mcp-Session-Id
  const mcpSessionId = req.headers.get('mcp-session-id')
  if (!mcpSessionId || !mcpSessions.has(mcpSessionId)) {
    return jsonResponse(rpcError(id, RPC_INVALID_REQUEST, 'Missing or unknown Mcp-Session-Id'), 400)
  }

  // tools/list — return the single tool definition
  if (method === 'tools/list') {
    return jsonResponse(rpcOk(id, { tools: [TALK_TO_SPARK_TOOL] }))
  }

  // tools/call — stream response via SSE
  if (method === 'tools/call') {
    const toolName = params.name
    const args = params.arguments ?? {}

    if (toolName !== 'talk_to_spark') {
      return jsonResponse(rpcError(id, RPC_INVALID_PARAMS, `Unknown tool: ${toolName}`))
    }

    const message = args.message
    if (typeof message !== 'string' || message.trim() === '') {
      return jsonResponse(rpcError(id, RPC_INVALID_PARAMS, 'arguments.message must be a non-empty string'))
    }

    // Session not available
    if (!config.sessionReady || !config.session) {
      const errMsg = config.sessionError || 'Agent session not available'
      return jsonResponse(
        rpcOk(id, {
          content: [{ type: 'text', text: `Spark is not available: ${errMsg}` }],
          isError: true,
        }),
      )
    }

    // Build an SSE stream
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    const writer = writable.getWriter()
    const enc = new TextEncoder()

    /** Write one SSE event (unnamed, as per MCP spec). */
    const writeEvent = (data: unknown) => {
      try {
        writer.write(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
      } catch {
        // client disconnected
      }
    }

    // Run async in background so we can return the Response immediately
    ;(async () => {
      let unsubscribe: (() => void) | null = null
      let finished = false

      try {
        // Buffer text tokens so we can accumulate the final response
        let accumulatedText = ''

        unsubscribe = config.session.subscribe((event: any) => {
          if (finished) return

          switch (event.type) {
            case 'message_update': {
              // Forward incremental text tokens as log notifications
              const delta = event.assistantMessageEvent
              if (delta?.type === 'content_block_delta' && delta.delta?.type === 'text_delta') {
                const token: string = delta.delta.text ?? ''
                accumulatedText += token
                writeEvent({
                  jsonrpc: '2.0',
                  method: 'notifications/message',
                  params: {
                    level: 'info',
                    data: token,
                  },
                })
              }
              break
            }

            case 'tool_execution_start': {
              // Notify MCP client that Spark is using a tool
              const toolMsg = `[tool: ${event.toolName}]`
              writeEvent({
                jsonrpc: '2.0',
                method: 'notifications/message',
                params: {
                  level: 'info',
                  data: toolMsg,
                },
              })
              break
            }

            case 'message_end': {
              finished = true
              // Extract final text from the completed message
              const msg = event.message
              let finalText = accumulatedText
              if (msg?.content && Array.isArray(msg.content)) {
                const textParts = msg.content
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text as string)
                if (textParts.length > 0) {
                  finalText = textParts.join('')
                }
              }

              // Send the JSON-RPC result
              writeEvent(
                rpcOk(id, {
                  content: [{ type: 'text', text: finalText }],
                  isError: false,
                }),
              )

              if (unsubscribe) {
                unsubscribe()
                unsubscribe = null
              }
              writer.close().catch(() => {})
              break
            }
          }
        })

        // Kick off the prompt
        if (config.session.isStreaming) {
          await config.session.followUp(message)
        } else {
          await config.session.prompt(message)
        }

        // If message_end already fired synchronously (unlikely but possible),
        // we're already done. Otherwise wait for the subscription to close the stream.
      } catch (err: any) {
        if (unsubscribe) {
          unsubscribe()
          unsubscribe = null
        }
        const errMsg = err instanceof Error ? err.message : String(err)
        if (!finished) {
          writeEvent(
            rpcOk(id, {
              content: [{ type: 'text', text: `Error: ${errMsg}` }],
              isError: true,
            }),
          )
        }
        writer.close().catch(() => {})
      }
    })()

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  // Unknown method
  return jsonResponse(rpcError(id, RPC_METHOD_NOT_FOUND, `Method not found: ${method}`))
}
