import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Header } from './components/Header';
import { CodeBlock } from './components/CodeBlock';
import { Avatar } from './components/Avatars';
import { Speaker, Message, DebateTopic } from './types';
import { getDebates } from './services/db';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(3); // 1-5
  const [isThinking, setIsThinking] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<Speaker | null>(null);
  const [debateTopics, setDebateTopics] = useState<DebateTopic[]>([]);
  const [activeTopic, setActiveTopic] = useState<DebateTopic | null>(null);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [dbError, setDbError] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize DB and fetch topics
  useEffect(() => {
    const initData = async () => {
      try {
        const topics = await getDebates();
        if (topics.length > 0) {
          setDebateTopics(topics);
          setActiveTopic(topics[0]);
        }
      } catch (e) {
        console.error("Failed to load DB", e);
        setDbError("Failed to load database. Please ensure WASM is supported.");
      }
    };
    initData();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  // Execute a single turn of the debate
  const handleNextTurn = useCallback(() => {
    if (!activeTopic) return;
    const script = activeTopic.script;

    // Safety check to prevent out of bounds
    if (currentIndex >= script.length) {
      setIsPlaying(false);
      setCurrentSpeaker(null);
      return;
    }

    const nextMsg = script[currentIndex];
    setCurrentSpeaker(nextMsg.speaker);
    setIsThinking(true);

    // Calculate timings
    const typingTime = Math.max(1000, nextMsg.text.length * 15 * (1/speed)); 
    const interTurnDelay = 1500 * (1/speed);

    // 1. Simulate "Thinking/Typing" phase
    setTimeout(() => {
      setMessages(prev => [...prev, nextMsg]);
      setIsThinking(false);
      setCurrentIndex(prev => prev + 1);
      
      // 2. Add delay before the next turn starts
      if (currentIndex + 1 < script.length) {
         setTimeout(() => {
             setCurrentSpeaker(null); 
         }, interTurnDelay);
      } else {
         // End of conversation
         setIsPlaying(false);
         setCurrentSpeaker(null);
      }
    }, typingTime);

  }, [currentIndex, speed, activeTopic]);

  // Main Loop
  useEffect(() => {
    if (isPlaying && !isThinking && activeTopic && currentIndex < activeTopic.script.length && currentSpeaker === null) {
      handleNextTurn();
    }
  }, [isPlaying, isThinking, currentIndex, currentSpeaker, handleNextTurn, activeTopic]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleTopicSelect = (topic: DebateTopic) => {
    setActiveTopic(topic);
    setIsPlaying(false);
    setMessages([]);
    setCurrentIndex(0);
    setCurrentSpeaker(null);
    setIsTopicModalOpen(false);
  };

  if (!activeTopic && !dbError) {
    return <div className="flex h-screen items-center justify-center text-white bg-[#1A1D24]">Loading Database...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-[#1A1D24] text-[#E0E0E0] font-display overflow-hidden relative">
      <Header onOpenTopics={() => setIsTopicModalOpen(true)} />

      {/* Topic Selection Modal */}
      {isTopicModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#252932] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
               <h2 className="text-xl font-bold">Select Debate Topic</h2>
               <button onClick={() => setIsTopicModalOpen(false)} className="text-gray-400 hover:text-white">
                 <span className="material-symbols-outlined">close</span>
               </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
               {debateTopics.map(topic => (
                 <button 
                   key={topic.id}
                   onClick={() => handleTopicSelect(topic)}
                   className={`w-full text-left p-4 rounded-lg border transition-all flex flex-col gap-2 ${activeTopic?.id === topic.id ? 'bg-[#9F70FD]/10 border-[#9F70FD] ring-1 ring-[#9F70FD]' : 'bg-[#1A1D24] border-white/5 hover:border-white/20'}`}
                 >
                   <div className="flex items-center justify-between">
                     <span className="font-bold text-lg">{topic.title}</span>
                     {activeTopic?.id === topic.id && <span className="material-symbols-outlined text-[#9F70FD]">check_circle</span>}
                   </div>
                   <p className="text-sm text-[#9dabb9]">{topic.description}</p>
                 </button>
               ))}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-hidden relative z-0">
        
        {/* LEFT PANEL: Context & Controls */}
        <div className="flex flex-col bg-[#252932] rounded-xl shadow-lg overflow-hidden h-full border border-white/5">
          <div className="p-6 border-b border-white/5">
            <h1 className="text-2xl font-black leading-tight tracking-[-0.03em]">{activeTopic?.title || 'Debate'}</h1>
            <p className="text-[#9dabb9] text-base font-normal leading-normal mt-2">
              {activeTopic?.description}
            </p>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            <div>
              <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-[#9dabb9]">Context Code Snippet</h3>
              {activeTopic && <CodeBlock code={activeTopic.code} />}
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Controls</h3>
              <div className="space-y-6">
                <button 
                  onClick={togglePlay}
                  className={`w-full flex items-center justify-center gap-2 min-w-[84px] cursor-pointer rounded-lg h-12 px-4 ${isPlaying ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-[#9F70FD] text-white hover:bg-[#9F70FD]/90'} text-base font-bold transition-all`}
                >
                  <span className="material-symbols-outlined">{isPlaying ? 'pause' : 'play_arrow'}</span>
                  <span>{isPlaying ? 'Pause Debate' : 'Start Debate'}</span>
                </button>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm font-medium text-[#9dabb9]">
                    <label htmlFor="speed-control">Debate Speed</label>
                    <span>{speed}x</span>
                  </div>
                  <div className="flex items-center gap-4 text-[#9dabb9]">
                    <span className="material-symbols-outlined text-xl">tornado</span>
                    <input 
                      className="w-full h-2 bg-[#15171c] rounded-lg appearance-none cursor-pointer accent-[#9F70FD]" 
                      id="speed-control" 
                      max="5" 
                      min="1" 
                      step="0.5"
                      type="range" 
                      value={speed}
                      onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    />
                    <span className="material-symbols-outlined text-xl">rocket_launch</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Stage & Chat */}
        <div className="flex flex-col bg-[#252932] rounded-xl shadow-lg overflow-hidden h-full border border-white/5 relative">
          
          {/* Stage Area (Avatars) */}
          <div className="relative flex-none p-6 border-b border-white/5 flex justify-center items-center gap-8">
            <Avatar speaker={Speaker.Tutor} isActive={currentSpeaker === Speaker.Tutor} />
            <Avatar speaker={Speaker.Student} isActive={currentSpeaker === Speaker.Student} />
          </div>

          {/* Chat History */}
          <div ref={chatContainerRef} className="flex-1 p-6 space-y-6 overflow-y-auto scroll-smooth relative">
            {messages.length === 0 && (
               <div className="absolute inset-0 flex items-center justify-center text-[#9dabb9]/50 italic flex-col gap-2">
                  <span className="material-symbols-outlined text-4xl">forum</span>
                  <span>Press Start to begin the debate...</span>
               </div>
            )}

            {messages.map((msg) => {
              const isTutor = msg.speaker === Speaker.Tutor;
              return (
                <div key={msg.id} className={`flex items-start gap-4 max-w-xl message-enter ${isTutor ? '' : 'ml-auto justify-end'}`}>
                  {isTutor && (
                      <div className="w-8 h-8 rounded-full bg-[#4A90E2] flex items-center justify-center shrink-0 text-xs font-bold text-white shadow-lg">T</div>
                  )}
                  
                  <div className={`flex flex-col gap-1 ${isTutor ? 'items-start' : 'items-end'}`}>
                    <p className={`text-xs font-bold ${isTutor ? 'text-[#4A90E2]' : 'text-[#50E3C2]'}`}>{msg.speaker}</p>
                    <div className={`text-base font-normal leading-relaxed rounded-2xl px-5 py-3 shadow-md ${
                      isTutor 
                        ? 'rounded-tl-none bg-[#3d3f43] text-[#E0E0E0]' 
                        : 'rounded-tr-none bg-[#50E3C2]/90 text-[#101922]'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                  
                  {!isTutor && (
                      <div className="w-8 h-8 rounded-full bg-[#50E3C2] flex items-center justify-center shrink-0 text-xs font-bold text-black shadow-lg">S</div>
                  )}
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isThinking && (
              <div className={`flex items-start gap-4 max-w-xl ${currentSpeaker === Speaker.Student ? 'ml-auto justify-end' : ''}`}>
                 <div className={`flex flex-col gap-1 ${currentSpeaker === Speaker.Student ? 'items-end' : 'items-start'}`}>
                    <p className={`text-xs font-bold ${currentSpeaker === Speaker.Tutor ? 'text-[#4A90E2]' : 'text-[#50E3C2]'}`}>
                        {currentSpeaker} is thinking...
                    </p>
                    <div className={`text-base font-normal leading-normal rounded-2xl px-4 py-3 ${
                        currentSpeaker === Speaker.Tutor 
                          ? 'rounded-tl-none bg-[#3d3f43]' 
                          : 'rounded-tr-none bg-[#50E3C2]/20'
                      }`}>
                      <div className="flex items-center gap-2 h-6">
                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-pulse"></span>
                      </div>
                    </div>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/5 bg-[#252932]">
            <div className="relative">
              <input 
                className="w-full h-12 pl-4 pr-14 rounded-xl bg-[#1A1D24] border border-white/5 focus:ring-2 focus:ring-[#9F70FD] focus:border-transparent focus:outline-none transition-all text-[#E0E0E0] placeholder:text-[#9dabb9]" 
                placeholder="Add a prompt or ask a clarifying question..." 
                type="text"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center size-8 rounded-lg bg-[#9F70FD] text-white hover:bg-[#9F70FD]/90 transition-colors">
                <span className="material-symbols-outlined text-lg">send</span>
              </button>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
