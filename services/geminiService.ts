
import { GoogleGenAI, Type, FunctionDeclaration, Modality } from "@google/genai";
import { VideoProject, ChatAttachment, ItemType } from '../types';

const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("API Key is missing. Please set process.env.API_KEY.");
        throw new Error("API Key missing");
    }
    return new GoogleGenAI({ apiKey });
};

// --- Helper Functions for Assets ---

export const generateImage = async (prompt: string): Promise<ChatAttachment | null> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: {
                imageConfig: { aspectRatio: "16:9" }
            }
        });

        // Find image part
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return {
                    type: 'image',
                    url: `data:image/png;base64,${part.inlineData.data}`,
                    name: `Generated Image`,
                    mimeType: 'image/png'
                };
            }
        }
        return null;
    } catch (e) {
        console.error("Image generation failed", e);
        throw e;
    }
};

export const generateSpeech = async (text: string): Promise<ChatAttachment | null> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                }
            }
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            // Convert base64 to Blob URL
            const binaryString = atob(base64Audio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const wavBytes = addWavHeader(bytes, 24000, 1);
            const wavBlob = new Blob([wavBytes], { type: 'audio/wav' });
            const url = URL.createObjectURL(wavBlob);

            return {
                type: 'audio',
                url: url,
                name: 'Generated Speech',
                mimeType: 'audio/wav'
            };
        }
        return null;
    } catch (e) {
        console.error("Speech generation failed", e);
        throw e;
    }
};

function addWavHeader(samples: Uint8Array, sampleRate: number, numChannels: number) {
    const buffer = new ArrayBuffer(44 + samples.length);
    const view = new DataView(buffer);
    
    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // file length
    view.setUint32(4, 36 + samples.length, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * numChannels * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, numChannels * 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, samples.length, true);
    
    // Write the PCM samples
    const bytes = new Uint8Array(buffer);
    bytes.set(samples, 44);
    
    return bytes;
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

export const generateVideo = async (prompt: string): Promise<ChatAttachment | null> => {
    // Check key for Veo
    // Safely check for window.aistudio existence to prevent runtime crashes
    if (typeof window !== 'undefined' && (window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
            throw new Error("VEO_KEY_REQUIRED");
        }
    }

    const ai = getAiClient();
    try {
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        // Poll for completion
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (videoUri) {
            // Must append API key to fetch
            const fetchUrl = `${videoUri}&key=${process.env.API_KEY}`;
            return {
                type: 'video',
                url: fetchUrl,
                name: 'Generated Video',
                mimeType: 'video/mp4'
            };
        }
        return null;
    } catch (e) {
        console.error("Video generation failed", e);
        throw e;
    }
};

// --- Project JSON Editing ---

export const editTimelineProject = async (prompt: string, currentProject: VideoProject): Promise<VideoProject | null> => {
    const ai = getAiClient();
    const systemInstruction = `
    You are an AI Video Editor. Update the JSON video project based on the User Request.
    Current Project State provided.
    
    Rules:
    - Maintain valid JSON.
    - Use "https://picsum.photos/1280/720?random=[n]" for placeholders.
    - Ensure logical track structure.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Current Project: ${JSON.stringify(currentProject)}\nUser Request: ${prompt}`,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  width: { type: Type.NUMBER },
                  height: { type: Type.NUMBER },
                  duration: { type: Type.NUMBER },
                  tracks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.NUMBER },
                        type: { type: Type.STRING },
                        name: { type: Type.STRING },
                        items: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              id: { type: Type.STRING },
                              type: { type: Type.STRING, enum: ['video', 'image', 'text', 'audio'] },
                              content: { type: Type.STRING },
                              startTime: { type: Type.NUMBER },
                              duration: { type: Type.NUMBER },
                              trackId: { type: Type.NUMBER },
                              name: { type: Type.STRING },
                              style: {
                                type: Type.OBJECT,
                                properties: {
                                  fontSize: { type: Type.NUMBER },
                                  color: { type: Type.STRING },
                                  backgroundColor: { type: Type.STRING },
                                  x: { type: Type.NUMBER },
                                  y: { type: Type.NUMBER },
                                  width: { type: Type.NUMBER },
                                  height: { type: Type.NUMBER },
                                  opacity: { type: Type.NUMBER },
                                  rotation: { type: Type.NUMBER },
                                  scale: { type: Type.NUMBER }
                                },
                                nullable: true
                              }
                            },
                            required: ['id', 'type', 'content', 'startTime', 'duration', 'trackId', 'name']
                          }
                        }
                      },
                      required: ['id', 'type', 'name', 'items']
                    }
                  }
                },
                required: ['name', 'width', 'height', 'duration', 'tracks']
              }
        }
    });

    try {
        if(response.text) {
             return JSON.parse(response.text) as VideoProject;
        }
    } catch(e) { console.error(e); }
    return null;
}

// --- Main Orchestrator ---

export type ProcessResult = {
    text: string;
    projectUpdate?: VideoProject;
    attachment?: ChatAttachment;
};

const tools: FunctionDeclaration[] = [
    {
        name: "generate_image",
        description: "Generate an image asset based on a prompt. Use this when the user asks to create, make, or generate an image, photo, or picture.",
        parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING, description: "Detailed description of the image" } }, required: ["prompt"] }
    },
    {
        name: "generate_video",
        description: "Generate a video asset based on a prompt. Use this when the user asks to create, make, or generate a video clip or scene.",
        parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING, description: "Detailed description of the video movement and subject" } }, required: ["prompt"] }
    },
    {
        name: "generate_speech",
        description: "Generate speech or voiceover audio from text. Use this when user asks for voiceover, speech, or saying something.",
        parameters: { type: Type.OBJECT, properties: { text: { type: Type.STRING, description: "The text to be spoken" } }, required: ["text"] }
    },
    {
        name: "edit_timeline",
        description: "Edit the video project structure, add clips to the timeline, change text, reorder, or modify the edit. Use this for general editing tasks.",
        parameters: { type: Type.OBJECT, properties: { instruction: { type: Type.STRING, description: "What changes to make to the timeline" } }, required: ["instruction"] }
    }
];

export const processUserRequest = async (userMessage: string, currentProject: VideoProject): Promise<ProcessResult> => {
    const ai = getAiClient();
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userMessage,
            config: {
                tools: [{ functionDeclarations: tools }],
                systemInstruction: "You are a capable AI video editor assistant. You can generate assets (images, video, speech) or edit the timeline. Choose the appropriate tool for the user's request. If the user greets or asks a question, just reply with text."
            }
        });

        const call = response.functionCalls?.[0];
        
        if (call) {
            console.log("Tool Call:", call.name, call.args);
            
            if (call.name === 'generate_image') {
                const attachment = await generateImage(String(call.args['prompt']));
                return { text: `I've generated an image for "${call.args['prompt']}".`, attachment: attachment || undefined };
            }
            
            if (call.name === 'generate_video') {
                const attachment = await generateVideo(String(call.args['prompt']));
                return { text: `I've generated a video for "${call.args['prompt']}".`, attachment: attachment || undefined };
            }

            if (call.name === 'generate_speech') {
                const attachment = await generateSpeech(String(call.args['text']));
                return { text: `I've created the voiceover.`, attachment: attachment || undefined };
            }

            if (call.name === 'edit_timeline') {
                const newProject = await editTimelineProject(String(call.args['instruction']), currentProject);
                if (newProject) {
                    return { text: `I've updated the timeline based on: ${call.args['instruction']}`, projectUpdate: newProject };
                } else {
                    return { text: "I tried to edit the timeline but failed to generate a valid update." };
                }
            }
        }

        return { text: response.text || "I'm not sure how to help with that." };

    } catch (error: any) {
        console.error("Process request failed", error);
        if (error.message === "VEO_KEY_REQUIRED") {
             throw error; // Re-throw to be handled by UI
        }
        return { text: "Sorry, I encountered an error processing your request." };
    }
};
