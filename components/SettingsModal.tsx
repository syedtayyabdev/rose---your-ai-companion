import React from 'react';
import { X, Check, Volume2, Sparkles, Mic2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVoice: string;
  onVoiceChange: (voice: string) => void;
}

const VOICES = [
  { id: 'Zephyr', name: 'Zephyr', description: 'Soft, breathy, & soothing (Default)', color: 'bg-rose-100 text-rose-600' },
  { id: 'Aoede', name: 'Aoede', description: 'Confident, expressive, & articulate', color: 'bg-emerald-100 text-emerald-600' },
  { id: 'Kore', name: 'Kore', description: 'Warm, motherly, & gentle', color: 'bg-orange-100 text-orange-600' },
  { id: 'Puck', name: 'Puck', description: 'Playful, energetic, & witty', color: 'bg-blue-100 text-blue-600' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Deep, intense, & strong', color: 'bg-slate-100 text-slate-600' },
  { id: 'Charon', name: 'Charon', description: 'Low, calm, & steady', color: 'bg-gray-100 text-gray-600' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  currentVoice, 
  onVoiceChange 
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 animate-in slide-in-from-bottom-10 duration-300 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Sparkles size={18} className="text-rose-500" />
            Voice Settings
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 shrink-0">Select Rose's Voice</p>
        
        <div className="space-y-3 overflow-y-auto no-scrollbar pr-1 flex-1 min-h-0 pb-2">
          {VOICES.map((voice) => {
            const isSelected = currentVoice === voice.id;
            return (
              <button
                key={voice.id}
                onClick={() => onVoiceChange(voice.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden
                  ${isSelected 
                    ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-500' 
                    : 'border-gray-100 hover:border-rose-200 hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${voice.color} ${isSelected ? 'shadow-sm' : ''}`}>
                    {isSelected ? <Mic2 size={20} /> : <Volume2 size={20} />}
                  </div>
                  <div className="text-left">
                    <p className={`font-semibold text-sm ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                      {voice.name}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {voice.description}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <div className="bg-rose-500 text-white p-1 rounded-full animate-in zoom-in duration-200 shrink-0 relative z-10">
                    <Check size={14} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="text-center mt-4 pt-4 border-t border-gray-100 shrink-0">
           <p className="text-[10px] text-gray-400">
             Voice updates will apply to the next call.
           </p>
        </div>
      </div>
    </div>
  );
};