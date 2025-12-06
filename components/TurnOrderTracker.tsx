import React from 'react';
import { Player } from '../types';
import { User, Check, XCircle, ArrowRight, Skull } from 'lucide-react';

interface TurnOrderTrackerProps {
  players: Player[];
  turnOrder: number[];
  turnOrderIndex: number;
}

const TurnOrderTracker: React.FC<TurnOrderTrackerProps> = ({ players, turnOrder, turnOrderIndex }) => {
  const activePlayerId = turnOrder[turnOrderIndex];

  return (
    <div className="flex items-center gap-2 md:gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-full px-3 py-1 md:px-4 md:py-2 shadow-lg max-w-full overflow-x-auto scrollbar-hide">
      <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mr-1 md:mr-2 border-r border-slate-700 pr-2 md:pr-4">TURN</h3>
      <div className="flex items-center gap-1 md:gap-2">
        {turnOrder.map((playerId, index) => {
          const player = players.find(p => p.id === playerId);
          if (!player) return null;

          const isActive = player.id === activePlayerId;
          const isHuman = player.isHuman;
          const isPassed = player.hasPassed;
          const isEliminated = player.isEliminated;
          const initial = player.faction.name.split(' ').map(n => n[0]).join('').substring(0, 2);

          return (
            <React.Fragment key={player.id}>
              <div 
                className="flex flex-col items-center gap-0.5 md:gap-1 relative"
                title={isEliminated ? `${player.name} (Eliminated)` : isPassed ? `${player.name} (Passed)` : player.name}
              >
                  {/* Avatar Circle */}
                  <div
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-xs md:text-sm relative transition-all duration-300 border-2 shrink-0
                      ${isActive 
                        ? 'border-yellow-400 ring-4 ring-yellow-400/30 scale-110 z-10 shadow-[0_0_20px_rgba(250,204,21,0.6)] animate-pulse' 
                        : isEliminated
                           ? 'border-red-800 bg-black scale-90 grayscale'
                           : isPassed 
                               ? 'border-slate-700 bg-slate-800 scale-90 opacity-50' 
                               : 'border-slate-600 opacity-80'
                      }`}
                    style={{ 
                      backgroundColor: isActive ? player.faction.color : (isEliminated ? '#111827' : isPassed ? '#1e293b' : player.faction.color),
                      color: isEliminated ? '#ef4444' : (isPassed ? '#64748b' : player.faction.textColor),
                    }}
                  >
                    {isHuman ? <User size={14} className="md:w-[18px] md:h-[18px]" /> : initial}
                    
                    {/* Status Indicators */}
                    {isEliminated ? (
                       <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full">
                         <Skull size={16} className="text-red-500 md:w-5 md:h-5" />
                       </div>
                    ) : isPassed && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                         <XCircle size={16} className="text-slate-500 md:w-5 md:h-5" />
                      </div>
                    )}
                  </div>

                  {/* Order Label - Hidden on very small screens if not active */}
                  <span className={`text-[8px] md:text-[9px] font-mono font-bold uppercase tracking-wider hidden sm:block
                     ${isActive ? 'text-yellow-400 block' : isEliminated ? 'text-red-500' : isPassed ? 'text-slate-600' : 'text-slate-400'}
                  `}>
                      {isActive ? 'ACTIVE' : (isEliminated ? 'DEAD' : isPassed ? 'PASS' : `#${index + 1}`)}
                  </span>
              </div>

              {index < turnOrder.length - 1 && (
                <ArrowRight size={12} className={`mx-0.5 md:mx-1 ${isActive ? 'text-yellow-500' : 'text-slate-700'} md:w-4 md:h-4`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default TurnOrderTracker;