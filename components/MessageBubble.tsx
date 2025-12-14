import React, { useState } from 'react';
import { Message } from '../types';
import { Heart, Volume2, Loader2, Copy, Check, Share2 } from 'lucide-react';
import { ttsService } from '../services/ttsService';

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
  voiceName: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isLast, voiceName }) => {
  const isUser = message.role === 'user';
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isShared, setIsShared] = useState(false);

  const handlePlayAudio = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    await ttsService.speak(message.text, voiceName);
    setIsPlaying(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          text: message.text,
        });
      } else {
        await navigator.clipboard.writeText(message.text);
      }
      setIsShared(true);
      setTimeout(() => setIsShared(false), 2000);
    } catch (err) {
      // User cancelled share or error
      console.log('Share action cancelled or failed:', err);
    }
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex max-w-[80%] md:max-w-[70%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Avatar / Name */}
        {!isUser && isLast && (
           <span className="text-xs text-rose-500 mb-1 ml-1 font-medium flex items-center gap-1">
             Rose <Heart size={10} className="fill-rose-500" />
           </span>
        )}

        <div className="relative group">
            <div
            className={`px-5 py-3 rounded-2xl shadow-sm text-[15px] leading-relaxed break-words relative 
                ${isUser 
                ? 'bg-rose-500 text-white rounded-tr-none' 
                : 'bg-white text-gray-800 border border-rose-100 rounded-tl-none'
                }`}
            >
            {message.text}
            </div>

            {/* Actions (Only for Rose's messages) */}
            {!isUser && (
                <div className="absolute left-full top-0 h-full flex items-center pl-2 gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {/* TTS Button */}
                    <button 
                        onClick={handlePlayAudio}
                        disabled={isPlaying}
                        className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
                        title="Read aloud"
                    >
                        {isPlaying ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                    </button>

                    {/* Copy Button */}
                    <button 
                        onClick={handleCopy}
                        className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
                        title="Copy text"
                    >
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>

                    {/* Share Button */}
                    <button 
                        onClick={handleShare}
                        className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
                        title="Share message"
                    >
                        {isShared ? <Check size={14} /> : <Share2 size={14} />}
                    </button>
                </div>
            )}
        </div>
        
        <span className={`text-[10px] mt-1 text-gray-400 ${isUser ? 'mr-1' : 'ml-1'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};