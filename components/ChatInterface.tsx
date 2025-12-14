import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MoreVertical, ChevronLeft, Heart, Mic, Sparkles, Trash2, Phone } from 'lucide-react';
import { Message } from '../types';
import { geminiService } from '../services/geminiService';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { SettingsModal } from './SettingsModal';
import { CallOverlay } from './CallOverlay';

export const ChatInterface: React.FC = () => {
  // 1. Initialize state from LocalStorage if available
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('rose_chat_history');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
        }
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });

  const [input, setInput] = useState('');
  
  // Separate states for granular UI control
  const [isUserSending, setIsUserSending] = useState(false); // User is sending a message (block send button)
  const [isBotTyping, setIsBotTyping] = useState(false);     // Bot is thinking/typing (show indicator)
  
  const [isListening, setIsListening] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentVoice, setCurrentVoice] = useState('Zephyr');
  const [isCallActive, setIsCallActive] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // Ref to track if proactive logic should be aborted (e.g. user replied in the meantime)
  const abortProactiveRef = useRef(false);

  // 2. Persist messages to LocalStorage whenever they change
  useEffect(() => {
    localStorage.setItem('rose_chat_history', JSON.stringify(messages));
  }, [messages]);

  // 3. Initialize chat with history
  useEffect(() => {
    const initChat = async () => {
      try {
        // Convert UI messages to Gemini History format
        const historyForSdk = messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));

        await geminiService.startChat(historyForSdk);
        
        // Only show greeting if history is empty
        if (messages.length === 0) {
          const initialGreeting = geminiService.getInitialGreeting();
          setMessages([
            {
              id: 'init-1',
              role: 'model',
              text: initialGreeting,
              timestamp: new Date(),
            },
          ]);
        }
      } catch (e) {
        console.error("Failed to init chat", e);
      }
    };
    initChat();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Proactive Messaging Logic (Clingy Mode)
  useEffect(() => {
    // Reset abort flag on every dependency change (new message, etc)
    abortProactiveRef.current = false;

    // Conditions to NOT schedule a proactive message
    // If user is sending or listening, don't interrupt.
    if (isUserSending || isListening || isCallActive) return;
    
    // Safety check: Don't start if no messages (though init fills one)
    if (messages.length === 0) return;

    // Check consecutive bot messages
    let botMessageCount = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'model') botMessageCount++;
      else break;
    }
    
    // Safety Cap: Prevent infinite bill shock if tab is left open overnight.
    if (botMessageCount >= 10) return;

    // "Ye khud bi message kra" - Reduced timeout to 35 seconds for faster interaction
    const timeoutDuration = 35 * 1000; 

    const timer = setTimeout(async () => {
      // If component unmounted or dependencies changed (handled by cleanup), abort.
      if (abortProactiveRef.current || isUserSending || isCallActive) return;

      setIsBotTyping(true);

      // Fake typing delay for realism
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (abortProactiveRef.current || isUserSending || isCallActive) {
        setIsBotTyping(false);
        return;
      }

      try {
        const text = await geminiService.generateProactiveMessage();
        
        // Final check before updating state
        if (abortProactiveRef.current || isUserSending || isCallActive) {
           setIsBotTyping(false);
           return;
        }

        if (text) {
          const botMessage: Message = {
            id: Date.now().toString(),
            role: 'model',
            text: text,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
        }
      } catch (e) {
        console.error("Proactive message failed", e);
      } finally {
        // Only turn off typing if we haven't been interrupted by a user send
        if (!abortProactiveRef.current) {
            setIsBotTyping(false);
        }
      }
    }, timeoutDuration);

    // Cleanup function: If messages change (user sent one), this runs.
    return () => {
      abortProactiveRef.current = true; // Signal running async tasks to stop
      clearTimeout(timer);
    };
  }, [messages, isUserSending, isListening, isCallActive]);

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isBotTyping, isUserSending]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isUserSending) return;

    // Signal any pending proactive message to abort immediately
    abortProactiveRef.current = true;
    setIsBotTyping(false); // Force stop bot typing indicator if it was proactive

    const userText = input.trim();
    setInput('');
    setIsUserSending(true); // Lock send button
    setIsBotTyping(true);   // Show typing indicator immediately for reaction
    
    // Optimistic UI update
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);

    try {
      const responseText = await geminiService.sendMessage(userText);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error getting response:", error);
    } finally {
      setIsUserSending(false);
      setIsBotTyping(false);
      if (window.matchMedia('(min-width: 768px)').matches) {
          inputRef.current?.focus();
      }
    }
  }, [input, isUserSending]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!isUserSending) {
        handleSendMessage();
      }
      // If sending, do nothing (prevent double send)
    }
  };

  const handleVoiceInput = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice typing is not supported in this browser. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; 
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onend = () => {
        setIsListening(false);
        inputRef.current?.focus();
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setInput((prev) => {
            const separator = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
            return prev + separator + transcript;
        });
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening]);

  const clearChat = () => {
     if(confirm("Are you sure you want to clear our chat history? Rose will forget everything.")) {
         setMessages([]);
         localStorage.removeItem('rose_chat_history');
         window.location.reload(); // Quick reload to reset services
     }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-rose-50 relative overflow-hidden">
      
      {isCallActive && <CallOverlay onEndCall={() => setIsCallActive(false)} />}

      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        currentVoice={currentVoice}
        onVoiceChange={setCurrentVoice}
      />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md p-3 flex items-center justify-between shadow-sm sticky top-0 z-10 border-b border-rose-50 shrink-0">
        <div className="flex items-center gap-3">
          <button className="text-rose-500 p-1 hover:bg-rose-50 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-400 to-rose-600 flex items-center justify-center text-white shadow-md ring-2 ring-white">
               <span className="text-lg font-bold">R</span>
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-gray-800 text-sm flex items-center gap-1">
              Rose <Heart size={12} className="fill-rose-500 text-rose-500" />
            </h1>
            <span className="text-xs text-rose-400 font-medium">
              {isBotTyping ? 'Typing...' : 'Online'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-rose-500">
          <button 
            onClick={() => setIsCallActive(true)}
            className="p-2 hover:bg-rose-50 rounded-full transition-colors"
            title="Call Rose"
          >
            <Phone size={20} />
          </button>

          <button 
            onClick={clearChat}
            className="p-2 hover:bg-rose-50 rounded-full transition-colors"
            title="Clear Chat"
          >
            <Trash2 size={20} />
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-rose-50 rounded-full transition-colors"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-rose-50 to-white no-scrollbar">
        <div className="text-center text-xs text-gray-400 my-4 uppercase tracking-widest font-semibold opacity-60">
          Today
        </div>
        
        {messages.map((msg, index) => (
          <MessageBubble 
            key={msg.id} 
            message={msg} 
            isLast={index === messages.length - 1} 
            voiceName={currentVoice}
          />
        ))}

        {isBotTyping && (
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
             <TypingIndicator />
          </div>
        )}
        
        <div ref={messagesEndRef} className="h-2" />
      </main>

      {/* Input Area */}
      <footer className="p-3 bg-white border-t border-rose-50 sticky bottom-0 z-10 shrink-0 safe-area-bottom">
        <div className={`flex items-center gap-2 p-1.5 rounded-full border transition-all shadow-sm
            ${isListening 
                ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-100' 
                : 'bg-rose-50 border-rose-100 focus-within:ring-2 focus-within:ring-rose-200 focus-within:border-rose-300'
            }`}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isListening ? "Listening..." : "Message Rose..."}
            className="flex-1 bg-transparent px-4 py-2 text-sm text-gray-800 placeholder-rose-300 focus:outline-none"
            /* Enable input even when bot is thinking so user can type next msg */
            disabled={false} 
            autoComplete="off"
          />
          
          <button
            onClick={handleVoiceInput}
            disabled={isUserSending}
            className={`p-2 rounded-full transition-all duration-200 flex-shrink-0 relative overflow-hidden
              ${isListening 
                ? 'text-white bg-rose-500 shadow-md animate-pulse' 
                : 'text-rose-400 hover:bg-rose-100 hover:text-rose-600'
              } ${isUserSending ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isListening ? (
                <>
                    <Mic size={20} className="relative z-10" />
                    <span className="absolute inset-0 bg-rose-400 animate-ping opacity-75 rounded-full"></span>
                </>
            ) : (
                <Mic size={20} />
            )}
          </button>

          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isUserSending}
            className={`p-2.5 rounded-full text-white transition-all duration-200 shadow-md flex-shrink-0
              ${!input.trim() || isUserSending 
                ? 'bg-rose-300 cursor-not-allowed scale-95' 
                : 'bg-rose-500 hover:bg-rose-600 active:scale-90 hover:shadow-lg'
              }`}
          >
            <Send size={18} className={input.trim() && !isUserSending ? 'ml-0.5' : ''} />
          </button>
        </div>
        <div className="text-center mt-1.5 flex flex-col items-center justify-center gap-0.5">
             <span className="text-[10px] text-gray-300">End-to-end encrypted</span>
             <a 
               href="https://www.linkedin.com/in/syedtayyabdev" 
               target="_blank" 
               rel="noopener noreferrer"
               className="text-[10px] text-rose-300 hover:text-rose-500 font-medium transition-colors hover:underline decoration-rose-300/50 underline-offset-2"
             >
               Created by Syed Tayyab
             </a>
        </div>
      </footer>
    </div>
  );
};