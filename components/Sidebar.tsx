import React, { useEffect, useState } from 'react';
import { Plus, MessageSquare, Video, ChevronLeft, ChevronRight, User, Settings, LogOut } from 'lucide-react';
import { listWorkflows } from '../lib/saleagent-client';

interface SidebarProps {
    activeRunId: string | null;
    onSelectRun: (runId: string) => void;
    onNewProject: () => void;
    onLogout?: () => void;
    userEmail?: string;
    className?: string;
    isCollapsed?: boolean;
    toggleCollapse?: () => void;
}

export function Sidebar({
    activeRunId,
    onSelectRun,
    onNewProject,
    onLogout,
    userEmail = "User",
    className = '',
    isCollapsed = false,
    toggleCollapse
}: SidebarProps) {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

    // ... (rest of the component)

    return (
        <div className={`flex flex-col h-full bg-[#09090b] border-r border-[#333] transition-all duration-300 ${className}`}>
            {/* ... (existing header and history) */}

            {/* User / Footer */}
            <div className="p-4 border-t border-[#333] relative">
                {showUserMenu && !isCollapsed && (
                    <div className="absolute bottom-[100%] left-2 right-2 bg-[#1c1c1e] border border-[#333] rounded-lg shadow-xl mb-2 overflow-hidden z-50">
                        <button className="w-full text-left px-4 py-3 hover:bg-[#2c2c2e] text-sm text-gray-200 flex items-center gap-2">
                            <Settings size={14} /> Settings
                        </button>
                        <div className="h-[1px] bg-[#333]" />
                        <button
                            onClick={() => {
                                onLogout?.();
                                setShowUserMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-[#2c2c2e] text-sm text-red-400 flex items-center gap-2"
                        >
                            <LogOut size={14} /> Logout
                        </button>
                    </div>
                )}

                <button
                    className={`flex items-center gap-3 w-full hover:bg-[#18181b] p-2 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : ''}`}
                    onClick={() => setShowUserMenu(!showUserMenu)}
                >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold ring-1 ring-[#333]">
                        {userEmail[0].toUpperCase()}
                    </div>

                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-medium text-white truncate">{userEmail.split('@')[0]}</div>
                            <div className="text-xs text-gray-500 truncate">{userEmail}</div>
                        </div>
                    )}
                </button>
            </div>
        </div>
    );
}
