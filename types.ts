
export enum ItemType {
  VIDEO = 'video',
  IMAGE = 'image',
  TEXT = 'text',
  AUDIO = 'audio'
}

export interface TimelineItem {
  id: string;
  type: ItemType;
  content: string; // URL for media, or string for text
  startTime: number; // in seconds
  duration: number; // in seconds
  trackId: number;
  name: string;
  style?: {
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    x?: number; // percentage 0-100
    y?: number; // percentage 0-100
    width?: number; // percentage 0-100, default auto or specific
    height?: number; // percentage, mostly for aspect ratio maintenance
    opacity?: number; // 0-1
    rotation?: number; // degrees
    scale?: number; // percentage 100 = 1.0
  };
}

export interface Track {
  id: number;
  type: 'video' | 'audio' | 'overlay';
  name: string;
  items: TimelineItem[];
}

export interface VideoProject {
  name: string;
  width: number;
  height: number;
  duration: number; // Total duration in seconds
  tracks: Track[];
}

export interface Asset {
  id: string;
  type: ItemType;
  url: string;
  name: string;
  thumbnail?: string;
}

export interface ChatAttachment {
  type: 'image' | 'video' | 'audio';
  url: string;
  name?: string;
  mimeType?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text?: string;
  isError?: boolean;
  attachments?: ChatAttachment[];
  // For UI state tracking during streaming
  status?: string; 
  progress?: number;
}

// --- CrewAI Backend Types ---

export type CrewAIEventType = 'thought' | 'info' | 'tool_result' | 'progress' | 'heartbeat' | 'error' | 'run_finished' | 'delta';

export interface CrewAIEvent {
  type: CrewAIEventType;
  agent?: string;
  delta?: string; // The text content chunk
  progress?: number;
  payload?: {
    share_slug?: string;
    video_url?: string;
    error?: string;
    [key: string]: any;
  };
}
