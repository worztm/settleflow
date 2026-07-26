const WORKER_URL = 'https://settleflow-api.worztm.workers.dev'

export async function onRequest(context: EventContext<Env, string, Record<string, unknown>>) {
  const { request } = context
  const url = new URL(request.url)
  const workerPath = url.pathname.replace(/^\/api/, '/api')
  const workerUrl = `${WORKER_URL}${workerPath}${url.search}`

  const workerRequest = new Request(workerUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  })

  const response = await fetch(workerRequest)
  return response
}