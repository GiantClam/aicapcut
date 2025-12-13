
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Plus, Play, FileAudio, Image as ImageIcon, Video, LayoutTemplate, ArrowRight, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { useEditor } from '../contexts/EditorContext';
import { streamAgentResponse, uuidv4 } from '../services/crewaiService'; // Updated import
import { ChatMessage, ChatAttachment, ItemType, Asset, CrewAIEvent } from '../types';

interface ChatInterfaceProps {
  isEditorOpen?: boolean;
  onToggleEditor?: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ isEditorOpen = true, onToggleEditor }) => {
  const { project, setProject, addAsset } = useEditor();
  const [input, setInput] = useState('');
  
  // Initialize thread_id once per session
  const [threadId] = useState(() => uuidv4());
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Greetings. I am your Creative Agent. Describe the video you want to create, and I will coordinate the crew to build it for you.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleAddAsset = (attachment: ChatAttachment) => {
      let itemType = ItemType.VIDEO;
      if (attachment.type === 'image') itemType = ItemType.IMAGE;
      if (attachment.type === 'audio') itemType = ItemType.AUDIO;

      const newAsset: Asset = {
          id: `gen-${Date.now()}`,
          type: itemType,
          name: attachment.name || 'Generated Asset',
          url: attachment.url,
          thumbnail: attachment.type === 'image' ? attachment.url : undefined
      };
      addAsset(newAsset);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    const currentRunId = uuidv4();
    
    setInput('');
    // Add user message
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    
    // Add initial placeholder for model message
    setMessages(prev => [...prev, { role: 'model', text: '', status: 'Starting agent...', progress: 0 }]);
    
    setIsLoading(true);

    try {
        await streamAgentResponse(
            {
                prompt: userMsg,
                thread_id: threadId,
                run_id: currentRunId
            },
            (event: CrewAIEvent) => {
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];

                    // Ensure we are updating the model's message
                    if (lastMsg.role !== 'model') return prev;

                    switch (event.type) {
                        case 'delta':
                            if (event.delta) {
                                lastMsg.text = (lastMsg.text || '') + event.delta;
                                // Clear status if we are receiving text content (streaming response)
                                if (lastMsg.status?.startsWith('Thinking') || lastMsg.status === 'Starting agent...') {
                                    lastMsg.status = undefined; 
                                }
                            }
                            break;
                            
                        case 'thought':
                        case 'info':
                            // Update status indicator
                            lastMsg.status = event.agent ? `${event.agent}: Thinking...` : 'Processing...';
                            break;

                        case 'progress':
                            if (event.progress !== undefined) {
                                lastMsg.progress = event.progress;
                            }
                            break;

                        case 'run_finished':
                            lastMsg.status = 'Completed';
                            lastMsg.progress = 100;
                            if (event.payload?.video_url) {
                                const videoUrl = event.payload.video_url;
                                const attachment: ChatAttachment = {
                                    type: 'video',
                                    url: videoUrl,
                                    name: 'Final Video',
                                    mimeType: 'video/mp4'
                                };
                                lastMsg.attachments = [attachment];
                                
                                // Auto-add to asset library for convenience
                                handleAddAsset(attachment);
                            }
                            if (event.delta) {
                                // If there is a final message summary in delta
                                lastMsg.text = (lastMsg.text || '') + event.delta;
                            }
                            break;

                        case 'error':
                            lastMsg.isError = true;
                            lastMsg.text = (lastMsg.text || '') + `\nError: ${event.payload?.error || 'Unknown error'}`;
                            lastMsg.status = 'Failed';
                            break;
                    }
                    return newMessages;
                });
            },
            (error) => {
                console.error("Stream error", error);
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    lastMsg.isError = true;
                    lastMsg.text = (lastMsg.text || '') + "\n(Connection Error)";
                    return newMessages;
                });
                setIsLoading(false);
            },
            () => {
                // On Complete
                setIsLoading(false);
            }
        );

    } catch (error: any) {
      console.error(error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b]">
      {/* Header */}
      <div className={`
        flex items-center justify-between p-4 border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur-md z-20 sticky top-0
        transition-all duration-700
      `}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-900/20">
             <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-100 text-sm tracking-wide">CrewAI Agent</h2>
            <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-gray-400 font-mono">CONNECTED</span>
            </div>
          </div>
        </div>

        {onToggleEditor && (
            <button 
                onClick={onToggleEditor}
                className={`
                    flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 border
                    ${isEditorOpen 
                        ? 'bg-[#18181b] text-gray-400 border-[#27272a] hover:text-white hover:border-gray-500' 
                        : 'bg-white text-black border-transparent hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]'}
                `}
            >
                {isEditorOpen ? (
                    <>
                        <ChevronLeft size={14} />
                        <span>Hide Studio</span>
                    </>
                ) : (
                    <>
                        <span>Open Studio</span>
                        <LayoutTemplate size={14} />
                    </>
                )}
            </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto min-h-0 relative scroll-smooth">
        {/* Container to center content when in Full/Agent mode */}
        <div className={`
            mx-auto h-full flex flex-col p-4 space-y-8 transition-all duration-700
            ${isEditorOpen ? 'max-w-full' : 'max-w-3xl pt-12'}
        `}>
            
            {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xl border border-white/5
                    ${msg.role === 'model' ? 'bg-[#18181b]' : 'bg-white'}
                `}>
                {msg.role === 'model' 
                    ? <Bot size={16} className="text-purple-400" /> 
                    : <User size={16} className="text-black" />
                }
                </div>
                
                <div className={`flex flex-col gap-3 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    
                    {/* Status / Thought Indicator */}
                    {msg.status && (
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono animate-pulse px-1">
                            <Activity size={10} />
                            <span>{msg.status}</span>
                            {msg.progress !== undefined && msg.progress > 0 && msg.progress < 100 && (
                                <span className="text-purple-400">({msg.progress}%)</span>
                            )}
                        </div>
                    )}

                    {(msg.text || msg.status) && (
                        <div className={`
                            px-5 py-3.5 text-sm leading-relaxed shadow-sm backdrop-blur-sm whitespace-pre-wrap
                            ${msg.role === 'model' 
                                ? 'bg-[#18181b] text-gray-200 rounded-2xl rounded-tl-none border border-[#27272a]' 
                                : 'bg-[#27272a] text-white rounded-2xl rounded-tr-none border border-[#3f3f46]'
                            } 
                            ${msg.isError ? 'border-red-500/30 bg-red-950/20 text-red-200' : ''}
                        `}>
                        {msg.text}
                        </div>
                    )}

                    {msg.attachments?.map((att, i) => (
                        <div key={i} className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden w-72 shadow-2xl group transition-transform hover:scale-[1.02]">
                            {att.type === 'image' && (
                                <div className="relative aspect-video bg-black/50">
                                    <img src={att.url} alt="generated" className="w-full h-full object-cover" />
                                </div>
                            )}
                            {att.type === 'video' && (
                                <div className="relative aspect-video bg-black">
                                    <video src={att.url} controls className="w-full h-full" />
                                </div>
                            )}
                            {att.type === 'audio' && (
                                <div className="p-6 flex items-center justify-center bg-gradient-to-br from-[#18181b] to-[#27272a]">
                                    <audio src={att.url} controls className="w-full h-8" />
                                </div>
                            )}
                            
                            <div className="p-3 bg-[#18181b] flex items-center justify-between border-t border-[#27272a]">
                                <div className="flex items-center gap-2 text-xs text-gray-400 truncate">
                                    {att.type === 'image' && <ImageIcon size={12} className="text-blue-400" />}
                                    {att.type === 'video' && <Video size={12} className="text-purple-400" />}
                                    {att.type === 'audio' && <FileAudio size={12} className="text-emerald-400" />}
                                    <span className="truncate max-w-[140px] font-medium">{att.name}</span>
                                </div>
                                <button 
                                    onClick={() => handleAddAsset(att)}
                                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-400 hover:text-purple-300 transition-colors bg-purple-500/10 px-2 py-1 rounded hover:bg-purple-500/20"
                                >
                                    <Plus size={10} />
                                    Add to Project
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            ))}

            {isLoading && !messages[messages.length-1].text && !messages[messages.length-1].status && (
            <div className="flex gap-4 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-[#18181b] flex items-center justify-center shrink-0 border border-white/5">
                <Sparkles size={14} className="text-purple-400" />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                         <Loader2 className="w-3 h-3 animate-spin" />
                         <span>CONNECTING TO CREW...</span>
                    </div>
                </div>
            </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Input Area */}
      <div className={`
        border-t border-[#27272a] bg-[#09090b]
        transition-all duration-700
      `}>
          <div className={`
             mx-auto p-4
             ${isEditorOpen ? 'max-w-full' : 'max-w-3xl'}
          `}>
            <form onSubmit={handleSubmit} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />
                
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask the crew to generate a video..."
                    className="w-full bg-[#18181b] text-white rounded-2xl pl-6 pr-14 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder-gray-500 border border-[#27272a] shadow-inner transition-all relative z-10"
                />
                
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-xl flex items-center justify-center text-black hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all z-20 shadow-lg shadow-purple-900/20"
                >
                    {isLoading ? <Loader2 size={18} className="animate-spin text-purple-600" /> : <Send size={18} />}
                </button>
            </form>
            <div className="text-center mt-3">
                 <p className="text-[10px] text-gray-600">AI agents can make mistakes. Review generated assets.</p>
            </div>
          </div>
      </div>
    </div>
  );
};

export default ChatInterface;
