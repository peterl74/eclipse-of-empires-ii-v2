import React from 'react';
import { Amphora, Sparkles, Search, ArrowRight } from 'lucide-react';

interface RuinsModalProps {
  isOpen: boolean;
  onScavenge: () => void;
  onIgnore: () => void;
}

const RuinsModal: React.FC<RuinsModalProps> = ({ isOpen, onScavenge, onIgnore }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[#0f172a] border border-purple-500 w-full max-w-md rounded-xl shadow-[0_0_50px_rgba(168,85,247,0.2)] relative flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Mysterious Header */}
        <div className="bg-[#1e293b] p-6 text-center border-b border-purple-900/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
            <div className="mx-auto w-16 h-16 bg-purple-900/20 rounded-full flex items-center justify-center border border-purple-500/30 mb-4 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                <Amphora className="text-purple-400" size={32} />
            </div>
            <h2 className="text-purple-200 font-title text-2xl uppercase tracking-widest font-bold">Ruins Discovered</h2>
            <p className="text-purple-400/60 text-xs uppercase tracking-wide mt-2">Precursor Signal Detected</p>
        </div>

        {/* Narrative Body */}
        <div className="p-8 bg-[#0b0a14] text-center space-y-4">
             <p className="text-slate-300 text-sm leading-relaxed italic">
                "The mist parts to reveal crumbling spires of an age long past. Within these walls lie secrets of the Old World... or perhaps just dust."
             </p>
             
             <div className="py-2 flex justify-center gap-2 text-xs text-slate-500 font-mono border-t border-slate-800/50 mt-4 pt-4">
                 <span className="flex items-center gap-1"><Search size={12}/> Scannable Object</span>
                 <span className="flex items-center gap-1"><Sparkles size={12}/> Event Trigger</span>
             </div>
        </div>

        {/* Action Footer */}
        <div className="bg-[#1e293b] p-4 border-t border-slate-800 flex flex-col gap-3">
             <button 
                onClick={onScavenge}
                className="w-full py-4 bg-purple-900/80 hover:bg-purple-800 border border-purple-500/50 hover:border-purple-400 text-purple-100 font-bold uppercase tracking-widest rounded shadow-lg flex items-center justify-center gap-3 transition-all group"
             >
                 <Sparkles size={18} className="group-hover:animate-spin" />
                 Scavenge Ruins
                 <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
             </button>
             
             <button 
                onClick={onIgnore}
                className="text-slate-600 hover:text-slate-400 text-[10px] uppercase tracking-widest transition-colors"
             >
                 Leave them be (Cancel)
             </button>
        </div>

      </div>
    </div>
  );
};

export default RuinsModal;