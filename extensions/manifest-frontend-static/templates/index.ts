import './styles.css'

async function main() {
  const app = document.getElementById('app')!

  try {
    const response = await fetch('/api/hello?name=Manifest')
    const data = await response.json()

    app.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="text-center">
          <h1 class="text-4xl font-bold text-gray-900">${data.message}</h1>
          <p class="mt-2 text-gray-600">Frontend is connected to the API.</p>
        </div>
      </div>
    `
  } catch (err) {
    app.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="text-center">
          <h1 class="text-4xl font-bold text-gray-900">Manifest</h1>
          <p class="mt-2 text-red-600">Could not reach the API. Is the server running?</p>
        </div>
      </div>
    `
  }
}

main()
