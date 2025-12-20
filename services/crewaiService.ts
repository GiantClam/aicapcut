
import { CrewAIEvent, AgentRequest, ChatRequest, PlanRequest, PlanResponse, Job } from '../types';

// Simple UUID generator
export const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const BASE_URL = '/api';

// --- Generic SSE Handler ---

const fetchSSE = async (
    endpoint: string,
    body: any,
    onEvent: (event: CrewAIEvent) => void,
    onError: (error: any) => void,
    onComplete: () => void,
    timeoutMs: number = 300000
) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
            },
            body: JSON.stringify(body),
            credentials: 'omit', // Crucial for calling public APIs from a different origin to avoid CORS credential checks
            cache: 'no-store',   // Ensure we don't hit cache for streaming
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorMsg = `HTTP Error ${response.status}`;
            try {
                const errJson = await response.json();
                if (errJson.error) errorMsg = errJson.error;
            } catch {
                // Ignore json parse error of error response
            }
            throw new Error(errorMsg);
        }

        if (!response.body) {
            throw new Error('No response body received');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // SSE messages are delimited by double newline
            const parts = buffer.split('\n\n');

            // Keep the incomplete part in the buffer
            buffer = parts.pop() || '';

            for (const part of parts) {
                if (!part.trim()) continue;

                const lines = part.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.substring(6).trim();
                        if (jsonStr === '[DONE]') continue;

                        try {
                            const event: CrewAIEvent = JSON.parse(jsonStr);
                            onEvent(event);
                        } catch (e) {
                            console.warn('Failed to parse SSE event:', jsonStr);
                        }
                    }
                }
            }
        }

        onComplete();

    } catch (error: any) {
        if (error.name === 'AbortError') {
            onError(new Error('Request timed out'));
        } else {
            // Check for potential CORS/Network error to give a better hint
            if (error.message === 'Failed to fetch') {
                console.warn("⚠️ Network error detected. This is often caused by CORS issues.\nPlease check your Railway backend settings:\n1. Ensure 'CORS_ORIGIN' env var includes your frontend URL.\n2. Check if the server is reachable.");
            }
            console.error("Fetch SSE Error:", error);
            onError(error);
        }
    } finally {
        clearTimeout(timeoutId);
    }
};

// --- Streaming APIs ---

/**
 * Trigger the main Agent Workflow (Task execution).
 * Endpoint: POST /crewai-agent
 */
export const streamAgentResponse = async (
    requestData: AgentRequest,
    onEvent: (event: CrewAIEvent) => void,
    onError: (error: any) => void,
    onComplete: () => void
) => {
    return fetchSSE('/crewai-agent', requestData, onEvent, onError, onComplete, 300000);
};

/**
 * Conversational interface for info gathering and video generation flow.
 * Endpoint: POST /crewai-chat
 */
export const streamChatResponse = async (
    requestData: ChatRequest,
    onEvent: (event: CrewAIEvent) => void,
    onError: (error: any) => void,
    onComplete: () => void
) => {
    // Ensure "action" is present as per client suggestion, defaulting to "message" if not provided
    const payload = {
        action: requestData.action || 'message',
        ...requestData
    };
    return fetchSSE('/crewai-chat', payload, onEvent, onError, onComplete, 600000);
};

// --- REST APIs ---

/**
 * Generate a video plan (storyboards) from a goal.
 * Endpoint: POST /workflow/plan
 */
export const generatePlan = async (data: PlanRequest): Promise<PlanResponse> => {
    const response = await fetch(`${BASE_URL}/workflow/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'omit'
    });
    if (!response.ok) throw new Error('Failed to generate plan');
    return await response.json();
};

/**
 * Fetch public jobs (gallery).
 * Endpoint: GET /public-jobs
 */
export const fetchPublicJobs = async (page = 1, limit = 10, q = ''): Promise<Job[]> => {
    const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        q
    });
    const response = await fetch(`${BASE_URL}/public-jobs?${query.toString()}`, {
        credentials: 'omit'
    });
    if (!response.ok) throw new Error('Failed to fetch jobs');
    return await response.json();
};

/**
 * Stitch specific segments into a final video.
 * Endpoint: POST /workflow/stitch
 */
export const stitchVideo = async (runId: string, segments: string[]): Promise<{ final_url: string }> => {
    const response = await fetch(`${BASE_URL}/workflow/stitch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: runId, segments }),
        credentials: 'omit'
    });
    if (!response.ok) throw new Error('Stitching failed');
    return await response.json();
};

/**
 * Confirm the storyboard plan to proceed with production.
 * Endpoint: POST /crewai/storyboard/confirm
 */
export const confirmStoryboard = async (runId: string, confirmed: boolean, feedback?: string): Promise<any> => {
    const response = await fetch(`${BASE_URL}/crewai/storyboard/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: runId, confirmed, feedback }),
        credentials: 'omit'
    });
    if (!response.ok) throw new Error('Confirmation failed');
    return await response.json();
};

/**
 * Confirm video clips and trigger stitching.
 * Endpoint: POST /crewai/video-clips/confirm
 */
export const confirmVideoClips = async (runId: string): Promise<{ final_url: string }> => {
    const response = await fetch(`${BASE_URL}/crewai/video-clips/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: runId, confirmed: true }),
        credentials: 'omit'
    });
    if (!response.ok) throw new Error('Video confirmation failed');
    return await response.json();
};

/**
 * Update a specific scene in the storyboard.
 * Endpoint: POST /crewai/scene/update
 */
export const updateScene = async (runId: string, sceneIndex: number, script?: string, imageUrl?: string): Promise<any> => {
    // Mapping runId to message_id as per prompt context if needed, 
    // or using run_id if the backend supports it.
    // Assuming run_id is the correct identifier for the session/task.
    const response = await fetch(`${BASE_URL}/crewai/scene/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message_id: runId, // Using runId as message_id based on context
            scene_idx: sceneIndex,
            script,
            image_url: imageUrl
        }),
        credentials: 'omit'
    });
    if (!response.ok) throw new Error('Scene update failed');
    return await response.json();
};

export const updateSceneWithImage = async (runId: string, sceneIndex: number, script: string, imageFile?: File): Promise<any> => {
    const formData = new FormData();
    formData.append("message_id", runId);
    formData.append("scene_idx", sceneIndex.toString());
    formData.append("script", script);
    if (imageFile) {
        formData.append("image", imageFile);
    }

    const response = await fetch(`${BASE_URL}/crewai/scene/update`, {
        method: 'POST',
        body: formData,
        credentials: 'omit'
    });
    if (!response.ok) throw new Error('Scene update failed');
    return await response.json();
};

/**
 * Regenerate a scene's visual or script.
 * Endpoint: POST /crewai/scene/regenerate
 */
export const regenerateScene = async (runId: string, sceneIndex: number, type: 'script' | 'image' | 'both'): Promise<any> => {
    const response = await fetch(`${BASE_URL}/crewai/scene/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message_id: runId,
            scene_idx: sceneIndex,
            // context: {} // Optional context 
        }),
        credentials: 'omit'
    });
    if (!response.ok) throw new Error('Scene regeneration failed');
    return await response.json();
};
