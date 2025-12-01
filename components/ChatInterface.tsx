
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Plus, FileAudio, Image as ImageIcon, Video, LayoutTemplate, ChevronLeft, Layout, Activity } from 'lucide-react';
import { useEditor } from '../contexts/EditorContext';
import { ChatMessage, ChatAttachment, ItemType, Asset } from '../types';
import { streamAgentResponse, uuidv4, confirmStoryboard } from '../services/crewaiService';

interface ChatInterfaceProps {
  isEditorOpen?: boolean;
  onToggleEditor?: () => void;
}

type Step = 'idle' | 'type' | 'duration' | 'styles' | 'core' | 'key' | 'consistency' | 'done';

interface VideoBrief {
  videoType?: string;
  durationSec?: number;
  styles: string[];
  coreInfo?: string;
  keyElements: string[];
  consistencyElements: string[];
}

const videoTypeOptions = ['产品宣传视频','品牌故事视频','教程视频','活动推广视频','社交媒体短视频','广告片','产品演示视频','其他'];
const durationOptions = [10,20,30,60,90,120];
const styleOptions = ['写实','极简','科技','温暖','纪实','动效','快节奏','慢节奏','戏剧性'];

const ChatInterface: React.FC<ChatInterfaceProps> = ({ isEditorOpen = true, onToggleEditor }) => {
  const { project, setProject, addAsset } = useEditor();
  const [input, setInput] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>('idle');
  const [brief, setBrief] = useState<VideoBrief>({ styles: [], keyElements: [], consistencyElements: [] });
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [keyElementInput, setKeyElementInput] = useState('');
  const [consistencyInput, setConsistencyInput] = useState('');
  const [enableImageControl, setEnableImageControl] = useState(false); // New state for visual control
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: '您好，我是您的视频助手。请输入视频主题，我将逐步与您确认类型、时长、风格、核心信息、重点元素与一致性要素。' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [threadId] = useState(() => uuidv4());

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
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);

    if (currentStep === 'idle') {
      const suggestionType = videoTypeOptions.find(t => userMsg.includes(t.replace('视频','')));
      const suggestionDuration = (() => {
        const m = userMsg.match(/(10|20|30|60|90|120)\s*(秒|s|sec|second|秒钟)?/i);
        return m ? Number(m[1]) : undefined;
      })();
      const suggestionStyles = styleOptions.filter(s => userMsg.includes(s));
      setBrief(prev => ({
        ...prev,
        videoType: suggestionType,
        durationSec: suggestionDuration,
        styles: suggestionStyles
      }));
      setSelectedStyles(suggestionStyles);
      setMessages(prev => [...prev, { role: 'model', text: '首先，请选择视频类型：', options: videoTypeOptions }]);
      setCurrentStep('type');
    } else if (currentStep === 'type') {
      setBrief(prev => ({ ...prev, videoType: userMsg }));
      setMessages(prev => [...prev, { role: 'model', text: '好的，您希望视频的时长是多久？', options: durationOptions.map(d => `${d}秒`) }]);
      setCurrentStep('duration');
    } else if (currentStep === 'duration') {
        const dur = parseInt(userMsg);
        setBrief(prev => ({ ...prev, durationSec: isNaN(dur) ? undefined : dur }));
        setMessages(prev => [...prev, { role: 'model', text: '请选择视频的风格：', options: styleOptions }]);
        setCurrentStep('styles');
    } else if (currentStep === 'styles') {
        setBrief(prev => ({ ...prev, styles: [userMsg] }));
        setMessages(prev => [...prev, { role: 'model', text: '请填写视频的核心信息：' }]);
        setCurrentStep('core');
    } else if (currentStep === 'core') {
        setBrief(prev => ({ ...prev, coreInfo: userMsg }));
        setMessages(prev => [...prev, { role: 'model', text: '请添加需要重点展示的元素（输入多个可用逗号分隔）：' }]);
        setCurrentStep('key');
    } else if (currentStep === 'key') {
        const keys = userMsg.split(/[,，、]/).map(k => k.trim()).filter(k => k);
        setBrief(prev => ({ ...prev, keyElements: keys }));
        setMessages(prev => [...prev, { role: 'model', text: '请添加需要保持一致性的元素内容（输入多个可用逗号分隔）：' }]);
        setCurrentStep('consistency');
    } else if (currentStep === 'consistency') {
        const cons = userMsg.split(/[,，、]/).map(k => k.trim()).filter(k => k);
        const finalBrief = { ...brief, consistencyElements: cons };
        setBrief(finalBrief);
        const summary = `信息确认完成：\n类型：${finalBrief.videoType || '未选择'}\n时长：${finalBrief.durationSec ? finalBrief.durationSec+'秒' : '未选择'}\n风格：${(finalBrief.styles||[]).join('、') || '未选择'}\n核心信息：${finalBrief.coreInfo || '未填写'}\n重点元素：${(finalBrief.keyElements||[]).join('、') || '未添加'}\n一致性要素：${(finalBrief.consistencyElements||[]).join('、') || '未添加'}`;
        setMessages(prev => [...prev, { role: 'model', text: summary }]);
        setCurrentStep('done');
        startCrewRun(summary);
    } else if (currentStep === 'done') {
        // Handle conversation after initial brief (e.g. plan adjustments)
        setMessages(prev => {
            const newMessages = [...prev];
            const confirmMsg = newMessages.find(m => m.requiresConfirmation);
            if (confirmMsg) {
                confirmMsg.requiresConfirmation = false;
            }
            return newMessages;
        });
        startCrewRun(userMsg);
    }
  };

  const handleOptionClick = (option: string) => {
    if (isLoading) return;
    // Simulate user input
    setMessages(prev => [...prev, { role: 'user', text: option }]);
    
    if (currentStep === 'type') {
        setBrief(prev => ({ ...prev, videoType: option }));
        setMessages(prev => [...prev, { role: 'model', text: '好的，您希望视频的时长是多久？', options: durationOptions.map(d => `${d}秒`) }]);
        setCurrentStep('duration');
    } else if (currentStep === 'duration') {
        const dur = parseInt(option);
        setBrief(prev => ({ ...prev, durationSec: isNaN(dur) ? undefined : dur }));
        setMessages(prev => [...prev, { role: 'model', text: '请选择视频的风格：', options: styleOptions }]);
        setCurrentStep('styles');
    } else if (currentStep === 'styles') {
        setBrief(prev => ({ ...prev, styles: [option] }));
        setMessages(prev => [...prev, { role: 'model', text: '请填写视频的核心信息：' }]);
        setCurrentStep('core');
    }
  };

  const startCrewRun = (promptText: string) => {
    setMessages(prev => [...prev, { role: 'model', text: '', status: 'Starting agent...', progress: 0 }]);
    setIsLoading(true);
    // Create a new run_id for each interaction, but keep thread_id consistent
    const currentRunId = uuidv4();
    
    // If this is the initial brief, append instructions to wait for confirmation
    const finalPrompt = promptText.includes('信息确认完成') 
        ? promptText + "\n\nPlease generate the detailed video plan (scenes, keyframes, and script) first. Then stop and wait for user confirmation before generating the actual video."
        : promptText;

    streamAgentResponse(
      { 
          prompt: finalPrompt, 
          thread_id: threadId, 
          run_id: currentRunId, 
          use_crewai: true,
          image_control: enableImageControl, // Pass visual control setting
          // Sora2 only supports single image input currently, so we disable start/end frame logic implicitly
          // by backend handling or here if we had specific params for it.
          // For now, 'image_control' true will trigger the single reference image generation path in backend.
      },
      (event) => {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role !== 'model') return prev;
          if (event.type === 'delta' && event.delta) {
            lastMsg.text = (lastMsg.text || '') + event.delta;
            if (lastMsg.status === 'Starting agent...') lastMsg.status = undefined;
          }
          if (event.type === 'progress' && event.progress !== undefined) {
            lastMsg.progress = event.progress as any;
          }
          if (event.type === 'thought') {
            // Check if this is the Visual Design agent thinking
            if (event.delta?.includes('Visual Design')) {
                 lastMsg.status = 'Generating Keyframes...';
            } else {
                 lastMsg.status = 'Processing...';
            }
          }
          if (event.type === 'info') {
              // Display system info messages (e.g. "Please confirm storyboard")
              if (event.delta) {
                  const infoText = `\n📝 ${event.delta}`;
                  // Avoid duplicating if already present (simple check)
                  if (!lastMsg.text?.endsWith(infoText)) {
                      lastMsg.text = (lastMsg.text || '') + infoText;
                  }
              }
              lastMsg.status = 'Processing...';
          }
          if (event.type === 'run_finished') {
            if (event.payload?.code === 'confirmation_required') {
              lastMsg.status = '等待人工确认…';
              lastMsg.requiresConfirmation = true;
              
              // Handle scene image and script for confirmation
              if (event.payload?.image_url || event.payload?.scene_image) {
                  const imgUrl = (event.payload.image_url || event.payload.scene_image) as string;
                  const attachment: ChatAttachment = { 
                      type: 'image', 
                      url: imgUrl, 
                      name: 'Scene Preview', 
                      mimeType: 'image/png' 
                  };
                  lastMsg.attachments = [...(lastMsg.attachments || []), attachment];
                  handleAddAsset(attachment);
              }
              
              if (event.payload?.script) {
                  const scriptText = `\n\n📜 **Scene Script:**\n${event.payload.script}`;
                  if (!lastMsg.text?.includes(scriptText)) {
                      lastMsg.text = (lastMsg.text || '') + scriptText;
                  }
              }

              // We stop loading here to allow user interaction
              setIsLoading(false);
            } else {
              lastMsg.status = 'Completed';
              lastMsg.progress = 100 as any;
              if (event.payload?.video_url) {
                const videoUrl = event.payload.video_url as string;
                const attachment: ChatAttachment = { type: 'video', url: videoUrl, name: 'Final Video', mimeType: 'video/mp4' };
                lastMsg.attachments = [attachment];
                handleAddAsset(attachment);
              }
              if (event.delta) {
                lastMsg.text = (lastMsg.text || '') + event.delta;
              }
            }
          }
          return newMessages;
        });
      },
      () => {
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      }
    );
  };

  const handleConfirm = async () => {
    // Remove confirmation button from previous message
    setMessages(prev => {
        const newMessages = [...prev];
        // Find the message waiting for confirmation (usually the last one)
        const confirmMsg = newMessages.find(m => m.requiresConfirmation);
        if (confirmMsg) {
            confirmMsg.requiresConfirmation = false;
            confirmMsg.status = 'Confirmed';
        }
        return newMessages;
    });

    const userText = "Confirmed. Please proceed with video generation.";
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    
    try {
        // Call backend confirmation endpoint first
        await confirmStoryboard(threadId);
        
        // Then resume the agent workflow
        startCrewRun(userText);
    } catch (error) {
        console.error("Confirmation failed:", error);
        setMessages(prev => [...prev, { role: 'model', text: 'Confirmation failed. Please try again.', isError: true }]);
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
        {currentStep === 'idle' && (
            <div className="mb-4 flex items-center gap-2 bg-[#18181b] p-3 rounded-xl border border-[#27272a] animate-in fade-in slide-in-from-bottom-4">
                <div className="flex-1">
                    <div className="text-xs text-gray-200 font-medium flex items-center gap-1.5">
                        <Sparkles size={12} className="text-purple-400" />
                        Enable Visual Control (Reference Image)
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                        AI will generate a reference image for video consistency (Sora2 mode).
                    </div>
                </div>
                <button
                    onClick={() => setEnableImageControl(!enableImageControl)}
                    className={`
                        w-10 h-5 rounded-full relative transition-colors duration-300
                        ${enableImageControl ? 'bg-purple-600' : 'bg-[#3f3f46]'}
                    `}
                >
                    <div className={`
                        w-3 h-3 rounded-full bg-white absolute top-1 transition-all duration-300
                        ${enableImageControl ? 'left-6' : 'left-1'}
                    `} />
                </button>
            </div>
        )}
        
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
                        {msg.options && (
                          <div className="flex flex-wrap gap-2 mt-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {msg.options.map((opt, i) => (
                              <button
                                key={i}
                                onClick={() => handleOptionClick(opt)}
                                className="px-3 py-1.5 rounded-full text-xs bg-[#27272a] text-gray-200 border border-[#3f3f46] hover:bg-purple-600 hover:text-white hover:border-purple-500 transition-all"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                        {msg.requiresConfirmation && (
                            <div className="mt-4 flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <button
                                    onClick={handleConfirm}
                                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-green-900/20 hover:scale-105 hover:shadow-green-900/40 transition-all flex items-center gap-2 group"
                                >
                                    <span>Confirm Plan</span>
                                    <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30">
                                        <Activity size={10} className="text-white" />
                                    </div>
                                </button>
                                <button
                                     onClick={() => {
                                         const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
                                         if(inputEl) {
                                             inputEl.focus();
                                             inputEl.placeholder = "Please describe your changes...";
                                         }
                                     }}
                                    className="px-5 py-2.5 rounded-xl text-xs font-medium bg-[#27272a] text-gray-300 border border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white transition-all"
                                >
                                    Request Changes
                                </button>
                            </div>
                        )}
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

            <div ref={messagesEndRef} className="h-12" />
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
                    placeholder={
                        currentStep === 'idle' ? "请输入视频主题，例如：新品手机宣传片，30秒，科技风格" :
                        currentStep === 'type' ? "请选择或输入视频类型" :
                        currentStep === 'duration' ? "请选择或输入视频时长（秒）" :
                        currentStep === 'styles' ? "请选择或输入视频风格" :
                        currentStep === 'core' ? "请输入产品卖点 or 核心信息" :
                        currentStep === 'key' ? "请输入重点展示元素（多个用逗号分隔）" :
                        currentStep === 'consistency' ? "请输入保持一致性的元素（多个用逗号分隔）" : 
                        currentStep === 'done' ? "请输入您的反馈意见，或直接点击上方确认按钮" : "..."
                    }
                    className="w-full bg-[#18181b] text-white rounded-2xl pl-6 pr-14 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder-gray-500 border border-[#27272a] shadow-inner transition-all relative z-10"
                />
                
                <button
                  type="submit"
                    disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-xl flex items-center justify-center text-black hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all z-20 shadow-lg shadow-purple-900/20"
                >
                    <Send size={18} />
                </button>
              </form>
              <div className="text-center mt-3">
                 <p className="text-[10px] text-gray-600">所有信息需逐项确认后方可完成。</p>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ChatInterface;
