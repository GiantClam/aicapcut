import React, { useRef } from 'react';
import { useEditor } from '../../contexts/EditorContext';
import { Upload, Image as ImageIcon, Video, Music } from 'lucide-react';
import { Asset, ItemType } from '../../types';

const AssetLibrary: React.FC = () => {
  const { assets, addAsset } = useEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate upload by creating a local object URL
    const url = URL.createObjectURL(file);
    let type = ItemType.VIDEO;
    
    if (file.type.startsWith('image/')) type = ItemType.IMAGE;
    else if (file.type.startsWith('audio/')) type = ItemType.AUDIO;

    const newAsset: Asset = {
      id: `asset-${Date.now()}`,
      type,
      name: file.name,
      url,
      // Simple thumbnail generation is hard without processing, so we assume generic icon or use url for img
      thumbnail: type === ItemType.IMAGE ? url : undefined 
    };

    addAsset(newAsset);
  };

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex flex-col h-full bg-[#151515] border-r border-[#333]">
      <div className="p-4 border-b border-[#333]">
        <h3 className="text-white font-semibold mb-4">Assets</h3>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-[#333] hover:bg-[#444] text-white py-2 rounded-md flex items-center justify-center gap-2 transition-colors border border-[#555] border-dashed"
        >
          <Upload size={16} />
          <span>Import Media</span>
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*,video/*,audio/*"
          onChange={handleFileUpload}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-3">
          {assets.map(asset => (
            <div 
              key={asset.id}
              draggable
              onDragStart={(e) => handleDragStart(e, asset)}
              className="group relative aspect-square bg-[#222] rounded-lg overflow-hidden border border-transparent hover:border-blue-500 cursor-grab active:cursor-grabbing"
            >
              {asset.type === ItemType.IMAGE || (asset.type === ItemType.VIDEO && asset.thumbnail) ? (
                <img src={asset.thumbnail || asset.url} alt={asset.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  {asset.type === ItemType.VIDEO && <Video size={24} />}
                  {asset.type === ItemType.AUDIO && <Music size={24} />}
                </div>
              )}
              
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                <span className="text-xs text-white truncate">{asset.name}</span>
                <span className="text-[10px] text-gray-400 uppercase">{asset.type}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AssetLibrary;