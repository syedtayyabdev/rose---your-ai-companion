import React from 'react';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center gap-1.5 px-5 py-3.5 bg-gradient-to-br from-white/95 to-rose-50/50 backdrop-blur-xl rounded-2xl rounded-tl-none shadow-[0_4px_12px_-2px_rgba(244,63,94,0.1)] border border-rose-100/60 animate-in fade-in zoom-in duration-300 select-none">
      <style>
        {`
          @keyframes fluid-bounce {
            0%, 100% {
              transform: translateY(0%);
              opacity: 0.4;
              transform: scale(0.8);
            }
            50% {
              transform: translateY(-25%);
              opacity: 1;
              transform: scale(1.1);
            }
          }
        `}
      </style>
      
      {/* Dot 1 */}
      <div 
        className="w-2 h-2 bg-rose-400 rounded-full shadow-[0_0_8px_rgba(251,113,133,0.4)]"
        style={{ 
          animation: 'fluid-bounce 1.4s infinite ease-in-out both',
          animationDelay: '0ms' 
        }}
      />
      
      {/* Dot 2 */}
      <div 
        className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.4)]"
        style={{ 
          animation: 'fluid-bounce 1.4s infinite ease-in-out both',
          animationDelay: '200ms' 
        }}
      />
      
      {/* Dot 3 */}
      <div 
        className="w-2 h-2 bg-rose-600 rounded-full shadow-[0_0_8px_rgba(225,29,72,0.4)]"
        style={{ 
          animation: 'fluid-bounce 1.4s infinite ease-in-out both',
          animationDelay: '400ms' 
        }}
      />
    </div>
  );
};