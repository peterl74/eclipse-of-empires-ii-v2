import React, { useState } from 'react';
import { EventCard, Resource } from '../types';
import { Sparkles, Check, ArrowRight } from 'lucide-react';
import ResourceIcon from './ResourceIcon';

interface EventModalProps {
  eventData: {
      card: EventCard;
      type: 'CHOICE' | 'INFO';
      amount: number;
      isRelicPowered: boolean;
      onComplete?: (choice?: Resource) => void;
  };
  onComplete: (choice?: Resource) => void;
}

const EventModal: React.FC<EventModalProps> = ({ eventData, onComplete }) => {
  const { card, type, isRelicPowered } = eventData;
  const [selectedChoice, setSelectedChoice] = useState<Resource | null>(null);

  const handleConfirm = () => {
      if (onComplete) {
          onComplete(selectedChoice || undefined);
      }
  };

  const effectText = isRelicPowered ? card.relicText : card.normalText;
  const isChoice = type === 'CHOICE';

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-[#0f172a] border-2 border-blue-500 w-full max-w-lg rounded-xl shadow-[0_0_50px_rgba(59,130,246,0.3)] relative flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5">
            
            {/* Header */}
            <div className="bg-[#1e293b] p-6 text-center border-b border-blue-900/50">
                <div className="mx-auto w-16 h-16 bg-blue-900/20 rounded-full flex items-center justify-center border border-blue-500/30 mb-4 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                    <Sparkles className="text-blue-400" size={32} />
                </div>
                <h2 className="text-blue-200 font-title text-2xl uppercase tracking-widest font-bold">{card.title}</h2>
                <p className="text-blue-400/60 text-xs uppercase tracking-wide mt-2">Global Event Triggered</p>
            </div>

            {/* Body */}
            <div className="p-8 bg-[#0b0a14] text-center space-y-6">
                 <div className={`p-4 rounded border ${isRelicPowered ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-800/50 border-slate-700'}`}>
                     <p className={`text-lg font-bold ${isRelicPowered ? 'text-emerald-400' : 'text-slate-200'}`}>
                         {effectText}
                     </p>
                     {isRelicPowered && <p className="text-[10px] uppercase tracking-widest text-emerald-600 mt-2">Relic Power Active</p>}
                 </div>

                 {isChoice && (
                     <div className="grid grid-cols-2 gap-4">
                         <button 
                            onClick={() => setSelectedChoice(Resource.Grain)}
                            className={`p-4 rounded border flex flex-col items-center gap-2 transition-all ${selectedChoice === Resource.Grain ? 'bg-yellow-900/40 border-yellow-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}
                         >
                             <ResourceIcon resource={Resource.Grain} size={24} />
                             <span className="text-sm font-bold text-slate-300">Grain</span>
                         </button>
                         <button 
                            onClick={() => setSelectedChoice(Resource.Gold)}
                            className={`p-4 rounded border flex flex-col items-center gap-2 transition-all ${selectedChoice === Resource.Gold ? 'bg-amber-900/40 border-amber-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}
                         >
                             <ResourceIcon resource={Resource.Gold} size={24} />
                             <span className="text-sm font-bold text-slate-300">Gold</span>
                         </button>
                     </div>
                 )}
            </div>

            {/* Footer */}
            <div className="bg-[#1e293b] p-4 border-t border-slate-800">
                 <button 
                    onClick={handleConfirm}
                    disabled={isChoice && !selectedChoice}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold uppercase tracking-widest rounded shadow-lg flex items-center justify-center gap-3 transition-all"
                 >
                     {isChoice ? 'Confirm Choice' : 'Continue'}
                     <ArrowRight size={18} />
                 </button>
            </div>

        </div>
    </div>
  );
};

export default EventModal;