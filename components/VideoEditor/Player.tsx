import React, { useMemo, useRef, useEffect } from 'react';
import { useEditor } from '../../contexts/EditorContext';
import { ItemType } from '../../types';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

const Player: React.FC = () => {
  const { project, currentTime, isPlaying, togglePlay, seek } = useEditor();
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeItems = useMemo(() => {
    return project.tracks.flatMap(track => 
      track.items.filter(item => 
        currentTime >= item.startTime && currentTime < (item.startTime + item.duration)
      )
    ).sort((a, b) => a.trackId - b.trackId); // Simple z-index by track ID
  }, [project, currentTime]);

  const activeVideo = activeItems.find(i => i.type === ItemType.VIDEO);
  const activeImage = activeItems.find(i => i.type === ItemType.IMAGE);
  const activeTexts = activeItems.filter(i => i.type === ItemType.TEXT);

  // Sync video element with global timeline time
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideo) return;

    const targetTime = Math.max(0, currentTime - activeVideo.startTime);

    if (isPlaying) {
        // If playing, ensure video is playing
        if (video.paused) {
            video.play().catch(() => {});
        }
        // Drift correction: only force time update if deviation is significant (> 0.3s)
        // This prevents stuttering caused by constantly overriding native playback with JS timer
        if (Math.abs(video.currentTime - targetTime) > 0.3) {
            video.currentTime = targetTime;
        }
    } else {
        // If paused, ensure video is paused and time is synced exactly (for scrubbing)
        video.pause();
        if (Math.abs(video.currentTime - targetTime) > 0.05) {
            video.currentTime = targetTime;
        }
    }
  }, [currentTime, isPlaying, activeVideo]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#111]">
      {/* Viewport */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0a0a0a] relative overflow-hidden">
        <div 
            className="relative bg-black shadow-2xl overflow-hidden" 
            style={{ 
                aspectRatio: `${project.width}/${project.height}`,
                height: '100%',
                maxHeight: '100%'
            }}
        >
          {/* Base Layer: Video or Image */}
          {activeVideo ? (
             <video 
                ref={videoRef}
                src={activeVideo.content} 
                className="absolute origin-center object-cover"
                style={{
                  width: '100%',
                  height: '100%',
                  transform: `scale(${ (activeVideo.style?.scale || 100) / 100 }) rotate(${activeVideo.style?.rotation || 0}deg) translate(${(activeVideo.style?.x || 50) - 50}%, ${(activeVideo.style?.y || 50) - 50}%)`,
                  opacity: activeVideo.style?.opacity ?? 1
                }}
                key={activeVideo.id}
                muted 
                onLoadedMetadata={(e) => {
                    // Initialize time immediately when metadata loads to prevent frame jumping
                    e.currentTarget.currentTime = Math.max(0, currentTime - activeVideo.startTime);
                    if (isPlaying) e.currentTarget.play().catch(() => {});
                }}
             />
          ) : activeImage ? (
            <img 
                src={activeImage.content} 
                alt="scene" 
                className="absolute origin-center object-cover"
                style={{
                  width: '100%',
                  height: '100%',
                  transform: `scale(${ (activeImage.style?.scale || 100) / 100 }) rotate(${activeImage.style?.rotation || 0}deg) translate(${(activeImage.style?.x || 50) - 50}%, ${(activeImage.style?.y || 50) - 50}%)`,
                  opacity: activeImage.style?.opacity ?? 1
                }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-700">
                
            </div>
          )}

          {/* Overlays */}
          {activeTexts.map(text => (
            <div
                key={text.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none whitespace-pre-wrap text-center"
                style={{
                    left: `${text.style?.x ?? 50}%`,
                    top: `${text.style?.y ?? 50}%`,
                    color: text.style?.color ?? 'white',
                    fontSize: `${(text.style?.fontSize ?? 24) * 0.5}px`, // Scale down for preview
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                    fontFamily: 'sans-serif',
                    opacity: text.style?.opacity ?? 1,
                    transform: `rotate(${text.style?.rotation || 0}deg) scale(${(text.style?.scale || 100) / 100})`
                }}
            >
                {text.content}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="h-12 bg-[#1e1e1e] border-t border-[#333] flex items-center justify-between px-6 shrink-0">
         <div className="text-gray-400 font-mono text-xs w-24">
             {formatTime(currentTime)}
         </div>

         <div className="flex items-center gap-4">
            <button onClick={() => seek(0)} className="text-gray-400 hover:text-white">
                <SkipBack size={16} />
            </button>
            <button 
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={() => seek(project.duration)} className="text-gray-400 hover:text-white">
                <SkipForward size={16} />
            </button>
         </div>

         <div className="text-gray-400 font-mono text-xs w-24 text-right">
             {formatTime(project.duration)}
         </div>
      </div>
    </div>
  );
};

export default Player;