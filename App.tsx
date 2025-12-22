"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { EditorProvider } from './contexts/EditorContext';
import ChatInterface from './components/ChatInterface';
import { Sidebar } from './components/Sidebar';
import EditorPanel from './components/VideoEditor/EditorPanel';
import LandingPage from './components/LandingPage';
import { Layout } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { checkUserAuthorization } from './lib/actions';

import { Session } from 'next-auth';

interface AppProps {
  initialSession?: Session | null;
  initialIsAllowed?: boolean | null;
}

function App({ initialSession, initialIsAllowed }: AppProps) {
  const { data: session, status } = useSession({
    required: false,
    // @ts-ignore
    initialData: initialSession
  });

  const [isAllowed, setIsAllowed] = useState<boolean | null>(initialIsAllowed ?? null);
  const currentSession = session || initialSession;
  const currentStatus = initialSession ? 'authenticated' : status;
  const isLoadingAuth = !initialSession && status === 'loading';

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  // Session State
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  // Reset key to force re-initialization even if activeRunId is already null
  const [resetKey, setResetKey] = useState(0);

  const handleNewProject = () => {
    setActiveRunId(null);
    setResetKey(prev => prev + 1);
  };

  const handleLogout = async () => {
    await signOut();
    setActiveRunId(null);
  };

  // Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (initialIsAllowed !== undefined) {
      setIsAllowed(initialIsAllowed);
    }
  }, [initialIsAllowed]);

  useEffect(() => {
    if (currentSession?.user?.email && initialIsAllowed === undefined) {
      checkUserAuthorization(currentSession.user.email).then(setIsAllowed);
    } else if (currentStatus === 'unauthenticated') {
      setIsAllowed(null);
    }
  }, [currentSession, currentStatus, initialIsAllowed]);

  // Superseded by server action in lib/actions.ts
  /*
  const checkUserAuthorization = async (userId: string) => {
    ...
  };
  */

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

  if (isLoadingAuth) {
    return <div className="h-screen w-full bg-black text-white flex items-center justify-center">Loading...</div>;
  }

  if (currentStatus === 'unauthenticated' || !currentSession) {
    return <LandingPage onGrantAccess={() => { }} />;
  }

  if (isAllowed === false) {
    return (
      <div className="h-screen w-full bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
            <Layout className="w-10 h-10 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold">Waiting for Approval</h1>
          <p className="text-gray-400">
            Your account has been created successfully. Our team is currently reviewing applications to ensure a high-quality experience for everyone.
          </p>
          <p className="text-sm text-purple-400/80">
            We'll notify you via email once your access has been granted.
          </p>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors text-sm"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

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

        {/* Sidebar History */}
        <Sidebar
          activeRunId={activeRunId}
          onSelectRun={setActiveRunId}
          onNewProject={handleNewProject}
          onLogout={handleLogout}
          userEmail={currentSession?.user?.email}
          isCollapsed={isSidebarCollapsed}
          toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`shrink-0 z-20 relative transition-all duration-300 ${isSidebarCollapsed ? 'w-[70px]' : 'w-[280px]'}`}
        />

        {/* Left Panel: Chat / Agent Interface */}
        <div
          style={{ width: isEditorOpen ? `${sidebarWidth}px` : undefined, flex: isEditorOpen ? 'none' : 1 }}
          className={`
            relative z-10 h-full flex flex-col border-r border-[#333] bg-[#09090b] shadow-2xl shrink-0
            ${isResizing ? 'transition-none' : 'transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]'}
          `}
        >
          <ChatInterface
            isEditorOpen={isEditorOpen}
            onToggleEditor={() => setIsEditorOpen(!isEditorOpen)}
            activeRunId={activeRunId}
            onUpdateActiveRunId={setActiveRunId}
            resetKey={resetKey}
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
