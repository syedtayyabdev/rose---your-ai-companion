import React, { useEffect, useState, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Signal, Volume2 } from 'lucide-react';
import { liveService } from '../services/liveService';

interface CallOverlayProps {
  onEndCall: () => void;
}

const WaveformVisualizer = ({ isSpeaking, volume }: { isSpeaking: boolean, volume: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const volumeRef = useRef(volume);
  const speakingRef = useRef(isSpeaking);
  // Smooth volume transition state
  const smoothedVolumeRef = useRef(0);

  // Sync refs with props for the animation loop
  useEffect(() => {
    volumeRef.current = volume;
    speakingRef.current = isSpeaking;
  }, [volume, isSpeaking]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      // Handle High DPI displays
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      // Only resize if dimensions change to avoid clearing unnecessarily
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.scale(dpr, dpr);
      }
      
      const width = rect.width;
      const height = rect.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);
      
      // Smooth out volume changes (Linear Interpolation)
      const targetVolume = speakingRef.current ? volumeRef.current : 0;
      smoothedVolumeRef.current += (targetVolume - smoothedVolumeRef.current) * 0.1;
      
      // Base amplitude: subtle idle breathing (0.1) + dynamic volume boost
      const amplitude = 0.1 + (smoothedVolumeRef.current * 0.8);

      // We draw 3 overlapping sine waves with different phases/colors for a rich effect
      const lines = [
        { color: 'rgba(244, 63, 94, 0.3)', speed: 0.05, freq: 1.2 }, // Faint background
        { color: 'rgba(251, 113, 133, 0.5)', speed: 0.07, freq: 1.5 }, // Mid tone
        { color: 'rgba(225, 29, 72, 1)', speed: 0.09, freq: 2.0 }     // Main contour
      ];

      lines.forEach((line) => {
        ctx.beginPath();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        
        for (let x = 0; x <= width; x += 3) {
           // Normalized X (-1 to 1) for window function
           const nx = (x / width) * 2 - 1;
           // Window function (taper ends to 0) to keep wave centered
           const window = 1 - Math.pow(nx, 2);
           
           // Wave calculation: sin(frequency + phase) * amplitude * window
           const y = centerY + Math.sin(x * 0.015 * line.freq + phase * line.speed) * (height * 0.45) * amplitude * window;
           
           if (x === 0) ctx.moveTo(x, y);
           else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      phase += 0.15; // Animation speed
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export const CallOverlay: React.FC<CallOverlayProps> = ({ onEndCall }) => {
  const [duration, setDuration] = useState(0);
  const [userVolume, setUserVolume] = useState(0);
  const [roseVolume, setRoseVolume] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isRoseSpeaking, setIsRoseSpeaking] = useState(false);
  const [status, setStatus] = useState('Connecting...');

  // Effect 1: Handle Call Duration Timer independently
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Effect 2: Handle Live Session Lifecycle
  useEffect(() => {
    const startCall = async () => {
      try {
        await liveService.startSession();
        setStatus('Rose is listening...');
      } catch (error: any) {
        console.error(error);
        const errObj = error?.message ? error.message : "Unknown Error";
        setStatus(`Error: ${errObj.substring(0, 20)}...`);
        // Allow user to see error for a bit longer
        setTimeout(onEndCall, 4000);
      }
    };
    startCall();

    // Event Listeners
    liveService.onVolumeChange = (vol) => {
      setUserVolume(Math.min(vol * 5, 1));
    };

    liveService.onOutputVolumeChange = (vol) => {
      setRoseVolume(vol);
    };
    
    liveService.onIsSpeakingChange = (speaking) => {
        setIsRoseSpeaking(speaking);
        if (speaking) setStatus('Rose is speaking...');
        else setStatus('Rose is listening...');
    };

    liveService.onDisconnect = () => {
        onEndCall();
    };

    return () => {
      liveService.stopSession();
    };
  }, [onEndCall]);

  const toggleMute = () => {
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);
      liveService.setMute(newMuteState);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-between bg-white/95 backdrop-blur-xl animate-in fade-in duration-500 overflow-hidden">
      
      {/* Dynamic Background with Fluid Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top Right - Rose Tone */}
        <div 
            className={`absolute -top-20 -right-20 w-96 h-96 bg-rose-200 rounded-full blur-3xl mix-blend-multiply opacity-50 animate-blob transition-all duration-1000 ${isRoseSpeaking ? 'bg-rose-300 opacity-70 scale-110' : ''}`}
        ></div>
        
        {/* Bottom Left - Purple Tone */}
        <div 
            className={`absolute -bottom-20 -left-20 w-96 h-96 bg-purple-100 rounded-full blur-3xl mix-blend-multiply opacity-50 animate-blob transition-all duration-1000 ${isRoseSpeaking ? 'bg-purple-200 opacity-70 scale-110' : ''}`}
            style={{ animationDelay: '2s' }}
        ></div>
      </div>

      {/* Header Info */}
      <div className="relative z-10 w-full pt-12 pb-6 flex flex-col items-center space-y-3">
        <div className="flex items-center gap-2 text-rose-500/80 bg-rose-50/50 px-3 py-1 rounded-full border border-rose-100/50 backdrop-blur-md shadow-sm max-w-[80%]">
            <Signal size={14} className={status.includes('Error') ? 'text-red-500' : 'animate-pulse'} />
            <span className="text-xs font-medium tracking-wide uppercase truncate">{status}</span>
        </div>
        
        {/* Enhanced Duration Display */}
        <div className="text-rose-900 text-lg font-mono tracking-widest font-bold bg-white/70 px-6 py-2 rounded-full backdrop-blur-md border border-rose-200 shadow-sm transition-all">
            {formatTime(duration)}
        </div>
      </div>

      {/* Main Visual Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full space-y-12">
        
        {/* Avatar Container */}
        <div className="relative group">
            {/* Pulsing Aura based on volume */}
            <div 
                className={`absolute inset-0 bg-rose-400 rounded-full blur-xl opacity-20 transition-all duration-75`}
                style={{ transform: `scale(${1 + roseVolume * 0.8})` }}
            ></div>

            {/* Profile Picture */}
            <div className="relative w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-rose-300 via-rose-100 to-white shadow-2xl">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white relative overflow-hidden ring-4 ring-white">
                    <span className="text-5xl font-bold select-none">R</span>
                    {/* Glossy sheen */}
                    <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-full"></div>
                </div>
                
                {/* Status Dot */}
                <div className={`absolute bottom-2 right-2 w-5 h-5 border-4 border-white rounded-full transition-colors duration-300 ${status === 'Connecting...' ? 'bg-yellow-400' : (status.includes('Error') ? 'bg-red-500' : 'bg-green-500')}`}></div>
            </div>
        </div>

        {/* Canvas Waveform Visualizer */}
        <div className="w-full h-32 px-4 flex items-center justify-center">
            <WaveformVisualizer isSpeaking={isRoseSpeaking} volume={roseVolume} />
        </div>

        {/* User Volume Indicator (Subtle) */}
        <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
             <Mic size={14} className={isMuted ? 'text-gray-300' : 'text-rose-400'} />
             <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
                 <div 
                    className="h-full bg-rose-400 rounded-full transition-all duration-100"
                    style={{ width: `${userVolume * 100}%` }}
                 ></div>
             </div>
        </div>

      </div>

      {/* Footer Controls */}
      <div className="relative z-10 w-full pb-10 px-8">
        <div className="flex items-center justify-center gap-8">
            
            {/* Mute Button */}
            <button 
                onClick={toggleMute}
                className={`p-4 rounded-full shadow-lg backdrop-blur-md border transition-all duration-200 ${isMuted ? 'bg-white text-gray-800 border-gray-200' : 'bg-white/80 text-gray-600 border-white/50 hover:bg-white'}`}
            >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            {/* End Call Button */}
            <button 
                onClick={onEndCall}
                className="p-6 bg-red-500 text-white rounded-full shadow-xl hover:bg-red-600 hover:scale-105 active:scale-95 transition-all duration-200 ring-4 ring-red-100"
            >
                <PhoneOff size={32} />
            </button>

            {/* Speaker Button (Visual Only for now) */}
            <button className="p-4 rounded-full bg-white/80 text-gray-600 shadow-lg backdrop-blur-md border border-white/50 hover:bg-white transition-all duration-200">
                <Volume2 size={24} />
            </button>
        </div>
        <p className="text-center text-rose-300/60 text-xs mt-6 font-medium">End-to-end encrypted</p>
      </div>
    </div>
  );
};