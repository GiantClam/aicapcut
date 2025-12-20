import { NextRequest } from 'next/server'

export const maxDuration = 600

const AGENT_URL = process.env.AGENT_URL || process.env.VITE_AGENT_URL || 'http://localhost:8000'

function isSSE(request: NextRequest, action: string) {
  const accept = request.headers.get('accept') || ''
  return action === 'run-clips' || accept.includes('text/event-stream')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const run_id = searchParams.get('run_id')

    if (!run_id) {
      return new Response(JSON.stringify({ error: 'Missing run_id' }), { status: 400 })
    }

    const path = `/jobs/${run_id}`
    const response = await fetch(`${AGENT_URL}${path}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      // Backend returns 500/404 if not found or PGRST116.
      // We assume it's pending if not found.
      const errText = await response.text()
      try {
        const errJson = JSON.parse(errText)
        // Check for specific Supabase error code for "0 rows" or generic 404
        if (response.status === 404 || (errJson.error && String(errJson.error).includes('PGRST116'))) {
          return new Response(JSON.stringify({
            run_id,
            status: 'pending',
            result: null,
            error: 'Job initialization pending'
          }), { status: 200 })
        }
        // Also handle the case where backend returns 500 but body contains the PGRST116 info (as seen in logs)
        if (response.status === 500 && String(errText).includes('PGRST116')) {
          return new Response(JSON.stringify({
            run_id,
            status: 'pending',
            result: null,
            error: 'Job initialization pending'
          }), { status: 200 })
        }
      } catch { }

      return new Response(JSON.stringify({ error: errText || 'Backend request failed' }), { status: response.status })
    }

    const data = await response.json()
    // Map backend job object to CrewStatus expected by frontend
    const mappedStatus = {
      run_id: data.run_id,
      status: data.status,
      // use video_url as result if completed
      result: data.video_url || null,
      error: null,
      created_at: data.created_at,
      updated_at: data.updated_at
    }

    return new Response(JSON.stringify(mappedStatus), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = String(body.action || '')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 600000)

    let path = ''
    if (action === 'plan') path = '/workflow/plan'
    else if (action === 'keyframes') path = '/workflow/keyframes'
    else if (action === 'confirm') path = '/workflow/confirm'
    else if (action === 'run-clips') path = '/workflow/run-clips'
    else if (action === 'stitch') path = '/workflow/stitch'
    else if (action === 'crew-run') path = '/workflow/crew-run'
    else path = '/workflow'

    try {
      const response = await fetch(`${AGENT_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return new Response(JSON.stringify({ error: '后端请求失败' }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (!response.body) {
        return new Response(JSON.stringify({ error: '后端响应为空' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (isSSE(request, action)) {
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        })
      }

      const text = await response.text()
      try {
        const json = JSON.parse(text)
        return new Response(JSON.stringify(json), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch {
        return new Response(text, {
          status: response.status,
          headers: { 'Content-Type': 'text/plain' },
        })
      }

    } catch (e: any) {
      clearTimeout(timeoutId)
      if (e.name === 'AbortError') {
        return new Response(JSON.stringify({ error: '请求超时' }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw e
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || '内部服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

