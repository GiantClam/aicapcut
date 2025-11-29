
import { CrewAIEvent } from '../types';

// Simple UUID generator
export const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const BASE_URL = ''; // Relative path, assumes proxy or same-origin

interface AgentRequest {
  prompt: string;
  thread_id: string;
  run_id: string;
  img?: string;
}

export const streamAgentResponse = async (
  requestData: AgentRequest,
  onEvent: (event: CrewAIEvent) => void,
  onError: (error: any) => void,
  onComplete: () => void
) => {
  try {
    const response = await fetch(`${BASE_URL}/crewai-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode stream chunk
      buffer += decoder.decode(value, { stream: true });
      
      // Split by double newline (SSE standard delimiter)
      const parts = buffer.split('\n\n');
      // Keep the last part in buffer as it might be incomplete
      buffer = parts.pop() || '';

      for (const part of parts) {
        if (part.startsWith('data: ')) {
          const jsonStr = part.substring(6).trim();
          if (jsonStr === '[DONE]') continue; // Standard SSE close signal (optional)
          
          try {
            const event: CrewAIEvent = JSON.parse(jsonStr);
            onEvent(event);
          } catch (e) {
            console.warn('Failed to parse SSE event:', jsonStr);
          }
        }
      }
    }

    onComplete();

  } catch (error) {
    onError(error);
  }
};
