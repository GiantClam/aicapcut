import React, { useState, useEffect, useCallback } from 'react';
import { EditorProvider } from './contexts/EditorContext';
import ChatInterface from './components/ChatInterface';
import EditorPanel from './components/VideoEditor/EditorPanel';
import { Layout } from 'lucide-react';

function App() {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      // Constraints: Min 300px, Max 70% of screen width
      const newWidth = Math.max(300, Math.min(e.clientX, window.innerWidth * 0.7));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <EditorProvider>
      <div className="flex h-screen w-full bg-black overflow-hidden font-sans text-gray-100 relative selection:bg-purple-500/30">
        
        {/* Background Ambient Effects (Visible in Agent Mode) */}
        {!isEditorOpen && (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse delay-1000" />
          </div>
        )}

        {/* Left Panel: Chat / Agent Interface */}
        <div 
          style={{ width: isEditorOpen ? `${sidebarWidth}px` : '100%' }}
          className={`
            relative z-10 h-full flex flex-col border-r border-[#333] bg-[#09090b] shadow-2xl shrink-0
            ${isResizing ? 'transition-none' : 'transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]'}
          `}
        >
          <ChatInterface 
            isEditorOpen={isEditorOpen} 
            onToggleEditor={() => setIsEditorOpen(!isEditorOpen)} 
          />

          {/* Resizer Handle */}
          {isEditorOpen && (
            <div 
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-purple-500/50 transition-colors z-50 group flex justify-center"
              onMouseDown={startResizing}
            >
               {/* Visual Indicator Line */}
               <div className="w-[1px] h-full bg-transparent group-hover:bg-purple-500/80 transition-colors" />
            </div>
          )}
        </div>
        
        {/* Right Panel: Editor (Slides in) */}
        <div 
          className={`
            relative z-0 h-full min-w-0 transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] bg-black
            ${isEditorOpen ? 'flex-1 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-[50px] overflow-hidden'}
          `}
        >
          {/* 
              Wrap EditorPanel in a scrollable container. 
              min-w-[900px] ensures the 3-column layout (300px + Player + 300px) doesn't break/squash.
              overflow-x-auto allows scrolling if the viewport is too small, preventing the Property Editor from being clipped.
          */}
          <div className="w-full h-full overflow-x-auto overflow-y-hidden">
             <div className="h-full min-w-[900px] flex flex-col"> 
                 {/* 
                   Using min-w-0 on flex child is crucial for text-truncation and responsive flex behavior inside.
                 */}
                 <div className="flex-1 min-w-0">
                    <EditorPanel />
                 </div>
             </div>
          </div>
        </div>

      </div>
    </EditorProvider>
  );
}

export default App;