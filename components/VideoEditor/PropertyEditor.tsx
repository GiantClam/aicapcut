import React from 'react';
import { useEditor } from '../../contexts/EditorContext';
import { ItemType } from '../../types';
import { AlignLeft, Type, Video, Maximize, RotateCw, Trash2 } from 'lucide-react';

const PropertyEditor: React.FC = () => {
  const { project, selectedItemId, updateItem, deleteItem } = useEditor();

  // Find the selected item
  const selectedItem = React.useMemo(() => {
    if (!selectedItemId) return null;
    for (const track of project.tracks) {
      const item = track.items.find(i => i.id === selectedItemId);
      if (item) return item;
    }
    return null;
  }, [project, selectedItemId]);

  if (!selectedItem) {
    return (
      <div className="flex flex-col h-full bg-[#151515] border-l border-[#333] p-8 items-center justify-center text-gray-500">
        <p className="text-center text-sm">Select a clip on the timeline to edit properties</p>
      </div>
    );
  }

  const handleChange = (field: string, value: any, isStyle = false) => {
    if (isStyle) {
      updateItem(selectedItem.id, {
        style: { ...selectedItem.style, [field]: value }
      });
    } else {
      updateItem(selectedItem.id, { [field]: value });
    }
  };

  const handleDelete = () => {
      deleteItem(selectedItem.id);
  };

  return (
    <div className="flex flex-col h-full bg-[#151515] border-l border-[#333] overflow-y-auto">
      <div className="p-4 border-b border-[#333] bg-[#1e1e1e] flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          {selectedItem.type === ItemType.VIDEO && <Video size={16} />}
          {selectedItem.type === ItemType.TEXT && <Type size={16} />}
          Properties
        </h3>
        <button 
            onClick={handleDelete}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
            title="Delete Clip"
        >
            <Trash2 size={16} />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Common Properties */}
        <div className="space-y-3">
            <label className="text-xs font-medium text-gray-400 block">Name</label>
            <input 
                type="text" 
                value={selectedItem.name} 
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full bg-[#222] border border-[#333] rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
        </div>

        {/* Text Specific */}
        {selectedItem.type === ItemType.TEXT && (
           <div className="space-y-4 pt-2 border-t border-[#333]">
              <div>
                  <label className="text-xs font-medium text-gray-400 block mb-2">Text Content</label>
                  <textarea
                      value={selectedItem.content}
                      onChange={(e) => handleChange('content', e.target.value)}
                      rows={3}
                      className="w-full bg-[#222] border border-[#333] rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="text-xs font-medium text-gray-400 block mb-1">Size (px)</label>
                      <input 
                          type="number"
                          value={selectedItem.style?.fontSize || 24}
                          onChange={(e) => handleChange('fontSize', Number(e.target.value), true)}
                          className="w-full bg-[#222] border border-[#333] rounded px-2 py-1 text-sm text-white"
                      />
                  </div>
                  <div>
                      <label className="text-xs font-medium text-gray-400 block mb-1">Color</label>
                      <div className="flex gap-2">
                         <input 
                            type="color"
                            value={selectedItem.style?.color || '#ffffff'}
                            onChange={(e) => handleChange('color', e.target.value, true)}
                            className="h-8 w-8 rounded bg-transparent cursor-pointer"
                         />
                         <input 
                            type="text"
                            value={selectedItem.style?.color || '#ffffff'}
                            onChange={(e) => handleChange('color', e.target.value, true)}
                            className="flex-1 bg-[#222] border border-[#333] rounded px-2 text-sm text-white"
                         />
                      </div>
                  </div>
              </div>
           </div>
        )}

        {/* Visual Transform (Video/Image/Text) */}
        {(selectedItem.type !== ItemType.AUDIO) && (
            <div className="space-y-4 pt-2 border-t border-[#333]">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Transform</h4>
                
                {/* Scale */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Maximize size={10} /> Scale</span>
                        <span>{selectedItem.style?.scale || 100}%</span>
                    </div>
                    <input 
                        type="range" 
                        min="10" 
                        max="200" 
                        value={selectedItem.style?.scale || 100}
                        onChange={(e) => handleChange('scale', Number(e.target.value), true)}
                        className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                </div>

                {/* Position X */}
                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs text-gray-400 block mb-1">Position X (%)</label>
                        <input 
                            type="number"
                            value={selectedItem.style?.x || 50}
                            onChange={(e) => handleChange('x', Number(e.target.value), true)}
                            className="w-full bg-[#222] border border-[#333] rounded px-2 py-1 text-sm text-white"
                        />
                     </div>
                     <div>
                        <label className="text-xs text-gray-400 block mb-1">Position Y (%)</label>
                        <input 
                            type="number"
                            value={selectedItem.style?.y || 50}
                            onChange={(e) => handleChange('y', Number(e.target.value), true)}
                            className="w-full bg-[#222] border border-[#333] rounded px-2 py-1 text-sm text-white"
                        />
                     </div>
                </div>

                 {/* Rotation */}
                 <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1"><RotateCw size={10} /> Rotation</span>
                        <span>{selectedItem.style?.rotation || 0}°</span>
                    </div>
                    <input 
                        type="range" 
                        min="-180" 
                        max="180" 
                        value={selectedItem.style?.rotation || 0}
                        onChange={(e) => handleChange('rotation', Number(e.target.value), true)}
                        className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                </div>
                 {/* Opacity */}
                 <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>Opacity</span>
                        <span>{Math.round((selectedItem.style?.opacity ?? 1) * 100)}%</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.01"
                        value={selectedItem.style?.opacity ?? 1}
                        onChange={(e) => handleChange('opacity', Number(e.target.value), true)}
                        className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default PropertyEditor;