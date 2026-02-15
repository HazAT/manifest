import { createResource, Show } from 'solid-js'

async function fetchGreeting() {
  const res = await fetch('/api/hello?name=Manifest')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return json.data
}

export default function App() {
  const [greeting] = createResource(fetchGreeting)

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="text-center">
        <Show when={greeting.error}>
          <h1 class="text-4xl font-bold text-gray-900">Manifest</h1>
          <p class="mt-2 text-red-600">Could not reach the API. Is the server running?</p>
        </Show>
        <Show when={greeting.loading}>
          <h1 class="text-4xl font-bold text-gray-900">Manifest</h1>
          <p class="mt-2 text-gray-400">Loading...</p>
        </Show>
        <Show when={greeting()}>
          {(data) => (
            <>
              <h1 class="text-4xl font-bold text-gray-900">{data().message}</h1>
              <p class="mt-2 text-gray-600">Frontend is connected to the API.</p>
            </>
          )}
        </Show>
      </div>
    </div>
  )
}
