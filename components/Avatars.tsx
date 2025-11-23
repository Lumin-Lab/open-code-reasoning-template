import React from 'react';
import { Speaker } from '../types';

interface AvatarProps {
  speaker: Speaker;
  isActive: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ speaker, isActive }) => {
  const isTutor = speaker === Speaker.Tutor;
  const mainColor = isTutor ? 'bg-[#4A90E2]' : 'bg-[#50E3C2]';
  
  // Using green ring for active state to match the reference visual
  const ringColor = 'ring-green-500'; 
  const bgColor = isTutor ? 'bg-[#4A90E2]/10' : 'bg-[#50E3C2]/10';
  const icon = isActive ? 'volume_up' : 'volume_off';

  return (
    <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0">
      {/* Pulse Effect when Active */}
      <div className={`w-full h-full rounded-full ${bgColor} flex items-center justify-center transition-all duration-500 ${isActive ? `ring-4 ${ringColor}/50 animate-pulse` : ''}`}>
        
        {/* Head */}
        <div className={`relative w-24 h-24 sm:w-32 sm:h-32 rounded-full ${mainColor} flex flex-col items-center justify-center overflow-hidden shadow-lg border-4 border-white/50`}>
          
          {/* Hair/Hat Detail */}
          <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-3 bg-[#facc15] rounded-full ${isTutor ? 'rotate-[-15deg]' : '-top-2 w-16 h-4'}`}></div>

          {/* Eyes */}
          <div className="flex gap-4 z-10 mt-2">
             <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shadow-inner">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-slate-800"></div>
             </div>
             <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shadow-inner">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-slate-800"></div>
             </div>
          </div>

          {/* Mouth */}
          <div className="mt-4 w-10 h-5 sm:w-12 sm:h-6 bg-[#FFC0CB] rounded-b-full flex items-center justify-center overflow-hidden">
             <div 
               className={`w-6 h-3 sm:w-8 sm:h-4 bg-red-500 rounded-b-lg origin-bottom ${isActive ? 'animate-[speak_0.4s_infinite_alternate]' : ''}`}
             ></div>
          </div>

        </div>
      </div>

      {/* Status Icon */}
      <div className={`absolute bottom-2 right-2 size-8 sm:size-10 ${isActive ? 'bg-green-500' : 'bg-slate-400'} rounded-full flex items-center justify-center border-4 border-[#252932] transition-colors duration-300`}>
        <span className="material-symbols-outlined text-lg sm:text-xl text-white">{icon}</span>
      </div>
      
      {/* Name Tag */}
       <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-sm font-bold whitespace-nowrap ${isTutor ? 'text-[#4A90E2]' : 'text-[#50E3C2]'}`}>
          {isTutor ? 'Tutor AI' : 'Student AI'}
       </div>
    </div>
  );
};