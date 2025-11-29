import React, { useRef, useState, useEffect } from 'react';
import { useEditor } from '../../contexts/EditorContext';
import { ItemType, TimelineItem, Asset, Track } from '../../types';
import { Film, Type, Music, Image as ImageIcon } from 'lucide-react';

const SCALE = 50; // pixels per second
const SNAP_GRID = 0.05; // 50ms snapping
const SNAP_THRESHOLD = 0.2; // 200ms magnetic snap distance
const MIN_DURATION = 1.0; // Minimum clip duration in seconds

interface InteractionState {
    itemId: string;
    type: 'move' | 'resize-l' | 'resize-r';
    startX: number;
    originalStart: number;
    originalDuration: number;
    minConstraint: number; // min StartTime (resize-l) or min Duration (resize-r)
    maxConstraint: number; // max StartTime (resize-l) or max Duration (resize-r)
    snapPoints: number[]; // Points to snap to (start/end of other clips)
    collisionZones: { start: number, end: number }[]; // Forbidden zones (other clips on same track)
}

interface TempItemState {
    id: string;
    startTime: number;
    duration: number;
}

interface TimelineItemBlockProps {
    item: TimelineItem;
    isSelected: boolean;
    isValid: boolean;
    onSelect: () => void;
    onDragStart: (e: React.MouseEvent, type: 'move' | 'resize-l' | 'resize-r') => void;
}

const TimelineItemBlock: React.FC<TimelineItemBlockProps> = ({ item, isSelected, isValid, onSelect, onDragStart }) => {
    let bgColor = 'bg-gray-600';
    let borderColor = 'border-transparent';
    let Icon = Film;
    
    switch (item.type) {
        case ItemType.VIDEO: bgColor = 'bg-blue-600'; Icon = Film; break;
        case ItemType.IMAGE: bgColor = 'bg-indigo-600'; Icon = ImageIcon; break;
        case ItemType.TEXT: bgColor = 'bg-orange-600'; Icon = Type; break;
        case ItemType.AUDIO: bgColor = 'bg-emerald-600'; Icon = Music; break;
    }

    if (isSelected) {
        borderColor = 'border-white';
    }
    
    // Invalid state overrides selection border
    if (!isValid) {
        borderColor = 'border-red-500';
        bgColor = 'bg-red-900/50';
    }

    return (
        <div
            onMouseDown={(e) => { 
                e.stopPropagation(); 
                onSelect();
                onDragStart(e, 'move');
            }}
            className={`absolute h-full rounded-md overflow-visible border-2 cursor-pointer transition-colors group ${borderColor} ${isSelected ? 'ring-2 ring-purple-500 z-10' : 'opacity-90 hover:opacity-100'} ${!isValid ? 'z-50' : ''}`}
            style={{
                left: `${item.startTime * SCALE}px`,
                width: `${item.duration * SCALE}px`,
                top: '4px',
                bottom: '4px'
            }}
        >
            {/* Left Handle */}
            <div 
                className={`absolute left-0 top-0 bottom-0 w-3 -ml-1.5 cursor-w-resize z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 ${isSelected ? 'opacity-100' : ''}`}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onDragStart(e, 'resize-l');
                }}
            >
                <div className="w-1.5 h-6 bg-white/50 rounded-full shadow-sm" />
            </div>

            {/* Content */}
            <div className={`w-full h-full ${bgColor} flex items-center px-3 gap-2 overflow-hidden select-none rounded-sm transition-colors`}>
                <Icon size={14} className="text-white/70 shrink-0" />
                <span className="text-xs text-white whitespace-nowrap truncate font-medium">{item.name || item.content}</span>
                {isSelected && (
                    <span className="text-[10px] text-white/60 ml-auto whitespace-nowrap">
                        {item.duration.toFixed(1)}s
                    </span>
                )}
            </div>

            {/* Right Handle */}
            <div 
                className={`absolute right-0 top-0 bottom-0 w-3 -mr-1.5 cursor-e-resize z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 ${isSelected ? 'opacity-100' : ''}`}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onDragStart(e, 'resize-r');
                }}
            >
                 <div className="w-1.5 h-6 bg-white/50 rounded-full shadow-sm" />
            </div>
            
            {/* Tooltip on Hover/Select/Drag */}
             <div className="absolute -top-8 left-0 bg-black/90 text-white text-[10px] px-2 py-1 rounded border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                <span className="text-gray-400">Start:</span> {item.startTime.toFixed(2)}s <span className="text-gray-600 mx-1">|</span> <span className="text-gray-400">Dur:</span> {item.duration.toFixed(2)}s
                {!isValid && <span className="text-red-400 ml-2 font-bold">OVERLAP</span>}
             </div>
        </div>
    );
};

const Timeline: React.FC = () => {
    const { project, currentTime, seek, selectedItemId, selectItem, updateTrackItems, updateItem, deleteItem } = useEditor();
    const timelineRef = useRef<HTMLDivElement>(null);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [dragOverTrack, setDragOverTrack] = useState<number | null>(null);
    
    // State for moving/resizing items
    const [interaction, setInteraction] = useState<InteractionState | null>(null);
    const [tempItemState, setTempItemState] = useState<TempItemState | null>(null);

    // Keyboard support for Deletion
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId) {
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                    return;
                }
                deleteItem(selectedItemId);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItemId, deleteItem]);

    // --- Timeline Interaction Handlers ---

    const handleTimelineClick = (e: React.MouseEvent) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
        const time = Math.max(0, x / SCALE);
        seek(time);
        selectItem(null);
    };

    const handleScrubMouseMove = (e: React.MouseEvent) => {
        if (isScrubbing && timelineRef.current) {
            const rect = timelineRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
            const time = Math.max(0, x / SCALE);
            seek(time);
        }
    };

    // --- Item Drag/Resize Handlers ---

    const handleItemDragStart = (e: React.MouseEvent, item: TimelineItem, type: 'move' | 'resize-l' | 'resize-r') => {
        e.preventDefault();
        e.stopPropagation();

        const track = project.tracks.find(t => t.id === item.trackId);
        if (!track) return;

        // 1. Gather constraints and snap points
        // Constraints are only strictly applied for resizing.
        // For moving, we allow free movement and validate on drop (showing red if invalid).
        
        let minConstraint = 0;
        let maxConstraint = Infinity;
        
        const otherItems = track.items
            .filter(i => i.id !== item.id)
            .sort((a, b) => a.startTime - b.startTime);

        // Calculate resize constraints based on neighbors (cannot resize through another clip)
        if (type === 'resize-l') {
             const prevItem = otherItems.filter(i => i.startTime + i.duration <= item.startTime + 0.001).pop();
             const originalEnd = item.startTime + item.duration;
             minConstraint = prevItem ? prevItem.startTime + prevItem.duration : 0;
             maxConstraint = originalEnd - MIN_DURATION;
        } else if (type === 'resize-r') {
             const nextItem = otherItems.find(i => i.startTime >= item.startTime + item.duration - 0.001);
             minConstraint = MIN_DURATION;
             maxConstraint = nextItem ? nextItem.startTime - item.startTime : Infinity;
        } else {
            // For move, we set no rigid constraints to allow jumping order
            minConstraint = 0;
            maxConstraint = Infinity;
        }

        // Calculate Snap Points (Start and End of ALL items on ALL tracks)
        // Also define collision zones for the current track
        const snapPoints: number[] = [0];
        const collisionZones: { start: number, end: number }[] = [];

        project.tracks.forEach(t => {
            t.items.forEach(i => {
                if (i.id === item.id) return;
                snapPoints.push(i.startTime);
                snapPoints.push(i.startTime + i.duration);

                if (t.id === item.trackId) {
                    collisionZones.push({ start: i.startTime, end: i.startTime + i.duration });
                }
            });
        });

        setInteraction({
            itemId: item.id,
            type,
            startX: e.clientX,
            originalStart: item.startTime,
            originalDuration: item.duration,
            minConstraint,
            maxConstraint,
            snapPoints,
            collisionZones
        });
        setTempItemState({
            id: item.id,
            startTime: item.startTime,
            duration: item.duration
        });
    };

    useEffect(() => {
        if (!interaction) return;

        const handleGlobalMove = (e: MouseEvent) => {
            const deltaPixels = e.clientX - interaction.startX;
            const deltaTime = deltaPixels / SCALE;

            let newStart = interaction.originalStart;
            let newDuration = interaction.originalDuration;

            // --- 1. Calculate Raw Values ---
            if (interaction.type === 'move') {
                newStart = interaction.originalStart + deltaTime;
            } else if (interaction.type === 'resize-r') {
                newDuration = interaction.originalDuration + deltaTime;
            } else if (interaction.type === 'resize-l') {
                const originalEnd = interaction.originalStart + interaction.originalDuration;
                newStart = interaction.originalStart + deltaTime;
                newDuration = originalEnd - newStart;
            }

            // --- 2. Apply Constraints (Clamp) ---
            if (interaction.type !== 'move') {
                // Resize must strictly obey neighbors
                 if (interaction.type === 'resize-l') {
                     newStart = Math.max(interaction.minConstraint, Math.min(interaction.maxConstraint, newStart));
                     newDuration = (interaction.originalStart + interaction.originalDuration) - newStart;
                 } else {
                     newDuration = Math.max(interaction.minConstraint, Math.min(interaction.maxConstraint, newDuration));
                 }
            } else {
                // Move is free but clamped to 0
                newStart = Math.max(0, newStart);
            }

            // --- 3. Apply Snapping ---
            // We try to snap the 'active' edges to any snap point
            let bestSnapDelta = Infinity;
            
            // Edges to check for snapping
            const activeEdges = [];
            if (interaction.type === 'move') {
                activeEdges.push({ value: newStart, type: 'start' });
                activeEdges.push({ value: newStart + newDuration, type: 'end' });
            } else if (interaction.type === 'resize-l') {
                activeEdges.push({ value: newStart, type: 'start' });
            } else if (interaction.type === 'resize-r') {
                activeEdges.push({ value: newStart + newDuration, type: 'end' });
            }

            // Find closest snap point
            interaction.snapPoints.forEach(pt => {
                activeEdges.forEach(edge => {
                    const diff = pt - edge.value;
                    if (Math.abs(diff) < SNAP_THRESHOLD && Math.abs(diff) < Math.abs(bestSnapDelta)) {
                        bestSnapDelta = diff;
                    }
                });
            });

            // Apply snap if found, otherwise grid snap
            if (Math.abs(bestSnapDelta) < SNAP_THRESHOLD) {
                if (interaction.type === 'move') {
                    newStart += bestSnapDelta;
                } else if (interaction.type === 'resize-l') {
                    newStart += bestSnapDelta;
                    newDuration -= bestSnapDelta; 
                } else if (interaction.type === 'resize-r') {
                    newDuration += bestSnapDelta;
                }
            } else {
                // Fallback to grid if no magnet
                if (interaction.type === 'move') {
                    newStart = Math.round(newStart / SNAP_GRID) * SNAP_GRID;
                } else if (interaction.type === 'resize-l') {
                    const snappedStart = Math.round(newStart / SNAP_GRID) * SNAP_GRID;
                    const diff = snappedStart - newStart;
                    newStart = snappedStart;
                    newDuration -= diff;
                } else if (interaction.type === 'resize-r') {
                    newDuration = Math.round(newDuration / SNAP_GRID) * SNAP_GRID;
                }
            }

            // Final Constraints Check (just in case snapping pushed it out of bounds)
             if (interaction.type !== 'move') {
                 if (interaction.type === 'resize-l') {
                     newStart = Math.max(interaction.minConstraint, Math.min(interaction.maxConstraint, newStart));
                     newDuration = (interaction.originalStart + interaction.originalDuration) - newStart;
                 } else {
                     newDuration = Math.max(interaction.minConstraint, Math.min(interaction.maxConstraint, newDuration));
                 }
             } else {
                 newStart = Math.max(0, newStart);
             }

            // Clean floats
            newStart = parseFloat(newStart.toFixed(4));
            newDuration = parseFloat(newDuration.toFixed(4));

            setTempItemState({
                id: interaction.itemId,
                startTime: newStart,
                duration: newDuration
            });
        };

        const handleGlobalUp = () => {
            if (tempItemState) {
                // Check Overlap
                const hasOverlap = interaction.collisionZones.some(z => {
                    // Overlap if (StartA < EndB) and (EndA > StartB)
                    // Use a small epsilon to allow touching edges
                    return tempItemState.startTime < z.end - 0.001 && 
                           (tempItemState.startTime + tempItemState.duration) > z.start + 0.001;
                });

                if (!hasOverlap) {
                    updateItem(tempItemState.id, {
                        startTime: tempItemState.startTime,
                        duration: tempItemState.duration
                    });
                } else {
                    // console.warn("Overlap detected, reverting move");
                    // Optionally trigger a toast or animation
                }
            }
            setInteraction(null);
            setTempItemState(null);
        };

        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('mouseup', handleGlobalUp);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalUp);
        };
    }, [interaction, tempItemState, updateItem]);

    // --- Drag and Drop Assets ---

    const handleDragOver = (e: React.DragEvent, trackId: number) => {
        e.preventDefault();
        setDragOverTrack(trackId);
    };

    const handleDrop = (e: React.DragEvent, trackId: number) => {
        e.preventDefault();
        setDragOverTrack(null);
        
        const assetData = e.dataTransfer.getData('application/json');
        if (!assetData) return;
        
        const asset: Asset = JSON.parse(assetData);
        if (!timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
        let startTime = Math.max(0, x / SCALE);
        let snappedStart = Math.round(startTime / SNAP_GRID) * SNAP_GRID;
        const defaultDuration = Math.max(MIN_DURATION, asset.type === ItemType.IMAGE ? 3 : 5); 
        
        const track = project.tracks.find(t => t.id === trackId);
        if (track) {
            const sortedItems = [...track.items].sort((a,b) => a.startTime - b.startTime);
            const overlaps = (start: number, end: number) => {
                return sortedItems.some(i => (start < i.startTime + i.duration) && (end > i.startTime));
            };

            // Smart placement logic for new items
            if (overlaps(snappedStart, snappedStart + defaultDuration)) {
                const overlappingItem = sortedItems.find(i => (snappedStart < i.startTime + i.duration) && (snappedStart + defaultDuration > i.startTime));
                if (overlappingItem) {
                    snappedStart = overlappingItem.startTime + overlappingItem.duration;
                    if (overlaps(snappedStart, snappedStart + defaultDuration)) {
                         const lastItem = sortedItems[sortedItems.length - 1];
                         snappedStart = lastItem ? lastItem.startTime + lastItem.duration : 0;
                    }
                }
            }
            snappedStart = parseFloat(snappedStart.toFixed(4));

            const newItem: TimelineItem = {
                id: `item-${Date.now()}`,
                type: asset.type,
                content: asset.url,
                startTime: snappedStart,
                duration: defaultDuration,
                trackId: trackId,
                name: asset.name,
                style: { x: 50, y: 50, scale: 100, opacity: 1, rotation: 0 }
            };

            updateTrackItems(trackId, [...track.items, newItem]);
        }
    };

    const checkCurrentOverlap = (item: TempItemState | TimelineItem, trackId: number) => {
        const track = project.tracks.find(t => t.id === trackId);
        if (!track) return false;
        return track.items.some(i => {
            if (i.id === item.id) return false;
            return item.startTime < (i.startTime + i.duration - 0.001) && 
                   (item.startTime + item.duration) > (i.startTime + 0.001);
        });
    };

    return (
        <div className="flex-1 bg-[#151515] overflow-hidden flex flex-col select-none border-t border-[#333]">
            {/* Toolbar */}
            <div className="h-10 border-b border-[#333] px-4 flex items-center justify-between gap-4 text-xs text-gray-400 bg-[#1e1e1e]">
                <div className="flex gap-4">
                    <span className="text-white">Snapping On (Magnet)</span>
                    <span>Min Duration: {MIN_DURATION}s</span>
                </div>
                <div>
                   Drag to move (Jump enabled) • Drag edges to trim • Delete key to remove
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Track Headers */}
                <div className="w-32 bg-[#1e1e1e] border-r border-[#333] z-30 shrink-0 flex flex-col pt-8 shadow-md">
                     {project.tracks.map(track => (
                         <div key={track.id} className="h-20 border-b border-[#333] flex items-center px-3 gap-2 text-gray-300 text-sm font-medium bg-[#1e1e1e]">
                            <span className="w-5 h-5 flex items-center justify-center rounded bg-[#333] text-[10px] text-gray-500">{track.id}</span>
                            <div className="flex flex-col truncate">
                                <span className="truncate">{track.name}</span>
                                <span className="text-[10px] text-gray-500 uppercase">{track.type}</span>
                            </div>
                         </div>
                     ))}
                </div>

                {/* Timeline Area */}
                <div 
                    ref={timelineRef}
                    className="flex-1 overflow-x-auto overflow-y-hidden relative bg-[#111]"
                    onMouseDown={(e) => {
                        if ((e.target as HTMLElement).closest('.timeline-item-block')) return;
                        setIsScrubbing(true);
                        handleTimelineClick(e);
                    }}
                    onMouseUp={() => setIsScrubbing(false)}
                    onMouseLeave={() => setIsScrubbing(false)}
                    onMouseMove={handleScrubMouseMove}
                >
                    <div style={{ width: `${Math.max(project.duration + 10, 60) * SCALE}px`, height: '100%' }} className="relative pt-8">
                        
                        {/* Time Ruler */}
                        <div className="absolute top-0 left-0 right-0 h-8 bg-[#1e1e1e] border-b border-[#333] flex items-end sticky z-10">
                             {Array.from({ length: Math.ceil(project.duration + 10) }).map((_, i) => (
                                 <div key={i} className="absolute bottom-0 h-4 border-l border-gray-600 text-[10px] text-gray-500 pl-1 select-none pointer-events-none" style={{ left: `${i * SCALE}px`}}>
                                     {i}s
                                 </div>
                             ))}
                        </div>

                        {/* Tracks */}
                        {project.tracks.map(track => (
                            <div 
                                key={track.id} 
                                className={`h-20 border-b border-[#222] relative track-row transition-colors ${dragOverTrack === track.id ? 'bg-[#222]' : ''}`}
                                onDragOver={(e) => handleDragOver(e, track.id)}
                                onDrop={(e) => handleDrop(e, track.id)}
                                onDragLeave={() => setDragOverTrack(null)}
                            >
                                {track.items.map(item => {
                                    // Use temp state if interacting
                                    const isInteracting = tempItemState && tempItemState.id === item.id;
                                    const effectiveItem = isInteracting ? { ...item, ...tempItemState } : item;
                                    
                                    // Check validity for visual feedback
                                    const isValid = !checkCurrentOverlap(effectiveItem, track.id);

                                    return (
                                        <div key={item.id} className="timeline-item-block">
                                            <TimelineItemBlock 
                                                item={effectiveItem} 
                                                isSelected={selectedItemId === item.id}
                                                isValid={isValid}
                                                onSelect={() => selectItem(item.id)}
                                                onDragStart={(e, type) => handleItemDragStart(e, item, type)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                        {/* Playhead */}
                        <div 
                            className="absolute top-0 bottom-0 w-[1px] bg-red-500 z-40 pointer-events-none"
                            style={{ left: `${currentTime * SCALE}px` }}
                        >
                            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500 transform -translate-x-1/2 absolute -top-1"></div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Timeline;