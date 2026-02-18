---
name: manifest-sse-example
description: Example SSE streaming extension with a demo feature and frontend consumption guides.
version: 0.1.0
author: Manifest
features:
  - token-stream: Streams text back token by token via SSE.
config: []
---

# SSE Streaming Example

This extension demonstrates how to build and consume Server-Sent Event (SSE) streams in Manifest. It includes a working stream feature that echoes text token-by-token, plus copy-pasteable frontend examples for vanilla JS, SolidJS, React, and Vue.

## The Stream Feature

`token-stream` accepts a prompt and streams it back word-by-word with a configurable delay between each token. It simulates AI-style token streaming without any external dependencies.

**Try it with curl:**

```bash
curl -N -X POST http://localhost:3000/api/stream/tokens \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Hello world this is a streaming test", "delay": 100}'
```

You'll see events arrive one at a time:

```
event: start
data: {"totalTokens":7}

event: token
data: Hello

event: token
data: world

event: token
data: this

...

event: done
data: {"totalTokens":7}
```

## How SSE Streaming Works in Manifest

A stream feature uses `type: 'stream'` and defines a `stream()` function instead of `handle()`. The framework opens an SSE connection and gives you `emit()`, `close()`, and `fail()`:

- **`emit(data)`** — Send a data-only event. Strings are sent as-is, objects are JSON-encoded.
- **`emit(event, data)`** — Send a named event with data.
- **`close()`** — End the stream gracefully.
- **`fail(message, status?)`** — Send an error event and close.

### Wire format examples

| Call | SSE output |
|------|-----------|
| `emit('Hello')` | `data: Hello\n\n` |
| `emit({ token: 'Hi' })` | `data: {"token":"Hi"}\n\n` |
| `emit('token', 'Hi')` | `event: token\ndata: Hi\n\n` |
| `emit('done', { n: 5 })` | `event: done\ndata: {"n":5}\n\n` |

When the `stream()` function returns, the connection closes automatically. Call `close()` explicitly only if you need to end early.

## Consuming Streams from the Frontend

Most AI and streaming use cases send a POST request with a payload (e.g., a prompt), so the primary pattern uses `fetch()` with a `ReadableStream` reader. `EventSource` only supports GET requests and is covered separately below.

### Vanilla JavaScript (fetch + ReadableStream)

```javascript
async function streamTokens(prompt) {
  const controller = new AbortController()
  const response = await fetch('/api/stream/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal: controller.signal,
  })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    let currentEvent = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) currentEvent = line.slice(7)
      else if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (currentEvent === 'token') document.getElementById('output').textContent += data + ' '
        if (currentEvent === 'done') console.log('Stream complete:', data)
        currentEvent = ''
      }
    }
  }

  // To cancel early: controller.abort()
}
```

### SolidJS

```typescript
import { createSignal } from 'solid-js'

function TokenStream() {
  const [tokens, setTokens] = createSignal<string[]>([])
  const [streaming, setStreaming] = createSignal(false)

  async function startStream(prompt: string) {
    setTokens([])
    setStreaming(true)

    const response = await fetch('/api/stream/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('event: ')) currentEvent = line.slice(7)
        else if (line.startsWith('data: ') && currentEvent === 'token') {
          setTokens(prev => [...prev, line.slice(6)])
          currentEvent = ''
        }
      }
    }

    setStreaming(false)
  }

  return <div>
    <button onClick={() => startStream('Hello world from SolidJS')} style={{ cursor: 'pointer' }}>
      Stream
    </button>
    <p>{tokens().join(' ')}</p>
  </div>
}
```

### React

```typescript
import { useState, useCallback } from 'react'

function TokenStream() {
  const [tokens, setTokens] = useState<string[]>([])
  const [streaming, setStreaming] = useState(false)

  const startStream = useCallback(async (prompt: string) => {
    const controller = new AbortController()
    setTokens([])
    setStreaming(true)

    const response = await fetch('/api/stream/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    })

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('event: ')) currentEvent = line.slice(7)
        else if (line.startsWith('data: ') && currentEvent === 'token') {
          setTokens(prev => [...prev, line.slice(6)])
          currentEvent = ''
        }
      }
    }

    setStreaming(false)
    return () => controller.abort()
  }, [])

  return <div>
    <button onClick={() => startStream('Hello world from React')} style={{ cursor: 'pointer' }}>
      {streaming ? 'Streaming...' : 'Stream'}
    </button>
    <p>{tokens.join(' ')}</p>
  </div>
}
```

### Vue 3

```vue
<script setup lang="ts">
import { ref } from 'vue'

const tokens = ref<string[]>([])
const streaming = ref(false)

async function startStream(prompt: string) {
  tokens.value = []
  streaming.value = true

  const response = await fetch('/api/stream/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('event: ')) currentEvent = line.slice(7)
      else if (line.startsWith('data: ') && currentEvent === 'token') {
        tokens.value.push(line.slice(6))
        currentEvent = ''
      }
    }
  }

  streaming.value = false
}
</script>

<template>
  <div>
    <button @click="startStream('Hello world from Vue')" style="cursor: pointer">
      {{ streaming ? 'Streaming...' : 'Stream' }}
    </button>
    <p>{{ tokens.join(' ') }}</p>
  </div>
</template>
```

### EventSource (GET streams only)

If you create a stream feature with a GET route, you can use the browser's native `EventSource`:

```javascript
const source = new EventSource('/api/stream/some-get-endpoint')

source.addEventListener('token', (event) => {
  console.log('Token:', event.data)
})

source.addEventListener('done', () => {
  source.close()
})

source.addEventListener('error', (event) => {
  console.error('Stream error')
  source.close()
})
```

Note: `EventSource` does **not** support POST requests, custom headers, or request bodies. For any endpoint that requires input (which is most AI/streaming use cases), use the `fetch()` + `ReadableStream` pattern shown above.

## Error Handling

Stream errors arrive as named `error` events. Handle them on the client:

```javascript
// In your reader loop, add:
if (line.startsWith('event: ')) currentEvent = line.slice(7)
else if (line.startsWith('data: ') && currentEvent === 'error') {
  console.error('Stream error:', line.slice(6))
  reader.cancel()
  break
}
```

If the server returns a non-200 response (e.g., 422 for validation errors), the response won't be a stream at all — it'll be a standard JSON error envelope. Check `response.ok` before reading the stream:

```javascript
if (!response.ok) {
  const error = await response.json()
  console.error('Request failed:', error.message, error.errors)
  return
}
```

## Reconnection

SSE streams in Manifest are request-scoped — each stream runs once and closes. There's no automatic reconnection. To resume after a disconnect:

1. Check the last event you received. If it was `done`, the stream completed normally.
2. If the stream ended without a `done` or `error` event, the connection dropped unexpectedly.
3. Re-send the request to start a new stream. If your use case supports partial results, track progress and adjust the input accordingly.

## Troubleshooting

**"I get a 422 response instead of a stream"**
The input validation failed before the stream started. Check `response.ok` and read the JSON error body — it will tell you which fields are invalid. Common cause: missing the `prompt` field or sending it as a non-string type.

**"Stream connects but no events arrive"**
Check the server logs for errors in the `stream()` function. Make sure the feature file is in `extensions/manifest-sse-example/features/` and the server was restarted after adding it.

**"Events arrive all at once instead of streaming"**
You're likely using `await response.text()` or `await response.json()` instead of reading the stream incrementally. Use `response.body.getReader()` and process chunks as they arrive — see the frontend examples above.

**"AbortController doesn't stop the stream"**
Make sure you're passing `signal: controller.signal` in the fetch options, and calling `controller.abort()` to cancel. The server-side stream will terminate when the client disconnects.

**"Works in curl but not in the browser"**
Check for CORS issues. If your frontend is on a different port than the API, you may need to configure CORS headers. Also verify the `Content-Type: application/json` header is set on the fetch request.
