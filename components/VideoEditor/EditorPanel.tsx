import React from 'react';
import Player from './Player';
import Timeline from './Timeline';
import AssetLibrary from './AssetLibrary';
import PropertyEditor from './PropertyEditor';
import { Download, Share2 } from 'lucide-react';
import { useEditor } from '../../contexts/EditorContext';

const EditorPanel: React.FC = () => {
  const { project } = useEditor();

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${project.name.replace(/\s+/g, '_')}_timeline.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    alert('Timeline JSON exported!');
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#000]">
      {/* Top Bar */}
      <div className="h-12 bg-[#1e1e1e] border-b border-[#333] flex items-center justify-between px-6 shrink-0 z-30">
        <div className="flex items-center gap-2">
          <h1 className="text-white font-bold text-lg bg-gradient-to-r from-indigo-500 to-blue-500 bg-clip-text text-transparent">AutoViralVid</h1>
          <span className="text-gray-500 text-sm">/</span>
          <span className="text-gray-300 text-sm font-medium truncate max-w-[200px]">{project.name}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Top Section: Assets | Player | Properties */}
        <div className="h-[60%] flex border-b border-[#333]">
          {/* Assets Panel */}
          <div className="w-[300px] shrink-0 border-r border-[#333]">
            <AssetLibrary />
          </div>

          {/* Player - Flexible Center */}
          <div className="flex-1 min-w-0">
            <Player />
          </div>

          {/* Properties Panel */}
          <div className="w-[300px] shrink-0 border-l border-[#333]">
            <PropertyEditor />
          </div>
        </div>

        {/* Bottom Section: Timeline */}
        <div className="h-[40%] min-h-[200px]">
          <Timeline />
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;