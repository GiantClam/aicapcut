export type ClipKeyframes = { in?: string; out?: string }
export type ClipSpec = {
  idx: number;
  desc: string;
  begin_s: number;
  end_s: number;
  keyframes?: ClipKeyframes;
  // Optional fields for flexibility
  scene_idx?: number;
  narration?: string;
  script?: string;
  prompt?: string;
  text?: string;
  video_url?: string;
}
export type EventItem = { thread_id?: string; run_id?: string; agent?: string; type: string; delta?: string | null; payload?: any; progress?: { current: number; total: number }; ts?: number; code?: string; content?: string }
export type RunClipResult = { idx: number; status: 'succeeded' | 'failed'; video_url?: string; detail?: any }
export type JobInfo = { run_id: string; slogan?: string; cover_url?: string; video_url?: string; share_slug?: string; status?: string; created_at?: string; updated_at?: string }
export type CrewStatus = {
  run_id: string;
  status: string;
  result?: string;
  error?: string;
  expected_clips?: number;
  video_tasks?: any[]; // New field for clip list
  context?: any;
  created_at?: string;
  updated_at?: string;
}

export interface PlanResponse {
  storyboards: ClipSpec[];
}


export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const DEFAULT_BASE = typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_AGENT_URL || process.env.AGENT_URL) ? (process.env.NEXT_PUBLIC_AGENT_URL || process.env.AGENT_URL)! : 'https://api.aimarketingsite.com'

export function getBaseUrl(base?: string) { return base !== undefined ? base : DEFAULT_BASE }

export async function postJson<T>(url: string, body: any, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...(init || {}) })
  if (!res.ok) { try { const err = await res.json(); throw new Error(err?.error || `HTTP ${res.status}`) } catch { throw new Error(`HTTP ${res.status}`) } }
  return res.json() as Promise<T>
}

export type SSEHandle = { stop: () => void }
export async function streamSSE(url: string, body: any, onEvent: (e: EventItem) => void, init?: RequestInit): Promise<SSEHandle> {
  const controller = new AbortController()
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' }, body: JSON.stringify(body), signal: controller.signal, ...(init || {}) })
  if (!res.ok || !res.body) { controller.abort(); throw new Error(`HTTP ${res.status}`) }
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
    ; (async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          const line = part.split('data:').pop()?.trim()
          if (!line) continue
          try { const evt = JSON.parse(line) as EventItem; onEvent(evt) } catch { }
        }
      }
    })()
  return { stop: () => controller.abort() }
}

export type SSEOptions = { onOpen?: () => void; onError?: (err: any) => void; onDone?: () => void; reconnect?: boolean; maxAttempts?: number; backoffMs?: number; init?: RequestInit }
export async function streamSSEEx(url: string, body: any, onEvent: (e: EventItem) => void, opts?: SSEOptions): Promise<SSEHandle> {
  let stopped = false
  let attempts = 0
  const maxAttempts = opts?.maxAttempts ?? 3
  const backoffMs = opts?.backoffMs ?? 1000
  let controller: AbortController | null = null
  async function connect(): Promise<void> {
    if (stopped) return
    attempts++
    controller = new AbortController()
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', ...(opts?.init?.headers || {}) }, body: JSON.stringify(body), signal: controller.signal, ...(opts?.init || {}) })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      opts?.onOpen?.()
      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          const line = part.split('data:').pop()?.trim()
          if (!line) continue
          try { const evt = JSON.parse(line) as EventItem; onEvent(evt) } catch { }
        }
      }
      opts?.onDone?.()
    } catch (err) {
      if (stopped) return
      opts?.onError?.(err)
      if (opts?.reconnect && attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, backoffMs * attempts))
        await connect()
      }
    }
  }
  void connect()
  return { stop: () => { stopped = true; controller?.abort(); controller = null } }
}

export function createSaleAgentClient(config?: { base?: string; init?: RequestInit }) {
  const base = getBaseUrl(config?.base)
  const init = config?.init
  return {
    postJson: <T>(path: string, body: any, extra?: RequestInit) => postJson<T>(`${base}${path}`, body, { ...(init || {}), ...(extra || {}) }),
    streamSSE: (path: string, body: any, onEvent: (e: EventItem) => void, extra?: RequestInit) => streamSSE(`${base}${path}`, body, onEvent, { ...(init || {}), ...(extra || {}) }),
    streamSSEEx: (path: string, body: any, onEvent: (e: EventItem) => void, opts?: SSEOptions) => streamSSEEx(`${base}${path}`, body, onEvent, { ...(opts || {}), init: { ...(init || {}), ...(opts?.init || {}) } }),
  }
}

// Replaced by relative path for Next.js proxy
export async function workflowPlan(goal: string, duration: number, styles: string[], image_control: boolean, num_clips: number, run_id?: string, ref_image_url?: string) {
  const url = `/api/crewai/workflow`
  return postJson<PlanResponse>(url, {
    goal,
    total_duration: duration,
    styles,
    image_control,
    num_clips,
    run_id,
    ref_image_url,
    action: 'plan'
  })
}

export async function workflowKeyframes(storyboards: ClipSpec[], image_control = false, base?: string) {
  const url = `/api/crewai/workflow`
  return postJson<{ storyboards: ClipSpec[] }>(url, { storyboards, image_control, action: 'keyframes' })
}

export async function workflowConfirm(payload: { run_id: string; storyboard?: any; total_duration?: number; styles?: string[]; image_control?: boolean }, base?: string) {
  const url = `/api/crewai/workflow`
  return postJson<{ run_id: string }>(url, { ...payload, action: 'confirm' })
}

export async function workflowRunClips(run_id: string, storyboards: ClipSpec[], onEvent: (e: EventItem) => void, base?: string) {
  const url = `/api/crewai/workflow`
  return streamSSE(url, { run_id, storyboards, action: 'run-clips' }, onEvent)
}

export async function workflowStitch(run_id: string, clips: string[], base?: string) {
  const url = `/api/crewai/video/stitch`
  return postJson<{ run_id: string; final_url: string; status: string }>(url, { run_id, clips })
}

export async function crewRun(payload: { goal: string; styles?: string[]; total_duration?: number; num_clips?: number; image_control?: boolean; run_id?: string }, base?: string) {
  const url = `/api/crewai/workflow`
  return postJson<{ run_id: string; session_id: string; status: string; message: string }>(url, { ...payload, action: 'crew-run' })
}

export async function crewStatus(run_id: string, base?: string) {
  const url = `/api/crewai/workflow`
  const params = new URLSearchParams({ run_id })
  const res = await fetch(`${url}?${params}`, { method: 'GET' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<CrewStatus>
}

// Ensure these also go through proxy if corresponding routes exist or default to relative path
export async function agentSSE(payload: { prompt?: string; img?: string; thread_id?: string; run_id?: string; goal?: string; styles?: string[]; total_duration?: number; num_clips?: number; image_control?: boolean; use_crewai?: boolean }, onEvent: (e: EventItem) => void, base?: string) {
  const url = `/api/crewai/agent` // Proxies to /crewai-chat (previously /crewai-agent)
  return streamSSE(url, payload, onEvent)
}

export async function chatSSE(payload: { action: 'start' | 'message'; thread_id?: string; run_id?: string; message?: string }, onEvent: (e: EventItem) => void, base?: string) {
  const url = `/api/crewai/chat` // Proxies to /crewai-chat (if route exists) or needs new proxy
  return streamSSE(url, payload, onEvent)
}

export async function jobsCreate(payload: { slogan?: string; user_id?: string; run_id?: string }, base?: string) {
  // Assuming no proxy for jobs yet, but relative path implies proxy call if setup. 
  // If not proxied, these will 404. Assuming we only care about workflow for now.
  // Ideally we should proxy these too, but let's stick to the workflow ones requested.
  const url = `${getBaseUrl(base)}/jobs`
  return postJson<{ run_id: string; share_slug: string }>(url, payload)
}

export async function jobsGet(run_id: string, base?: string) {
  const url = `${getBaseUrl(base)}/jobs/${encodeURIComponent(run_id)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<JobInfo>
}

export async function getWorkflowStatus(run_id: string, base?: string) {
  // Use relative path to leverage Next.js rewrites/proxy
  const url = `/workflow/crew-status/${encodeURIComponent(run_id)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<CrewStatus>
}

export async function listWorkflows(limit = 50, base?: string) {
  const url = `/workflow/list?limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<{ workflows: any[] }>
}

export async function storyboardConfirm(payload: { run_id: string; confirmed?: boolean; feedback?: string }, base?: string) {
  const url = `/api/crewai/storyboard/confirm` // Need to ensure this proxy exists
  return postJson<{ run_id: string; status: string; message: string }>(url, payload)
}

export async function sceneUpdate(payload: { message_id?: string; run_id?: string; scene_idx: number; script?: string; image_url?: string }, base?: string) {
  const url = `/api/crewai/scene/update`
  return postJson<any>(url, payload)
}

export async function sceneRegenerate(payload: { message_id?: string; run_id?: string; scene_idx: number; script?: string; context?: any; type?: 'image' | 'video' }, base?: string) {
  const url = `/api/crewai/scene/regenerate`
  return postJson<any>(url, payload)
}

export async function uploadFile(file: File, base?: string): Promise<string> {
  const url = `/api/upload/presign`
  const { upload_url, public_url } = await postJson<{ upload_url: string; public_url: string }>(url, {
    filename: file.name,
    content_type: file.type
  })

  await fetch(upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type }
  })

  return public_url
}

