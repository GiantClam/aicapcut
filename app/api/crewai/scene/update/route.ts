import { NextRequest } from 'next/server'

const AGENT_URL = process.env.AGENT_URL || process.env.VITE_AGENT_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000)

    let fetchInit: RequestInit

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      fetchInit = {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      }
    } else {
      const json = await request.json()
      fetchInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
        signal: controller.signal,
      }
    }

    try {
      const res = await fetch(`${AGENT_URL}/crewai/scene/update`, fetchInit)
      clearTimeout(timeoutId)

      const text = await res.text()
      return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json' } })
    } catch (e: any) {
      clearTimeout(timeoutId)
      if (e.name === 'AbortError') {
        return new Response(JSON.stringify({ error: '请求超时' }), { status: 504 })
      }
      throw e
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || '内部服务器错误' }), { status: 500 })
  }
}

