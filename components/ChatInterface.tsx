"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Plus, FileAudio, Image as ImageIcon, Video, LayoutTemplate, ChevronLeft, ChevronRight, Layout, Activity, Clock, RefreshCw, Edit2, Save, X, Check, AlertTriangle } from 'lucide-react';
import { useEditor } from '../contexts/EditorContext';
import { ChatMessage, ChatAttachment, ItemType, Asset, ClipSpec } from '../types';
import { useAgentSSE, useRunClipsSSE } from '../lib/useSSEStream';
import { workflowPlan, workflowKeyframes, workflowConfirm, workflowStitch, uploadFile, storyboardConfirm, sceneUpdate, sceneRegenerate, getBaseUrl, uuidv4, crewRun, crewStatus, getWorkflowStatus } from '../lib/saleagent-client';

interface ChatInterfaceProps {
    isEditorOpen?: boolean;
    onToggleEditor?: () => void;
    activeRunId?: string | null;
    onUpdateActiveRunId?: (runId: string) => void;
    resetKey?: number;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ isEditorOpen = true, onToggleEditor, activeRunId: propRunId, onUpdateActiveRunId, resetKey }) => {
    const { project, setProject, addAsset } = useEditor();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [workflowStep, setWorkflowStep] = useState<'upload_image' | 'refining' | 'planning' | 'generating' | 'completed'>('upload_image');

    // Upload State
    const [uploadedImage, setUploadedImage] = useState<File | null>(null);
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

    // Editing State
    const [editingClip, setEditingClip] = useState<{ msgIdx: number, clipIdx: number } | null>(null);
    const [editContent, setEditContent] = useState('');
    // Track regenerating scenes to prevent multiple clicks
    const [regeneratingScenes, setRegeneratingScenes] = useState<Set<string>>(new Set());

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [threadId, setThreadId] = useState(() => uuidv4());
    const [activeRunId, setActiveRunId] = useState<string | null>(null);

    // Sync propRunId to local state
    useEffect(() => {
        if (propRunId) {
            setActiveRunId(propRunId);
            loadRunHistory(propRunId);
        } else {
            setActiveRunId(null);
        }
    }, [propRunId]);

    // Handle New Project / Reset
    useEffect(() => {
        if (!propRunId) {
            // New project mode
            console.log("[ChatInterface] Resetting for new project");
            setMessages([{ role: 'model', text: '您好，我是您的视频助手。请先上传产品图片，我们将开始视频创作流程。' }]);
            setWorkflowStep('upload_image');
            setUploadedImage(null);
            setUploadedImageUrl(null);
            setEditingClip(null);
            setEditContent('');
            setIsLoading(false);
            setThreadId(uuidv4());
        }
    }, [propRunId, resetKey]);

    const loadRunHistory = async (runId: string) => {
        setIsLoading(true);
        try {
            // 1. Get status to see if it exists and get context
            const status = await getWorkflowStatus(runId);
            if (status.status !== 'not_found') {
                // Determine workflow step based on status
                if (status.status === 'completed') {
                    setWorkflowStep('completed');
                } else if (status.status === 'upload_image') {
                    setWorkflowStep('upload_image');
                } else {
                    setWorkflowStep('generating'); // Default to generating for other states to hide upload box
                }

                // Reconstruct state from status
                const msgs: ChatMessage[] = [];

                // Add initial system msg
                const goal = status.context?.goal || "Untitled Project";
                msgs.push({ role: 'model', text: `已加载历史会话: ${goal}` });

                // [NEW] Display generated clips if available
                if (status.video_tasks && status.video_tasks.length > 0) {
                    // Check if stitching is needed
                    const allSucceeded = status.video_tasks.every(t => t.status === 'succeeded');
                    // Assuming we have basic clip info
                    const clips = status.video_tasks.map((t: any) => ({
                        idx: t.clip_idx,
                        desc: t.prompt,
                        status: t.status,
                        video_url: t.video_url,
                        begin_s: 0, // Placeholder
                        end_s: t.duration || 5
                    }));

                    msgs.push({
                        role: 'model',
                        text: '已生成的视频片段：',
                        videoClips: { clips }, // Pass to ChatMessage component
                        status: 'running' // Or current status
                    });


                }


                // [NEW] Restore Chat History from Context
                const context = status.context || {};

                // Restore uploaded image state and messages if available
                if (context.collected_info?.image_url) {
                    const imgUrl = context.collected_info.image_url;
                    setUploadedImageUrl(imgUrl);
                    setWorkflowStep('refining');

                    // Add User Upload Message
                    msgs.push({
                        role: 'user',
                        text: '已上传产品图片',
                        attachments: [{ type: 'image', url: imgUrl, name: 'uploaded_image.png', mimeType: 'image/png' }]
                    });

                    // Add System Received Message
                    msgs.push({ role: 'model', text: '收到图片。请描述视频主题或文案。' });
                }

                // Restore Theme message (if set by user message)
                if (context.collected_info?.theme) {
                    msgs.push({ role: 'user', text: context.collected_info.theme });
                }

                // 1. Restore Q&A interactions
                if (Array.isArray(context.question_history)) {
                    context.question_history.forEach((item: any) => {
                        // Push model question
                        if (item.question_text) {
                            msgs.push({
                                role: 'model',
                                text: item.question_text,
                                options: item.options // Restore options
                            });
                        }
                        // Push user answer
                        if (item.answer) {
                            msgs.push({ role: 'user', text: item.answer });
                        }
                    });
                }

                // 2. Restore Current (Pending) Question
                if (context.current_question && context.current_question_text) {
                    msgs.push({
                        role: 'model',
                        text: context.current_question_text,
                        options: context.current_options,
                        // If we are waiting for input, this is the last message
                    });
                }

                // Restoring context (goal, etc) is tricky without full history storage.
                // But we can show the result if completed.
                if (status.status === 'completed' && status.result) {
                    msgs.push({
                        role: 'model',
                        text: '视频生成已完成。',
                        status: 'Completed',
                        attachments: [{ type: 'video', url: status.result, name: 'Final Video', mimeType: 'video/mp4' }]
                    });
                } else if (status.status === 'failed') {
                    msgs.push({ role: 'model', text: `任务失败: ${status.error}`, isError: true });
                } else if (status.status === 'ready_to_stitch') {
                    // Special handling for ready_to_stitch: Clean reconstruction of the confirmation state

                    // 1. Get clips (already parsed above in `clips` var or re-parse)
                    let restoredClips = [];
                    if (status.video_tasks && Array.isArray(status.video_tasks)) {
                        restoredClips = status.video_tasks.map((vt: any) => ({
                            idx: vt.clip_idx,
                            desc: vt.prompt,
                            video_url: vt.video_url,
                            begin_s: 0,
                            end_s: vt.duration || 10
                        }));
                    }

                    msgs.push({
                        role: 'model',
                        text: '所有片段生成完毕，等待合并确认...',
                        status: '等待合并确认...',
                        requiresConfirmation: true, // Legacy check
                        runId: runId, // [FIX] Critical for handleConfirmClips
                        videoClips: {
                            clips: restoredClips,
                            requiresConfirmation: true // Actual UI trigger
                        }
                    });
                } else {
                    msgs.push({ role: 'model', text: `当前状态: ${status.status}`, status: status.status });
                }
                setMessages(msgs);
            }
        } catch (e) {
            console.error("Failed to load run", e);
            setMessages([{ role: 'model', text: '加载会话失败。', isError: true }]);
        } finally {
            setIsLoading(false);
        }
    };

    const planningLockRef = useRef<string | null>(null);

    // SaleAgent Hook
    const agent = useAgentSSE();
    const runClips = useRunClipsSSE();

    // Sync SSE results to messages
    useEffect(() => {
        if (runClips.results.length > 0) {
            setMessages(prev => {
                const newMsgs = [...prev];
                // Find the generation message (usually the last one or one with progress)
                let processingMsg = newMsgs.find(m => m.status && m.status.includes('片段'));
                if (!processingMsg) {
                    // Or find last model message
                    for (let i = newMsgs.length - 1; i >= 0; i--) {
                        if (newMsgs[i].role === 'model') {
                            processingMsg = newMsgs[i];
                            break;
                        }
                    }
                }

                if (processingMsg) {
                    // Update clips status based on results
                    if (!processingMsg.clips) processingMsg.clips = [];
                    // ... (rest of logic)
                }
                return newMsgs;
            });
        }
    }, [runClips.results]);



    // Clip Editing State (Removed duplicates)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Polling for Crew Status
    useEffect(() => {
        if (!activeRunId) return;
        // Only poll if the last message is in a "processing" state or we are expecting updates
        // and we are NOT just in a chat loop (unless we need status for video generation)
        // For now, let's poll if we have an active run and we haven't seen "Completed" in the last message

        const lastMsg = messages[messages.length - 1];
        const isRunning = lastMsg && lastMsg.status !== 'Completed' && !lastMsg.requiresConfirmation && !lastMsg.isError;

        if (!isRunning) return;

        let timeoutId: NodeJS.Timeout;
        let isMounted = true;

        const poll = async () => {
            if (!isMounted) return;

            // Check if we should poll
            // We use a ref or simplified check since 'messages' is in dependency, this function is recreated on every render
            // But wait, if we use setTimeout loop, we need to be careful about dependencies.
            // If we rely on 'messages' dependency to restart the loop, then we don't need a loop, we just need a delayed action.
            // A pattern: useEffect triggers "Wait 5s then check".
            // If check updates state -> re-render -> useEffect -> Wait 5s then check.
            // If check DOES NOT update state -> we need to trigger next check.

            // Current code: setInterval.
            // Issues: stacked requests if slow.

            // New approach:
            // Define a function that checks status.
            try {
                const status = await getWorkflowStatus(activeRunId);
                console.log('[Polling] Status:', status);

                setMessages(prev => {
                    const newMsgs = [...prev];
                    const last = newMsgs[newMsgs.length - 1];
                    if (!last) return newMsgs;
                    let changed = false;

                    // Update Progress logic ...
                    // (Same logic as before)
                    if (status.expected_clips && status.expected_clips > 0) {
                        // logic placeholder
                    }

                    if (status.status === 'ready_to_stitch') {
                        if (last.status !== '等待合并确认...' && !last.requiresConfirmation) {
                            last.status = '等待合并确认...';
                            last.requiresConfirmation = true;

                            // Populate video clips from tasks
                            if (status.video_tasks && Array.isArray(status.video_tasks)) {
                                const clips = status.video_tasks.map((vt: any) => ({
                                    idx: vt.clip_idx,
                                    desc: vt.prompt,
                                    video_url: vt.video_url,
                                    begin_s: 0,
                                    end_s: vt.duration || 10
                                }));
                                last.videoClips = {
                                    clips: clips,
                                    requiresConfirmation: true
                                };
                                last.clips = clips; // Sync legacy
                            }
                            changed = true;
                            // Critical: Ensure loading is off so user can click
                            setIsLoading(false);
                        }
                    }

                    if (status.status === 'stitching') {
                        if (last.status !== 'Stitching videos...') {
                            last.status = 'Stitching videos...';
                            last.text = (last.text + '\n[System] All clips generated. Stitching...').trim();
                            // Disable confirmation if accidentally active
                            last.requiresConfirmation = false;
                            changed = true;
                        }
                    }

                    if (status.status === 'completed' && status.result) {
                        if (last.status !== 'Completed') {
                            last.status = 'Completed';
                            last.requiresConfirmation = false;
                            if (status.result.startsWith('http')) {
                                const videoUrl = status.result;
                                if (!last.attachments?.some(a => a.url === videoUrl)) {
                                    const attachment: ChatAttachment = { type: 'video', url: videoUrl, name: 'Final Video', mimeType: 'video/mp4' };
                                    last.attachments = [...(last.attachments || []), attachment];
                                    last.finalVideo = { video_url: videoUrl, run_id: activeRunId };
                                    handleAddAsset(attachment);
                                    changed = true;
                                }
                            }
                        }
                    }
                    // If changed, returning new array triggers re-render -> effect re-runs -> new timeout.
                    // If NOT changed, returning same array (if we managed it) PREVENTS re-render?
                    // React state update algorithm: if value is identical (referentially), no re-render.
                    // But 'newMsgs' is new reference. So it ALWAYS re-renders.
                    // So it acts as recursive loop via render cycle.
                    return changed ? newMsgs : prev;
                });
            } catch (e) {
                console.error('[Polling] Error:', e);
            } finally {
                // Schedule next poll only if we didn't trigger a re-render/unmount
                // Actually, if we triggered re-render (setMessages new ref), this effect cleans up and new one starts.
                // If we returned 'prev', no re-render. So we must verify if effect was torn down.
                if (isMounted) {
                    timeoutId = setTimeout(poll, 5000);
                }
            }
        };

        // Start initial delay
        timeoutId = setTimeout(poll, 5000);

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [activeRunId, messages]);

    const startEditing = (msgIdx: number, clipIdx: number, currentDesc?: string) => {
        const msg = messages[msgIdx];
        let desc = currentDesc;
        if (!desc && msg) {
            const sceneIdx = clipIdx;
            const scene = (msg.storyboard?.scenes || []).find(s => (s.scene_idx ?? s.idx) === sceneIdx);
            const sceneText = scene?.desc || scene?.narration || scene?.script || scene?.prompt || scene?.text;
            const clipsPool = [...(msg.videoClips?.clips || []), ...(msg.clips || [])];
            const relatedClips = clipsPool.filter(c => (c.scene_idx ?? c.idx) === sceneIdx);
            const clipTexts = relatedClips
                .map(c => c.desc || c.narration || c.script || c.prompt || c.text)
                .filter(Boolean);
            desc = sceneText || (clipTexts.length ? clipTexts.join('\n\n') : '');
        }
        setEditingClip({ msgIdx, clipIdx });
        setEditContent(desc || '');
        setUploadedImage(null);
        setUploadedImageUrl(null);
    };

    const cancelEditing = () => {
        setEditingClip(null);
        setEditContent('');
        setUploadedImage(null);
        setUploadedImageUrl(null);
    };

    const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            console.error("Please upload an image file");
            return;
        }

        // setUploadedImage(file); // Optimistic?

        setIsLoading(true);
        try {
            const publicUrl = await uploadFile(file);
            setUploadedImageUrl(publicUrl);
            setUploadedImage(file);

            // If we are in the initial upload step, verify and move to next step
            if (workflowStep === 'upload_image') {
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'user',
                        text: '已上传产品图片',
                        attachments: [{ type: 'image', url: publicUrl, name: file.name, mimeType: file.type }]
                    },
                    { role: 'model', text: '收到图片。请描述视频主题或文案。' }
                ]);
                setWorkflowStep('refining');
            }
        } catch (error) {
            console.error("Upload failed", error);
            setMessages(prev => [...prev, { role: 'model', text: '图片上传失败，请重试。', isError: true }]);
        } finally {
            setIsLoading(false);
        }
    };

    const saveEditing = async (msgIdx: number, clipIdx: number) => {
        if (!editContent.trim()) return;
        const aggregatedScript = editContent;
        setIsLoading(true);
        try {
            const targetMsg = messages[msgIdx];
            const runId = targetMsg?.runId || activeRunId || threadId;
            const result = await sceneUpdate({
                run_id: runId,
                scene_idx: clipIdx,
                script: aggregatedScript
            });

            setMessages(prev => {
                const newMsgs = [...prev];
                if (newMsgs[msgIdx]) {
                    const scene = newMsgs[msgIdx].storyboard?.scenes?.find(s => (s.scene_idx ?? s.idx) === clipIdx);
                    if (scene) scene.desc = aggregatedScript;
                }
                // If backend returns updated clips/scene list, merge
                if (result?.clips && Array.isArray(result.clips)) {
                    newMsgs[msgIdx].clips = result.clips;
                } else if (result?.scene) {
                    const s = result.scene;
                    const sceneEntity = newMsgs[msgIdx].storyboard?.scenes?.find(x => (x.scene_idx ?? x.idx) === (s.scene_idx ?? s.idx));
                    if (sceneEntity) {
                        sceneEntity.desc = s.desc || aggregatedScript;
                    }
                }
                return newMsgs;
            });
            setEditingClip(null);
            setUploadedImage(null);
            setUploadedImageUrl(null);
        } catch (error) {
            console.error("Update failed", error);
        } finally {
            setIsLoading(false);
        }
    };

    const refreshClipImage = (msgIdx: number, clipIdx: number) => {
        setMessages(prev => {
            const newMsgs = [...prev];
            const msg = newMsgs[msgIdx];
            if (!msg) return newMsgs;

            const updateClip = (c: any) => {
                const kf = { ...(c.keyframes || {}) };
                if (kf.in) {
                    // Remove existing timestamp if any
                    const baseUrl = kf.in.split('?')[0];
                    kf.in = `${baseUrl}?t=${Date.now()}`;
                }
                return { ...c, keyframes: kf };
            };

            // Update in videoClips
            if (msg.videoClips?.clips) {
                const i = msg.videoClips.clips.findIndex(c => (c.idx) === clipIdx || c.scene_idx === clipIdx);
                if (i !== -1) {
                    msg.videoClips.clips[i] = updateClip(msg.videoClips.clips[i]);
                }
            }

            // Update in clips/storyboard
            if (msg.clips) {
                const i = msg.clips.findIndex(c => c.idx === clipIdx);
                if (i !== -1) {
                    msg.clips[i] = updateClip(msg.clips[i]);
                }
            }

            if (msg.storyboard?.scenes) {
                const i = msg.storyboard.scenes.findIndex(s => (s.scene_idx ?? s.idx) === clipIdx);
                if (i !== -1) {
                    msg.storyboard.scenes[i] = updateClip(msg.storyboard.scenes[i]);
                }
            }

            return newMsgs;
        });
    };

    const regenerateClipImage = async (msgIdx: number, clipIdx: number) => {
        const key = `${msgIdx}-${clipIdx}`;
        if (regeneratingScenes.has(key)) return;

        setRegeneratingScenes(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });

        const targetMsg = messages[msgIdx];
        const runId = targetMsg?.runId || activeRunId || threadId;
        setIsLoading(true);
        try {
            const result = await sceneRegenerate({
                run_id: runId,
                scene_idx: clipIdx,
                type: 'image'
            });
            setMessages(prev => {
                const newMsgs = [...prev];
                const msg = newMsgs[msgIdx];
                if (!msg) return newMsgs;

                // Helper to update clip with new image result
                const updateClipParams = (c: any, newInfo: any) => {
                    const kf = { ...(c.keyframes || {}) };
                    // Use new image url (add timestamp to force reload)
                    const imgUrl = newInfo.image_url || newInfo.image || newInfo.keyframes?.in;
                    if (imgUrl) {
                        kf.in = `${imgUrl}?t=${Date.now()}`;
                    }
                    return { ...c, keyframes: kf };
                };

                // Prefer full clips array if provided
                if (result?.clips && Array.isArray(result.clips)) {
                    msg.clips = result.clips;
                    // Also update storyboard scenes if they exist
                    if (msg.storyboard?.scenes) {
                        // Sync logic (simplified)
                        // msg.storyboard.scenes = msg.clips.map(...) 
                        // But we might lose other props. Best to patch.
                    }
                } else if (result?.scene) {
                    const s = result.scene;

                    // Update in clips
                    const idxToUpdate = msg.clips?.findIndex(c => c.idx === (s.idx || s.scene_idx)) ?? -1;
                    if (idxToUpdate !== -1) {
                        msg.clips![idxToUpdate] = updateClipParams(msg.clips![idxToUpdate], s);
                    }

                    // Update in storyboard scenes
                    const sceneIdx = msg.storyboard?.scenes?.findIndex(sc => (sc.scene_idx ?? sc.idx) === (s.idx || s.scene_idx)) ?? -1;
                    if (sceneIdx !== -1 && msg.storyboard?.scenes) {
                        msg.storyboard.scenes[sceneIdx] = updateClipParams(msg.storyboard.scenes[sceneIdx], s);
                    }
                } else if (result?.image_url) {
                    // Update in clips
                    const idxToUpdate = msg.clips?.findIndex(c => c.idx === clipIdx) ?? -1;
                    if (idxToUpdate !== -1) {
                        msg.clips![idxToUpdate] = updateClipParams(msg.clips![idxToUpdate], { image_url: result.image_url });
                    }
                    // Update in storyboard scenes
                    const sceneIdx = msg.storyboard?.scenes?.findIndex(sc => (sc.scene_idx ?? sc.idx) === clipIdx) ?? -1;
                    if (sceneIdx !== -1 && msg.storyboard?.scenes) {
                        msg.storyboard.scenes[sceneIdx] = updateClipParams(msg.storyboard.scenes[sceneIdx], { image_url: result.image_url });
                    }
                }
                return newMsgs;
            });
        } catch (error) {
            console.error("Regenerate failed", error);
        } finally {
            setIsLoading(false);
            setRegeneratingScenes(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    };

    const regenerateClipVideo = async (msgIdx: number, clipIdx: number) => {
        const key = `${msgIdx}-${clipIdx}-video`;
        if (regeneratingScenes.has(key)) return;

        setRegeneratingScenes(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });

        const targetMsg = messages[msgIdx];
        const runId = targetMsg?.runId || activeRunId || threadId;
        setIsLoading(true);
        try {
            const result = await sceneRegenerate({
                run_id: runId,
                scene_idx: clipIdx,
                type: 'video'
            });
            setMessages(prev => {
                const newMsgs = [...prev];
                const msg = newMsgs[msgIdx];
                if (!msg) return newMsgs;
                if (msg.videoClips?.clips) {
                    const i = msg.videoClips.clips.findIndex(c => (c.idx) === clipIdx || c.scene_idx === clipIdx);
                    if (i !== -1) {
                        msg.videoClips.clips[i] = { ...msg.videoClips.clips[i], video_url: result?.video_url || msg.videoClips.clips[i].video_url };
                    }
                }
                return newMsgs;
            });
        } catch (error) {
            console.error("Regenerate video failed", error);
        } finally {
            setIsLoading(false);
            setRegeneratingScenes(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    };

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

        // If we are in confirmation mode, clear the previous confirmation requirement
        // If we are in 'upload' step and user tries to type text without uploading
        if (workflowStep === 'upload_image' && !uploadedImageUrl) {
            setMessages(prev => [...prev,
            { role: 'user', text: userMsg },
            { role: 'model', text: '请先上传产品图片。' }
            ]);
            return;
        }

        setMessages(prev => {
            const newMessages = [...prev];
            const confirmMsg = newMessages.find(m => m.requiresConfirmation);
            if (confirmMsg) {
                confirmMsg.requiresConfirmation = false;
                confirmMsg.status = 'Modification Requested';
                confirmMsg.options = undefined; // Clear options
            }
            return [...newMessages, { role: 'user', text: userMsg }];
        });

        // Start or continue CrewAI Run
        startCrewRun(userMsg, uploadedImageUrl || undefined);
        if (workflowStep === 'refining') {
            setWorkflowStep('generating');
        }
    };

    const handleOptionClick = (option: string) => {
        if (isLoading) return;

        // Handle special confirmation options
        if (option === 'Confirm Plan' || option === '接受并继续') {
            handleConfirm();
            return;
        }

        // Simulate user input for standard flow
        const userMsg = option;

        // If we are in confirmation mode (e.g. "Modify Script"), clear the confirm button
        setMessages(prev => {
            const newMessages = [...prev];
            const confirmMsg = newMessages.find(m => m.requiresConfirmation);
            if (confirmMsg) {
                confirmMsg.requiresConfirmation = false;
                confirmMsg.status = 'Modification Requested';
                confirmMsg.options = undefined;
            }
            return [...newMessages, { role: 'user', text: userMsg }];
        });

        startCrewRun(userMsg);
    };

    const startCrewRun = (promptText: string, imgUrl?: string) => {
        // Determine if we are continuing an existing run or starting a new one
        // We use the activeRunId captured from backend events (like 'question')
        const isContinuation = !!activeRunId;
        const currentRunId = isContinuation ? activeRunId! : uuidv4();
        const action = isContinuation ? 'message' : 'start';

        console.log(`[startCrewRun] Initiating ${action} with prompt:`, promptText, "runId:", currentRunId, "img:", !!imgUrl);

        setMessages(prev => [...prev, {
            role: 'model',
            text: '',
            status: isContinuation ? '处理中...' : '正在启动智能体...',
            progress: 0,
            runId: currentRunId,
            agentOutputs: []
        }]);
        setIsLoading(true);

        // No longer using legacy brief logic, just passing text directly
        const finalPrompt = promptText;

        // Use streamChatResponse to align with video-chat.tsx flow (supports confirmation steps)
        console.log("[startCrewRun] Starting chat stream with thread:", threadId, "runId:", currentRunId, "action:", action);
        agent.start(
            {
                action: action, // 'start' or 'message'
                message: finalPrompt,
                thread_id: threadId,
                run_id: currentRunId,
                img: imgUrl
            },
            (event) => {
                console.log('[startCrewRun] Event received:', event.type, event);

                // Capture active run ID from events to ensure we reply to the correct run
                if (event.run_id) {
                    const newRunId = event.run_id;
                    setActiveRunId(newRunId);
                    if (onUpdateActiveRunId && newRunId !== propRunId) {
                        onUpdateActiveRunId(newRunId);
                    }
                } else if (event.payload?.run_id) {
                    const newRunId = event.payload.run_id;
                    setActiveRunId(newRunId);
                    if (onUpdateActiveRunId && newRunId !== propRunId) {
                        onUpdateActiveRunId(newRunId);
                    }
                }

                if (event.type === 'error') {
                    console.error("[startCrewRun] Stream error", event.content);
                    setMessages(prev => [...prev, { role: 'model', text: `Error: ${event.content}`, isError: true }]);
                    setIsLoading(false);
                    return;
                }

                setMessages(prev => {
                    const newMessages = [...prev];
                    const normalizeAgent = (name?: string) => {
                        const n = (name || 'System').trim();
                        if (n === '审核' || n.toLowerCase() === 'review') return '制片';
                        if (n === '制片' || n.toLowerCase() === 'producer') return '制片';
                        return n;
                    };
                    const incomingAgent = normalizeAgent(event.agent || 'System');
                    let idx = newMessages.length - 1;
                    while (idx >= 0 && newMessages[idx].role !== 'model') idx--;
                    if (idx < 0) {
                        const newModel: any = {
                            role: 'model',
                            text: '',
                            status: '处理中...',
                            progress: 0,
                            runId: event.run_id || activeRunId || currentRunId,
                            agentOutputs: [],
                            agent: incomingAgent,
                        };
                        newMessages.push(newModel);
                        idx = newMessages.length - 1;
                    } else if (newMessages[idx].agent && normalizeAgent(newMessages[idx].agent) !== incomingAgent) {
                        const newModel: any = {
                            role: 'model',
                            text: '',
                            status: '处理中...',
                            progress: 0,
                            runId: event.run_id || newMessages[idx].runId || activeRunId || currentRunId,
                            agentOutputs: [],
                            agent: incomingAgent,
                        };
                        newMessages.push(newModel);
                        idx = newMessages.length - 1;
                    }
                    const lastMsg = newMessages[idx];
                    lastMsg.lastEventType = event.type as any;
                    if (!lastMsg.agent) lastMsg.agent = incomingAgent;

                    // Handle Question
                    if (event.type === 'question') {
                        if (event.delta) {
                            // Only append if it's not a duplicate (simple check)
                            if (!lastMsg.text?.endsWith(event.delta)) {
                                lastMsg.text = (lastMsg.text || '') + event.delta;
                            }
                        }
                        if (event.payload?.options) {
                            lastMsg.options = event.payload.options;
                        }
                        lastMsg.status = '等待回答...';
                        setIsLoading(false);
                    }

                    // Handle Agent Outputs (Thought, Tool, etc.)
                    if (['thought', 'tool_result', 'progress', 'heartbeat', 'info', 'video_clip_completed'].includes(event.type)) {
                        let progressData = undefined;
                        const rawProgress = event.progress as any;
                        if (typeof rawProgress === 'number') {
                            progressData = { current: rawProgress, total: 100 };
                        } else if (typeof rawProgress === 'object' && rawProgress !== null) {
                            progressData = rawProgress;
                        }

                        const output: any = {
                            agent: event.agent || 'System',
                            type: event.type,
                            delta: event.delta || '',
                            timestamp: Date.now(),
                            progress: progressData
                        };

                        // Deduplicate heartbeats
                        if (event.type === 'heartbeat') {
                            const outputs = lastMsg.agentOutputs || [];
                            const lastOutput = outputs[outputs.length - 1];
                            if (lastOutput?.type === 'heartbeat') {
                                outputs[outputs.length - 1] = output;
                            } else {
                                outputs.push(output);
                            }
                            lastMsg.agentOutputs = [...outputs];

                            // Update status and progress from heartbeat
                            if (event.delta) {
                                lastMsg.status = event.delta;
                            } else {
                                lastMsg.status = '正在处理中...';
                            }

                            if (progressData) {
                                const percent = Math.max(0, Math.min(100, Math.round(((progressData.current || 0) / (progressData.total || 100)) * 100)));
                                lastMsg.progress = percent;
                            }
                        } else {
                            if (event.type !== 'info' && event.type !== 'thought') {
                                lastMsg.agentOutputs = [...(lastMsg.agentOutputs || []), output];
                            }
                        }

                        if (event.type === 'thought') {
                            const d = event.delta || '';
                            if (d && lastMsg.lastDeltaChunk !== d) {
                                lastMsg.text = d;
                                lastMsg.lastDeltaChunk = d;
                            }
                            lastMsg.status = undefined;
                        }

                        if (event.type === 'progress') {
                            if (progressData) {
                                const percent = Math.max(0, Math.min(100, Math.round(((progressData.current || 0) / (progressData.total || 100)) * 100)));
                                output.progress = { current: percent, total: 100 };
                                lastMsg.status = event.delta || `生成进度：${progressData.current}/${progressData.total}`;
                                lastMsg.progress = percent;
                            } else if (event.delta) {
                                lastMsg.status = event.delta;
                            }
                        }
                    }

                    // Handle Collected Info (End of Phase 1)
                    if (event.type === 'collected') {
                        // Prevent duplicate planning calls
                        const runId = event.run_id || activeRunId;
                        if (planningLockRef.current === runId) return newMessages;
                        if (runId) planningLockRef.current = runId;

                        setIsLoading(true);
                        newMessages.push({
                            role: 'model',
                            text: '信息收集完成，正在制定分镜方案...',
                            status: '规划中...',
                            runId: runId
                        });

                        // Call Plan API
                        const info = event.payload || {};

                        // Default image_control to true if we want to see scene images (or based on some logic)
                        // Requirement: "generate scene images during planning"
                        const imageControl = true;

                        workflowPlan(
                            info.theme || "Video",
                            info.duration || 10.0,
                            info.styles || [],
                            imageControl,
                            0, // num_clips (auto)
                            runId,
                            info.image_url
                        ).then(res => {

                            if (res.storyboards) {
                                setMessages(prev => {
                                    const next = [...prev];
                                    const last = next[next.length - 1];
                                    last.text = '分镜方案已生成，请确认：';
                                    last.status = undefined;
                                    last.storyboard = {
                                        scenes: res.storyboards.map((s: any) => ({
                                            ...s,
                                            // Backend merge_storyboards_to_video_tasks_impl expects nested 'clips' list
                                            // to extract descriptions and keyframes correctly.
                                            // Since we have a flat list, we treat each scene as containing itself as a clip.
                                            clips: [s],
                                            // Ensure scene_idx is present if backend needs it (though it uses idx usually)
                                            scene_idx: s.idx
                                        })),
                                        requiresConfirmation: true,
                                        runId: runId
                                    };
                                    last.requiresConfirmation = true;
                                    // Make sure we set clips for tracking
                                    last.clips = res.storyboards.map((s: any) => ({
                                        idx: s.idx,
                                        desc: s.desc,
                                        begin_s: s.begin_s,
                                        end_s: s.end_s,
                                        keyframes: s.keyframes,
                                        video_url: undefined
                                    }));
                                    return next;
                                });
                            }
                            setIsLoading(false);
                            // Set runId for next phase
                            if (runId) setActiveRunId(runId);
                        }).catch(err => {
                            console.error("Plan failed", err);
                            setMessages(prev => [...prev, { role: 'model', text: `规划失败: ${err.message}`, isError: true }]);
                            setIsLoading(false);
                        });
                    }
                    if (event.type === 'tool_result') {
                        lastMsg.status = `收到工具输出`;

                        // Legacy/Fallback: Check for scenes in tool_result if storyboard_pending misses
                        if (event.payload?.scenes && Array.isArray(event.payload.scenes)) {
                            const scenes = event.payload.scenes.map((s: any) => ({
                                idx: s.idx || s.scene_idx,
                                desc: s.desc || s.narration,
                                begin_s: s.begin_s,
                                end_s: s.end_s,
                                keyframes: s.keyframes,
                                video_url: s.video_url
                            }));

                            if (!lastMsg.storyboard) {
                                lastMsg.storyboard = {
                                    scenes: scenes,
                                    requiresConfirmation: true,
                                    runId: event.payload?.run_id || lastMsg.runId
                                };
                                // Sync legacy clips
                                lastMsg.clips = scenes;
                                lastMsg.status = '等待故事板确认...';
                                lastMsg.requiresConfirmation = true;
                                setIsLoading(false);
                            }
                        }
                    }



                    if (event.type === 'delta' && event.delta) {
                        const d = event.delta;
                        if (lastMsg.lastDeltaChunk !== d) {
                            lastMsg.text = (lastMsg.text || '') + d;
                            lastMsg.lastDeltaChunk = d;
                        }
                        if (lastMsg.status === '正在启动智能体...') lastMsg.status = undefined;
                    }

                    if (event.type === 'info' && event.delta) {
                        const newDelta = (event.delta || '').trim();
                        const currentText = (lastMsg.text || '').trim();
                        if (!currentText.endsWith(newDelta)) {
                            lastMsg.text = (lastMsg.text ? (lastMsg.text + '\n') : '') + event.delta;
                        }
                        lastMsg.status = '处理中...';
                    }

                    if (event.type === 'error') {
                        // Append error message as a separate error bubble or update current status
                        // For visibility, we add a new error message if the last one isn't already an error
                        if (!lastMsg.isError) {
                            return [...prev, {
                                role: 'model',
                                text: `❌ 错误: ${event.delta || event.payload || 'Unknown Error'}`,
                                isError: true,
                                runId: lastMsg.runId || event.run_id
                            }];
                        } else {
                            // Update existing error message
                            lastMsg.text = (lastMsg.text || '') + '\n' + (event.delta || event.payload);
                        }
                        return [...prev]; // Return prev to trigger re-render with updated lastMsg (if mutated) 
                        // Actually setMessages expects new array. 
                        // If we mutated lastMsg in 'next', we return 'next'.
                        // But here we are inside setMessages((prev) => ...).

                        // Wait, looking at existing code:
                        // setMessages(prev => {
                        //    const next = [...prev];
                        //    const lastMsg = next[next.length - 1];
                        //    ...
                        //    return next;
                        // })
                        // I need to insert this logic inside the `processEvent` or where `event` is processed.
                        // The snippet I viewed handles `setMessages` updates.
                        // The context is `useSSEStream` callback? No.
                        // Wait, I need to see where `event` comes from.
                        // Lines 646 starts `if (event.type === 'tool_result')`.
                        // This block is inside `onMessage: (event) => { setMessages(prev => { ... }) }`.
                    }

                    // Handle Storyboard Pending
                    if (event.type === 'storyboard_pending') {
                        // Try to find scenes array in various locations:
                        // 1. event.payload.storyboard.scenes (Correct structure per log)
                        // 2. event.payload.storyboard (Legacy array)
                        // 3. event.payload.scenes (Alternative)
                        let rawScenes = event.payload?.storyboard?.scenes || event.payload?.storyboard || event.payload?.scenes;

                        // If storyboard is an object but not an array, and has no scenes property, check if it IS the scenes wrapper?
                        // The log shows payload.storyboard = { scenes: [...] }
                        // So event.payload?.storyboard?.scenes should catch it.

                        if (rawScenes && Array.isArray(rawScenes)) {
                            const scenes = rawScenes.map((s: any) => {
                                const rawPreview = s?.keyframes?.in || s?.image_url || s?.preview_url || s?.cover_url || s?.thumbnail_url || s?.image;
                                const preview = typeof rawPreview === 'string' ? rawPreview.replace(/`/g, '').trim() : rawPreview;
                                const kf = s.keyframes || {};
                                if (preview && !kf.in) kf.in = preview;
                                const sceneIdx = s.scene_idx ?? s.idx;
                                const clips = (s.clips || []).map((c: any) => ({
                                    idx: c.idx,
                                    scene_idx: sceneIdx,
                                    desc: c.desc || c.narration || c.script || c.prompt || c.text,
                                    begin_s: c.begin_s,
                                    end_s: c.end_s,
                                }));
                                const sceneDesc = clips.map((c: any) => c.desc).filter(Boolean).join('\n\n');
                                return {
                                    idx: sceneIdx,
                                    desc: sceneDesc || s.desc || s.narration || s.script || s.prompt || s.text,
                                    begin_s: s.begin_s,
                                    end_s: s.end_s,
                                    keyframes: kf,
                                    video_url: s.video_url,
                                    clips,
                                };
                            });

                            lastMsg.storyboard = {
                                scenes: scenes,
                                requiresConfirmation: true,
                                runId: event.payload?.run_id || lastMsg.runId
                            };
                            lastMsg.requiresConfirmation = true;
                            lastMsg.status = '等待故事板确认...';

                            // Do not overwrite clips here; keep scenes for storyboard-only display

                            // Handle global image fallback
                            const globalImageUrl = event.payload?.image_url || event.payload?.storyboard?.image_url || event.payload?.cover_url || event.payload?.thumbnail_url;
                            if (globalImageUrl) {
                                const imgUrl = typeof globalImageUrl === 'string' ? (globalImageUrl as string).replace(/`/g, '').trim() : (globalImageUrl as string);
                                const attachment: ChatAttachment = { type: 'image', url: imgUrl, name: 'Preview', mimeType: 'image/png' };
                                if (!lastMsg.attachments?.some(a => a.url === imgUrl)) {
                                    lastMsg.attachments = [...(lastMsg.attachments || []), attachment];
                                    handleAddAsset(attachment);
                                }
                                // Backfill keyframes
                                scenes.forEach(c => {
                                    if (!c.keyframes) c.keyframes = {};
                                    if (!c.keyframes.in) c.keyframes.in = imgUrl;
                                });
                            }

                            // Keep clips untouched; video clips will be set by video_clips_pending

                            if (event.payload?.requires_confirmation !== undefined) {
                                lastMsg.requiresConfirmation = !!event.payload.requires_confirmation;
                            }
                        } else {
                            console.warn('[ChatInterface] storyboard_pending received but could not find scenes array in payload:', event.payload);
                        }
                        setIsLoading(false);
                    }

                    // Handle Video Clips Pending
                    if (event.type === 'video_clips_pending') {
                        const rawClips = event.payload?.clips;
                        if (rawClips && Array.isArray(rawClips)) {
                            const clips = rawClips.map((vc: any) => {
                                const preview = vc?.keyframes?.in || vc?.image_url || vc?.thumbnail_url || vc?.cover_url || vc?.image;
                                const kf = vc.keyframes || {};
                                if (preview && !kf.in) kf.in = preview;
                                return {
                                    idx: vc.idx || vc.scene_idx,
                                    desc: vc.desc || vc.narration || vc.script || vc.prompt || vc.text,
                                    begin_s: vc.begin_s,
                                    end_s: vc.end_s,
                                    video_url: vc.video_url,
                                    keyframes: kf
                                };
                            });

                            lastMsg.videoClips = {
                                clips: clips,
                                requiresConfirmation: true
                            };
                            lastMsg.requiresConfirmation = true;
                            lastMsg.status = '所有片段已生成，等待确认...';

                            // Sync legacy clips
                            lastMsg.clips = clips;
                        }
                        setIsLoading(false);
                    }

                    // Handle Video Clip Completed
                    if (event.type === 'video_clip_completed') {
                        const completedClip = event.payload?.clip;
                        if (completedClip) {
                            // Update videoClips
                            if (lastMsg.videoClips) {
                                const idx = lastMsg.videoClips.clips.findIndex(c => c.idx === (completedClip.idx || completedClip.scene_idx));
                                if (idx !== -1) {
                                    lastMsg.videoClips.clips[idx] = {
                                        ...lastMsg.videoClips.clips[idx],
                                        video_url: completedClip.video_url
                                    };
                                    // Sync legacy
                                    if (lastMsg.clips) lastMsg.clips[idx] = lastMsg.videoClips.clips[idx];
                                }
                            } else if (lastMsg.clips) {
                                const idx = lastMsg.clips.findIndex(c => c.idx === (completedClip.idx || completedClip.scene_idx));
                                if (idx !== -1) {
                                    lastMsg.clips[idx] = { ...lastMsg.clips[idx], video_url: completedClip.video_url };
                                }
                            }
                        }
                    }

                    if (event.type === 'run_finished') {
                        if (event.payload?.video_url) {
                            lastMsg.finalVideo = {
                                video_url: event.payload.video_url as string,
                                run_id: event.payload.run_id
                            };
                            lastMsg.status = 'Completed';

                            const attachment: ChatAttachment = { type: 'video', url: event.payload.video_url as string, name: 'Final Video', mimeType: 'video/mp4' };
                            lastMsg.attachments = [attachment];
                            handleAddAsset(attachment);
                        } else if (event.payload?.code === 'confirmation_required' || event.code === 'confirmation_required') {
                            lastMsg.status = '等待确认...';
                            lastMsg.requiresConfirmation = true;
                            setIsLoading(false);
                        } else {
                            lastMsg.status = 'Completed';
                        }

                        if (lastMsg.status === 'Completed') {
                            setIsLoading(false);
                        }
                    }

                    if (event.code === 'confirmation_required') {
                        lastMsg.status = '等待确认...';
                        lastMsg.requiresConfirmation = true;
                        setIsLoading(false);
                    }

                    return newMessages;
                });
            }
        ).then(() => {
            // On complete (stream closed)
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (!last.requiresConfirmation && last.status !== 'Completed') {
                    // Maybe update status to completed if not already?
                }
                return prev;
            });
        });
    };

    const handleConfirm = async () => {
        // Find the message requiring confirmation
        const outputMsg = messages.find(m => m.storyboard?.requiresConfirmation);
        if (!outputMsg || !outputMsg.storyboard) return;

        console.log('Confirming storyboard:', outputMsg.storyboard);
        const currentRunId = outputMsg.storyboard.runId || activeRunId;

        // Update UI to show processing
        setMessages(prev => prev.map(m => {
            if (m === outputMsg) {
                return {
                    ...m,
                    storyboard: { ...m.storyboard!, requiresConfirmation: false }, // Hide confirm button
                    status: '正在提交生成任务...',
                    progress: 0
                };
            }
            return m;
        }));

        try {
            // Call Confirm API
            // Note: outputMsg.storyboard.scenes has the latest data (edited by user)
            const res = await workflowConfirm({
                run_id: currentRunId!,
                storyboard: { scenes: outputMsg.storyboard.scenes }
            });
            console.log('Confirmed, run_id:', res.run_id);

            // Connect to SSE for progress
            setMessages(prev => [...prev, {
                role: 'model',
                text: '智能体正在通过 RunningHub 生成视频素材，请耐心等待...',
                status: 'Initializing...'
            }]);
            runClips.start(res.run_id, outputMsg.storyboard.scenes);

        } catch (error: any) {
            console.error('Error confirming storyboard:', error);
            setMessages(prev => prev.map(m => m === outputMsg ? {
                ...m,
                status: `Error: ${error.message}`,
                isError: true,
                // [FIX] Re-enable confirm button to allow retry
                storyboard: { ...m.storyboard!, requiresConfirmation: true }
            } : m));
        }
    };

    const handleRegenerateScene = async () => {
        const userText = "Please regenerate the scenes.";
        const confirmMsgIdx = messages.findIndex(m => m.requiresConfirmation);

        let runId = threadId;
        if (confirmMsgIdx !== -1) {
            runId = messages[confirmMsgIdx].runId || threadId;
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[confirmMsgIdx].requiresConfirmation = false;
                newMessages[confirmMsgIdx].status = 'Regeneration Requested';
                return [...newMessages, { role: 'user', text: userText }];
            });
        } else {
            setMessages(prev => [...prev, { role: 'user', text: userText }]);
        }

        setIsLoading(true);
        try {
            // Use confirmStoryboard with false to reject and trigger regeneration logic in agent
            await storyboardConfirm({ run_id: runId, confirmed: false, feedback: "User requested regeneration" });

            // Explicitly restart/continue the conversation to handle the regeneration request
            startCrewRun(userText);
        } catch (error) {
            console.error("Regeneration request failed", error);
            // Fallback to normal chat if confirm endpoint fails or isn't the right path for this
            startCrewRun(userText);
        } finally {
            // isLoading will be managed by startCrewRun inside its execution or we leave it true if startCrewRun sets it?
            // startCrewRun sets isLoading(true). 
            // If we set false here, we might flicker. 
            // But startCrewRun is async? lines 893 says it returns promise?
            // Actually startCrewRun definition (not shown) likely sets isLoading(true).
            // Let's remove isLoading(false) from finally if we are calling startCrewRun which continues the flow.
            // But if startCrewRun fails synchronously...
            // Let's keep safe:
            // If startCrewRun is called, it handles loading.
            // We should only set false if we crashed.
        }
    };

    const handleConfirmClips = async () => {
        const confirmMsgIdx = messages.findIndex(m => m.requiresConfirmation);
        if (confirmMsgIdx === -1) return;

        const confirmMsg = messages[confirmMsgIdx];
        const runId = confirmMsg.runId;

        if (!runId) {
            console.error("No runId found for stitching");
            return;
        }

        // Update UI
        setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[confirmMsgIdx].requiresConfirmation = false;
            newMsgs[confirmMsgIdx].status = 'Stitching videos...';
            return [...newMsgs, { role: 'user', text: '已确认所有视频片段，开始拼接最终视频...' }];
        });

        setIsLoading(true);
        try {
            const clips = confirmMsg.videoClips?.clips || confirmMsg.clips || [];
            const segments = clips.map(c => c.video_url).filter(Boolean) as string[];
            const result = await workflowStitch(runId, segments); // Use new confirmVideoClips endpoint

            setMessages(prev => {
                const newMsgs = [...prev];
                const finalMsg: ChatMessage = {
                    role: 'model',
                    text: '最终视频合成完成',
                    status: 'Completed',
                    attachments: [{
                        type: 'video',
                        url: result.final_url,
                        name: 'Final Video',
                        mimeType: 'video/mp4'
                    }]
                };
                return [...newMsgs, finalMsg];
            });

            handleAddAsset({
                type: 'video',
                url: result.final_url,
                name: 'Final Video',
                mimeType: 'video/mp4'
            });

        } catch (error) {
            console.error("Stitching failed", error);
            setMessages(prev => {
                const newMsgs = [...prev];
                // [FIX] Re-enable confirm button to allow retry
                newMsgs[confirmMsgIdx].requiresConfirmation = true;
                newMsgs[confirmMsgIdx].status = 'Stitching failed. Please try again.';
                newMsgs[confirmMsgIdx].isError = true;
                return [...newMsgs, { role: 'model', text: 'Error encountered. Please retry confirmation.', isError: true }];
            });
        } finally {
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
            ${isEditorOpen ? 'max-w-full' : 'max-w-6xl pt-12'}
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
                                {msg.role === 'model' && msg.agent && (
                                    <div className="text-[10px] text-gray-300 font-semibold px-1">
                                        {`${msg.agent}${(msg.lastEventType === 'thought') ? '（思考中...）' : ''}`}
                                    </div>
                                )}
                                {msg.status && !(msg.agentOutputs?.[msg.agentOutputs.length - 1]?.type === 'thought') && (
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono animate-pulse px-1">
                                        <Activity size={10} />
                                        <span>{msg.status}</span>
                                        {msg.progress !== undefined && msg.progress > 0 && msg.progress < 100 && (
                                            <span className="text-purple-400">({msg.progress}%)</span>
                                        )}
                                    </div>
                                )}

                                {/* Storyboard Scenes Grid Display */}
                                {msg.storyboard?.scenes && msg.storyboard.scenes.length > 0 && (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 w-full animate-in fade-in slide-in-from-bottom-4">
                                            {msg.storyboard.scenes.map((scene, sceneIdx) => {
                                                const isVideoMode = !!scene.video_url;

                                                return (
                                                    <div key={sceneIdx} className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden flex flex-col shadow-lg hover:border-purple-500/30 transition-colors">
                                                        {/* Media Area */}
                                                        <div className="aspect-video bg-black/50 relative group">
                                                            {typeof msg.progress === 'number' && msg.progress > 0 && msg.progress < 100 && (
                                                                <div className="absolute top-0 left-0 right-0">
                                                                    <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                                                                        <div className="bg-purple-500 h-1" style={{ width: `${msg.progress}%` }} />
                                                                    </div>
                                                                    <div className="absolute top-1 left-2 text-[10px] text-gray-300 bg-black/60 px-1 rounded">{msg.progress}%</div>
                                                                </div>
                                                            )}
                                                            {isVideoMode ? (
                                                                <video
                                                                    src={scene.video_url}
                                                                    controls
                                                                    className="w-full h-full object-contain"
                                                                    preload="metadata"
                                                                />
                                                            ) : (
                                                                <>
                                                                    {scene.keyframes?.in ? (
                                                                        <img src={scene.keyframes.in} alt={`Scene ${scene.idx}`} className="w-full h-full object-contain" />
                                                                    ) : msg.attachments?.find(a => a.type === 'image') ? (
                                                                        // Fallback to general scene image if specific clip image not found but message has one
                                                                        <img src={msg.attachments?.find(a => a.type === 'image')?.url} alt={`Scene ${scene.idx}`} className="w-full h-full object-contain" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black relative group">
                                                                            {scene.error ? (
                                                                                <div className="flex flex-col items-center justify-center p-2 text-center text-red-500 gap-1 w-full h-full">
                                                                                    <AlertTriangle className="text-red-500 w-8 h-8 opacity-80" />
                                                                                    <span className="text-[10px] leading-tight break-words px-2 font-medium opacity-90 line-clamp-3" title={scene.error}>
                                                                                        {scene.error}
                                                                                    </span>
                                                                                </div>
                                                                            ) : (
                                                                                <ImageIcon className="text-gray-700 w-8 h-8" />
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Hover Controls for Image Mode */}
                                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                                        <button
                                                                            onClick={() => refreshClipImage(idx, scene.idx)}
                                                                            className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-purple-600 transition-colors backdrop-blur-sm"
                                                                            title="Refresh Image"
                                                                            disabled={isLoading}
                                                                        >
                                                                            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}

                                                            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-white flex items-center gap-1.5">
                                                                <span className="font-bold">场景 {scene.idx}</span>
                                                            </div>

                                                            {isVideoMode && (
                                                                <div className="absolute bottom-2 right-2 bg-[#dc2626] backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-white shadow-lg">
                                                                    已完成
                                                                </div>
                                                            )}

                                                            {!isVideoMode && (
                                                                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-gray-300">
                                                                    {scene.begin_s}s - {scene.end_s}s
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Primary Controls under Media */}
                                                        {(!isVideoMode) && (
                                                            <div className="px-3 pt-2 pb-1 flex items-center gap-2">
                                                                <button
                                                                    onClick={() => startEditing(idx, scene.idx, scene.desc)}
                                                                    className="flex-1 bg-[#27272a] hover:bg-[#3f3f46] text-gray-200 text-xs font-semibold py-2 rounded-lg transition-all border border-[#3f3f46] flex items-center justify-center gap-2"
                                                                >
                                                                    <Edit2 size={12} />
                                                                    编辑脚本
                                                                </button>
                                                                <button
                                                                    onClick={() => regenerateClipImage(idx, scene.idx)}
                                                                    disabled={isLoading || regeneratingScenes.has(`${idx}-${scene.idx}`)}
                                                                    className={`flex-1 bg-[#18181b] hover:bg-[#1f1f23] text-gray-200 text-xs font-semibold py-2 rounded-lg transition-all border border-[#3f3f46] flex items-center justify-center gap-2 ${regeneratingScenes.has(`${idx}-${scene.idx}`) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    <RefreshCw size={12} className={regeneratingScenes.has(`${idx}-${scene.idx}`) ? "animate-spin" : ""} />
                                                                    {regeneratingScenes.has(`${idx}-${scene.idx}`) ? '生成中...' : '重新生成'}
                                                                </button>
                                                            </div>
                                                        )}
                                                        {(isVideoMode) && (
                                                            <div className="px-3 pt-2 pb-1 flex items-center gap-2">
                                                                <button
                                                                    onClick={() => startEditing(idx, scene.idx, scene.desc)}
                                                                    className="flex-1 bg-[#27272a] hover:bg-[#3f3f46] text-gray-200 text-xs font-semibold py-2 rounded-lg transition-all border border-[#3f3f46] flex items-center justify-center gap-2"
                                                                >
                                                                    <Edit2 size={12} />
                                                                    编辑脚本
                                                                </button>
                                                                <button
                                                                    onClick={() => regenerateClipImage(idx, scene.idx)}
                                                                    className="flex-1 bg-[#18181b] hover:bg-[#1f1f23] text-gray-200 text-xs font-semibold py-2 rounded-lg transition-all border border-[#3f3f46] flex items-center justify-center gap-2"
                                                                >
                                                                    <RefreshCw size={12} />
                                                                    重新生成
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Content / Controls */}
                                                        <div className="p-3 flex-1 flex flex-col gap-2">
                                                            {editingClip?.msgIdx === idx && editingClip?.clipIdx === scene.idx ? (
                                                                <div className="flex flex-col gap-2 animate-in fade-in duration-200">
                                                                    <div className="relative">
                                                                        {uploadedImageUrl && (
                                                                            <div className="mb-2 aspect-video rounded overflow-hidden border border-[#27272a]">
                                                                                <img src={uploadedImageUrl} alt="Preview" className="w-full h-full object-cover" />
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setUploadedImage(null);
                                                                                        setUploadedImageUrl(null);
                                                                                    }}
                                                                                    className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-red-500/80 transition-colors"
                                                                                >
                                                                                    <X size={10} />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <textarea
                                                                        value={editContent}
                                                                        onChange={(e) => setEditContent(e.target.value)}
                                                                        className="w-full h-20 bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-xs text-gray-200 focus:outline-none focus:border-purple-500 resize-none"
                                                                        autoFocus
                                                                        placeholder="Enter scene description..."
                                                                    />
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="relative">
                                                                            <input
                                                                                type="file"
                                                                                accept="image/*"
                                                                                onChange={handleUploadImage}
                                                                                className="hidden"
                                                                                id={`upload-${idx}-${scene.idx}`}
                                                                            />
                                                                            <label
                                                                                htmlFor={`upload-${idx}-${scene.idx}`}
                                                                                className="cursor-pointer p-1.5 hover:bg-purple-500/10 text-gray-400 hover:text-purple-400 rounded transition-colors flex items-center gap-1.5 text-[10px]"
                                                                                title="Upload Image"
                                                                            >
                                                                                <ImageIcon size={14} />
                                                                                <span>Upload Img</span>
                                                                            </label>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                onClick={cancelEditing}
                                                                                className="p-1.5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded transition-colors"
                                                                                title="Cancel"
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => saveEditing(idx, scene.idx)}
                                                                                className="p-1.5 hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 rounded transition-colors"
                                                                                title="Save"
                                                                            >
                                                                                <Save size={14} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="group/text relative min-h-[3rem]">
                                                                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-3 pr-6">
                                                                        {scene.desc}
                                                                    </p>
                                                                    {/* Edit trigger moved to controls under media */}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>


                                    </>
                                )}

                                {/* Video Clips Review Grid */}
                                {msg.videoClips?.clips && msg.videoClips.clips.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 w-full animate-in fade-in slide-in-from-bottom-4">
                                        {msg.videoClips.clips.map((clip, cidx) => (
                                            <div key={cidx} className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden flex flex-col shadow-lg">
                                                <div className="aspect-video bg-black relative">
                                                    {clip.video_url ? (
                                                        <video src={clip.video_url} controls className="w-full h-full object-contain" preload="metadata" />
                                                    ) : (
                                                        clip.keyframes?.in ? (
                                                            <img src={clip.keyframes.in} className="w-full h-full object-contain" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                                                                <Video className="text-gray-700 w-8 h-8" />
                                                            </div>
                                                        )
                                                    )}
                                                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-white flex items-center gap-1.5">
                                                        <span className="font-bold">场景 {clip.idx}</span>
                                                    </div>
                                                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-gray-300">
                                                        {clip.begin_s}s - {clip.end_s}s
                                                    </div>
                                                </div>
                                                <div className="px-3 pt-2 pb-3 flex items-center gap-2">
                                                    <button
                                                        onClick={() => startEditing(idx, clip.idx, clip.desc)}
                                                        className="flex-1 bg-[#27272a] hover:bg-[#3f3f46] text-gray-200 text-xs font-semibold py-2 rounded-lg transition-all border border-[#3f3f46] flex items-center justify-center gap-2"
                                                    >
                                                        <Edit2 size={12} />
                                                        编辑脚本
                                                    </button>
                                                    <button
                                                        onClick={() => regenerateClipVideo(idx, clip.idx)}
                                                        className="flex-1 bg-[#18181b] hover:bg-[#1f1f23] text-gray-200 text-xs font-semibold py-2 rounded-lg transition-all border border-[#3f3f46] flex items-center justify-center gap-2"
                                                    >
                                                        <RefreshCw size={12} />
                                                        重新生成
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
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
                            ${(msg.clips && !msg.requiresConfirmation) ? 'hidden' : '' /* Hide text bubble if showing clips grid to avoid duplication, UNLESS we need to show the confirm button */}
                        `}>
                                        {/* Only show text if it's not just the clips summary we parsed manually before */}
                                        {!msg.storyboard?.scenes && msg.text}

                                        {msg.options && !msg.requiresConfirmation && (
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

                                    </div>
                                )}

                                {/* Inline Upload Area for Initial Step */}
                                {msg.role === 'model' && workflowStep === 'upload_image' && !uploadedImageUrl && idx === messages.length - 1 && (
                                    <div className="mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full">
                                        <label
                                            htmlFor="main-image-upload"
                                            className="group cursor-pointer flex items-center gap-4 p-4 rounded-xl border border-dashed border-[#3f3f46] hover:border-purple-500/50 hover:bg-[#27272a] transition-all duration-300 bg-[#18181b]"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-[#27272a] flex items-center justify-center group-hover:text-purple-400 transition-colors">
                                                <ImageIcon size={20} className="text-gray-400" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white">点击上传产品图片</h3>
                                                <p className="text-[10px] text-gray-500 group-hover:text-gray-400">支持 PNG, JPG, WebP</p>
                                            </div>
                                            <div className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[10px] text-gray-400 font-medium group-hover:bg-purple-500/10 group-hover:text-purple-400 transition-all">
                                                选择文件
                                            </div>
                                        </label>
                                    </div>
                                )}

                                {/* Agent Outputs Display */}
                                {msg.agentOutputs && msg.agentOutputs.filter(o => o.type !== 'info' && o.type !== 'thought').length > 0 && (
                                    <div className="mt-4 space-y-2 w-full max-w-full animate-in fade-in slide-in-from-bottom-2">
                                        <div className="bg-[#09090b]/50 border border-[#27272a] rounded-lg p-3 space-y-3 max-h-[200px] overflow-y-auto text-xs font-mono custom-scrollbar">
                                            {msg.agentOutputs.filter(o => o.type !== 'info' && o.type !== 'thought').map((output, outIdx) => (
                                                <div key={outIdx} className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${output.agent === 'System' ? 'bg-gray-800/50 text-gray-400 border-gray-700' : 'bg-purple-900/20 text-purple-300 border-purple-500/20'}`}>
                                                            {output.agent}
                                                        </span>
                                                        <span className="text-gray-600 text-[10px]">{output.type}</span>
                                                        {output.progress && (
                                                            <span className="text-gray-500 text-[10px]">
                                                                {output.progress.current}%
                                                            </span>
                                                        )}
                                                    </div>
                                                    {output.delta && <div className="text-gray-400 ml-1 break-words whitespace-pre-wrap leading-relaxed">{output.delta}</div>}
                                                    {output.progress && (
                                                        <div className="w-full bg-gray-800 rounded-full h-0.5 mt-1 overflow-hidden">
                                                            <div
                                                                className="bg-purple-500 h-0.5 rounded-full transition-all duration-500 ease-out"
                                                                style={{ width: `${output.progress.current}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {msg.requiresConfirmation && (
                                    <div className="mt-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="bg-[#18181b]/50 border border-[#27272a] rounded-xl p-6 w-full backdrop-blur-sm">
                                            {(() => {
                                                // Check for failed images (scenes with empty keyframes.in)
                                                // Only check if it's NOT a video clip confirmation (which is handled separately)
                                                const hasFailedImages = !msg.videoClips?.requiresConfirmation && msg.storyboard?.scenes?.some(s => !s.keyframes?.in);

                                                if (hasFailedImages) {
                                                    return (
                                                        <div className="flex flex-col gap-4">
                                                            <div className="flex items-center gap-2 text-red-500 font-medium px-1">
                                                                <X size={16} />
                                                                <span className="text-sm">Storyboard generation incomplete (some images failed). Please retry.</span>
                                                            </div>
                                                            <button
                                                                onClick={handleRegenerateScene}
                                                                disabled={isLoading}
                                                                className="w-full px-5 py-4 rounded-xl text-sm font-bold bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <RefreshCw size={16} />
                                                                <span>Retry Generation</span>
                                                            </button>
                                                        </div>
                                                    );
                                                }

                                                if (msg.videoClips?.requiresConfirmation) {
                                                    return (
                                                        <div className="flex gap-4">
                                                            <button
                                                                onClick={handleConfirmClips}
                                                                disabled={isLoading}
                                                                className="flex-1 px-5 py-4 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-900/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                                                                <span>{isLoading ? '拼接中...' : '接受并拼接'}</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setMessages(prev => {
                                                                        const newMessages = [...prev];
                                                                        const confirmMsg = newMessages.find(m => m.requiresConfirmation);
                                                                        if (confirmMsg) {
                                                                            confirmMsg.requiresConfirmation = false;
                                                                            confirmMsg.status = 'Modification Requested';
                                                                        }
                                                                        return [...newMessages, { role: 'user', text: '需要修改视频片段' }];
                                                                    });
                                                                    startCrewRun('需要修改视频片段');
                                                                }}
                                                                disabled={isLoading}
                                                                className="flex-1 px-5 py-4 rounded-xl text-sm font-medium bg-transparent text-gray-300 border border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white transition-all flex items-center justify-center gap-2"
                                                            >
                                                                <Edit2 size={16} />
                                                                <span>需要修改</span>
                                                            </button>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="flex flex-col gap-4">
                                                        <div className="flex items-center gap-2 text-amber-500 font-medium px-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                            <span className="text-sm">Please confirm the storyboard plan to proceed</span>
                                                        </div>
                                                        <div className="flex gap-4">
                                                            <button
                                                                onClick={async () => {
                                                                    setIsLoading(true);
                                                                    await handleConfirm();
                                                                    // isLoading will be handled by the flow, but we set it here for immediate feedback
                                                                }}
                                                                disabled={isLoading}
                                                                className="flex-1 px-5 py-4 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-900/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                                <span>{isLoading ? '正在生成视频素材...' : 'Confirm Plan & Continue'}</span>
                                                            </button>
                                                            <button
                                                                onClick={handleRegenerateScene}
                                                                disabled={isLoading}
                                                                className="flex-1 px-5 py-4 rounded-xl text-sm font-medium bg-transparent text-gray-300 border border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white transition-all flex items-center justify-center gap-2"
                                                            >
                                                                <RefreshCw size={16} />
                                                                <span>重新生成</span>
                                                            </button>
                                                        </div>
                                                        {isLoading && (
                                                            <div className="text-xs text-gray-500 text-center animate-pulse">
                                                                智能体正在通过 RunningHub 生成视频素材，请耐心等待...
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Final Video Wide Display */}
                                {msg.finalVideo?.video_url && (
                                    <div className="w-full bg-black rounded-xl overflow-hidden border border-[#27272a]">
                                        <div className="aspect-video">
                                            <video src={msg.finalVideo.video_url} controls className="w-full h-full object-contain" />
                                        </div>
                                        <div className="p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <Video size={12} className="text-purple-400" />
                                                <span>Final Video</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleAddAsset({ type: 'video', url: msg.finalVideo!.video_url, name: 'Final Video', mimeType: 'video/mp4' })}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-400 hover:text-purple-300 transition-colors bg-purple-500/10 px-2 py-1 rounded hover:bg-purple-500/20"
                                                >
                                                    <Plus size={10} />
                                                    ADD TO PROJECT
                                                </button>
                                                <a href={msg.finalVideo.video_url} download className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-300 hover:text-white transition-colors bg-transparent px-2 py-1 rounded border border-[#3f3f46] hover:bg-[#3f3f46]">
                                                    下载
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {msg.attachments?.map((att, i) => (
                                    !msg.clips && (!msg.finalVideo || att.url !== msg.finalVideo.video_url) && (
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
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleAddAsset(att)}
                                                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-400 hover:text-purple-300 transition-colors bg-purple-500/10 px-2 py-1 rounded hover:bg-purple-500/20"
                                                    >
                                                        <Plus size={10} />
                                                        Add to Project
                                                    </button>
                                                    {att.type === 'video' && (
                                                        <a
                                                            href={att.url}
                                                            download
                                                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-300 hover:text-white transition-colors bg-transparent px-2 py-1 rounded border border-[#3f3f46] hover:bg-[#3f3f46]"
                                                        >
                                                            下载
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
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
                            type="file"
                            accept="image/*"
                            onChange={handleUploadImage}
                            className="hidden"
                            id="main-image-upload"
                        />

                        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20">
                            <label
                                htmlFor="main-image-upload"
                                className={`
                                    w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all
                                    ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#27272a] text-gray-400 hover:text-white'}
                                `}
                            >
                                <div className="p-1.5">
                                    <ImageIcon size={18} />
                                </div>
                            </label>
                        </div>

                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={workflowStep === 'upload_image' ? "请点击左侧图标上传产品图片..." : "请输入视频主题或反馈意见..."}
                            className="w-full bg-[#18181b] text-white rounded-2xl pl-12 pr-14 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder-gray-500 border border-[#27272a] shadow-inner transition-all relative z-10"
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
