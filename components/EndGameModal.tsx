import React from 'react';
import { Player, GameState, HexData } from '../types';
import { calculateScore } from '../logic/gameHelpers';
import { Crown, RotateCcw, Trophy, Map, Shield, Landmark } from 'lucide-react';

interface EndGameModalProps {
  players: Player[];
  map: Record<string, HexData>;
  publicObjectives: any[];
  onRestart: () => void;
}

const EndGameModal: React.FC<EndGameModalProps> = ({ players, map, publicObjectives, onRestart }) => {
  // Calculate final scores
  const rankedPlayers = players.map(p => {
      const score = calculateScore(p, map, publicObjectives);
      return { ...p, score };
  }).sort((a, b) => b.score.total - a.score.total);

  const winner = rankedPlayers[0];

  return (
    <div className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-1000">
      <div className="bg-[#0f172a] border-2 border-[#ca8a04] w-full max-w-4xl rounded-xl shadow-[0_0_100px_rgba(202,138,4,0.3)] relative flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#1e293b] p-8 text-center border-b border-[#ca8a04]/30">
            <div className="inline-block p-3 bg-black/40 rounded-full border border-[#fcd34d] mb-4 shadow-xl">
                <Crown size={48} className="text-[#fcd34d]" />
            </div>
            <h1 className="text-4xl md:text-5xl font-title font-bold text-transparent bg-clip-text bg-gradient-to-b from-[#fcd34d] to-[#b45309] tracking-widest uppercase mb-2">
                Imperial Victory
            </h1>
            <p className="text-slate-400 text-sm uppercase tracking-[0.3em]">
                The Age of Eclipse has Ended
            </p>
        </div>

        {/* Content */}
        <div className="flex-1 bg-[#0b0a14] p-6 md:p-8 overflow-y-auto custom-scrollbar">
            
            {/* Winner Spotlight */}
            <div className="flex flex-col items-center justify-center mb-10 animate-in slide-in-from-bottom-5 delay-300">
                <div className="text-sm text-slate-500 uppercase tracking-widest mb-2">New Emperor</div>
                <div className="text-3xl font-bold text-white mb-1" style={{ color: winner.faction.color }}>{winner.name}</div>
                <div className="text-lg text-slate-400 italic">"{winner.faction.title}"</div>
                <div className="mt-4 text-6xl font-title font-bold text-[#fcd34d] drop-shadow-lg">{winner.score.total} <span className="text-lg align-top opacity-50">VP</span></div>
            </div>

            {/* Scoreboard */}
            <div className="space-y-3">
                {rankedPlayers.map((p, idx) => (
                    <div key={p.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 100}ms` }}>
                        <div className="flex items-center gap-4 w-full md:w-1/3">
                            <div className="font-mono text-2xl font-bold text-slate-600">#{idx + 1}</div>
                            <div>
                                <div className="font-bold text-lg" style={{ color: p.faction.color }}>{p.name}</div>
                                <div className="text-xs text-slate-500 uppercase">{p.isHuman ? "Human Player" : "AI Rival"}</div>
                            </div>
                        </div>

                        <div className="flex gap-6 text-xs text-slate-400 w-full md:w-1/2 justify-center">
                            <div className="flex flex-col items-center">
                                <Map size={16} className="mb-1 text-blue-400"/>
                                <span>{p.score.breakdown.tileVp} Tile</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <Shield size={16} className="mb-1 text-green-400"/>
                                <span>{p.score.breakdown.fortVp} Fort</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <Landmark size={16} className="mb-1 text-emerald-400"/>
                                <span>{p.score.breakdown.relicVp} Relic</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <Trophy size={16} className="mb-1 text-amber-400"/>
                                <span>{p.score.breakdown.totalObjVp} Obj</span>
                            </div>
                        </div>

                        <div className="text-2xl font-bold text-white w-full md:w-1/6 text-right">
                            {p.score.total} VP
                        </div>
                    </div>
                ))}
            </div>

        </div>

        {/* Footer */}
        <div className="bg-[#1e293b] p-6 border-t border-slate-700 flex justify-center">
             <button 
                onClick={onRestart}
                className="px-8 py-4 bg-[#ca8a04] hover:bg-[#eab308] text-black font-bold uppercase tracking-widest rounded shadow-lg transition-transform hover:scale-105 flex items-center gap-3"
             >
                 <RotateCcw size={20} /> Play Again
             </button>
        </div>

      </div>
    </div>
  );
};

export default EndGameModal;