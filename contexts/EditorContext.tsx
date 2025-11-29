import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { VideoProject, TimelineItem, Track, Asset } from '../types';
import { INITIAL_PROJECT, INITIAL_ASSETS } from '../constants';

interface EditorContextType {
  project: VideoProject;
  setProject: React.Dispatch<React.SetStateAction<VideoProject>>;
  currentTime: number;
  isPlaying: boolean;
  togglePlay: () => void;
  seek: (time: number) => void;
  updateTrackItems: (trackId: number, newItems: TimelineItem[]) => void;
  selectedItemId: string | null;
  selectItem: (id: string | null) => void;
  assets: Asset[];
  addAsset: (asset: Asset) => void;
  updateItem: (itemId: string, updates: Partial<TimelineItem>) => void;
  deleteItem: (itemId: string) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<VideoProject>(INITIAL_PROJECT);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  
  const lastTimeRef = useRef<number>(0);
  const requestRef = useRef<number>();

  const animate = (time: number) => {
    if (lastTimeRef.current !== 0) {
      const deltaTime = (time - lastTimeRef.current) / 1000;
      setCurrentTime(prev => {
        const next = prev + deltaTime;
        if (next >= project.duration) {
          setIsPlaying(false);
          return 0; // Loop or stop
        }
        return next;
      });
    }
    lastTimeRef.current = time;
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = 0;
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      lastTimeRef.current = 0;
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, project.duration]);

  const togglePlay = () => setIsPlaying(prev => !prev);
  
  const seek = (time: number) => {
    setIsPlaying(false);
    setCurrentTime(Math.max(0, Math.min(time, project.duration)));
  };

  const updateTrackItems = (trackId: number, newItems: TimelineItem[]) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => 
        t.id === trackId ? { ...t, items: newItems } : t
      )
    }));
  };

  const updateItem = (itemId: string, updates: Partial<TimelineItem>) => {
    setProject(prev => {
      const newTracks = prev.tracks.map(track => {
        const itemIndex = track.items.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return track;
        
        const originalItem = track.items[itemIndex];
        const newItems = [...track.items];
        
        // Merge top-level properties
        const updatedItem = { ...originalItem, ...updates };

        // Deep merge style if it exists in updates, to prevent overwriting other style props
        if (updates.style && originalItem.style) {
             updatedItem.style = { ...originalItem.style, ...updates.style };
        } else if (updates.style) {
            // If original had no style, just take the new one
            updatedItem.style = updates.style;
        }

        newItems[itemIndex] = updatedItem;
        return { ...track, items: newItems };
      });
      return { ...prev, tracks: newTracks };
    });
  };

  const deleteItem = (itemId: string) => {
    setProject(prev => {
      const newTracks = prev.tracks.map(track => ({
        ...track,
        items: track.items.filter(i => i.id !== itemId)
      }));
      return { ...prev, tracks: newTracks };
    });
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    }
  };

  const selectItem = (id: string | null) => {
    setSelectedItemId(id);
  };

  const addAsset = (asset: Asset) => {
      setAssets(prev => [asset, ...prev]);
  };

  return (
    <EditorContext.Provider value={{
      project,
      setProject,
      currentTime,
      isPlaying,
      togglePlay,
      seek,
      updateTrackItems,
      selectedItemId,
      selectItem,
      assets,
      addAsset,
      updateItem,
      deleteItem
    }}>
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) throw new Error('useEditor must be used within EditorProvider');
  return context;
};