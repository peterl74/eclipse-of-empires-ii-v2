import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Zap, Box, Users, Skull, AlertTriangle, Coins, Target } from 'lucide-react';

interface WelcomeModalProps {
  onClose: () => void;
  forceShow?: boolean;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ onClose, forceShow = false }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // If forceShow is true, ignore localStorage and show it
    if (forceShow) {
      setIsVisible(true);
      return;
    }

    // Otherwise, check localStorage
    const hasSeen = localStorage.getItem('eoe_welcome_seen');
    if (!hasSeen) {
      setIsVisible(true);
    }
  }, [forceShow]);

  const handleClose = () => {
    localStorage.setItem('eoe_welcome_seen', 'true');
    setIsVisible(false);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="bg-[#0f172a] border border-[#ca8a04] w-full max-w-2xl max-h-[90vh] rounded-lg shadow-2xl relative flex flex-col animate-in slide-in-from-bottom-10">
        
        {/* Close X Button */}
        <button 
            onClick={handleClose}
            className="absolute top-2 right-2 z-50 p-2 bg-black/50 hover:bg-black/80 text-slate-400 hover:text-white rounded-full transition-colors"
        >
            <X size={20} />
        </button>

        {/* Header */}
        <div className="bg-[#1e293b] p-6 border-b border-slate-700 text-center relative shrink-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(202,138,4,0.15),_transparent_70%)]" />
            <h2 className="text-[#fcd34d] font-title text-3xl font-bold uppercase tracking-widest relative z-10">
                Welcome to the Eclipse
            </h2>
            <p className="text-slate-400 text-xs uppercase tracking-wide mt-2 relative z-10">
                Digital Companion Edition v2.5 (Warlord Update)
            </p>
        </div>

        {/* Content - Scrollable */}
        <div className="p-8 bg-[#0b0a14] space-y-6 text-[#e2d9c5] overflow-y-auto custom-scrollbar flex-1">
            <p className="text-sm leading-relaxed text-slate-300 text-center">
                Your empire awaits. The fog is thick, the stakes are high, and Gold grants ultimate tactical freedom.
            </p>

            <div className="grid grid-cols-1 gap-4">
                
                {/* Feature 1: Mercenary Contracts */}
                <div className="flex gap-4 p-3 bg-amber-900/10 border border-amber-500/30 rounded-lg items-start">
                    <div className="p-2 bg-amber-900/20 rounded border border-amber-500/30 shrink-0">
                        <Coins className="text-amber-400" size={18} />
                    </div>
                    <div>
                        <h4 className="text-amber-200 font-bold text-sm uppercase mb-1">Mercenary Contracts (Gold Tax)</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Your role defines efficiency, but **Gold is Agency**. You can perform **ANY action** (Attack ⚔️, Build 🔨, Expand 🧭) regardless of your chosen Citizen Role by paying a **Mercenary Tax of 2 Gold**.
                        </p>
                    </div>
                </div>

                {/* Feature 2: Adrenaline System */}
                <div className="flex gap-4 p-3 bg-green-900/10 border border-green-500/30 rounded-lg items-start">
                    <div className="p-2 bg-green-900/20 rounded border border-green-500/30 shrink-0">
                        <Zap className="text-green-400" size={18} />
                    </div>
                    <div>
                        <h4 className="text-green-200 font-bold text-sm uppercase mb-1">Adrenaline System (Fatigue Fix)</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Your armies are energized. The **first two actions** you take each round are performed at **Standard Cost** (no Fatigue penalty). Only the **third action and beyond** incurs extra cost.
                        </p>
                    </div>
                </div>
                
                {/* Feature 3: Trap Mechanic */}
                <div className="flex gap-4 p-3 bg-purple-900/10 border border-purple-500/30 rounded-lg items-start">
                    <div className="p-2 bg-purple-900/20 rounded border border-purple-500/30 shrink-0">
                        <AlertTriangle className="text-purple-400" size={18} />
                    </div>
                    <div>
                        <h4 className="text-purple-200 font-bold text-sm uppercase mb-1">Weaponized Bluffing (The Trap)</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            You can declare a tile a **Trap** on claim. If an enemy attempts to Attack ⚔️ the Trap, their attack fails, and they suffer **-2 Grain damage**.
                        </p>
                    </div>
                </div>
                
                {/* Feature 4: Challenge Modes */}
                <div className="flex gap-4 p-3 bg-red-900/10 border border-red-500/30 rounded-lg items-start">
                    <div className="p-2 bg-red-900/20 rounded border border-red-500/30 shrink-0">
                        <Skull className="text-red-400" size={18} />
                    </div>
                    <div>
                        <h4 className="text-red-200 font-bold text-sm uppercase mb-1">Challenge Mode vs. Casual Mode</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Choose your risk: **Standard Mode** punishes false accusations with a **Turn Lost** penalty, while **Casual Mode** uses a fine of **2 Gold**.
                        </p>
                    </div>
                </div>
                
            </div>
            
            {/* Instructional Guidance for Beginners (NEW SECTION) */}
            <div className="walkthrough-section" style="margin-top: 20px; border-top: 1px dashed #475569;">
                <h4 class="text-slate-500 font-bold text-xs uppercase tracking-widest pt-4 mb-2">GUIDANCE: YOUR FIRST TURN</h4>
                <p class="text-xs text-slate-300">
                    1. **Income:** Every Capital (⭐) produces 1 Grain, 1 Stone, and 1 Gold. Collect this secretly first.
                </p>
                <p class="text-xs text-slate-300">
                    2. **First Choice:** Choose the **Explorer 🧭** role in the Council Phase. Expanding early is the fastest way to grow your income base.
                </p>
                <p class="text-xs text-slate-300">
                    3. **First Action:** Immediately use the Explorer action to claim an adjacent tile, converting your starting Grain into potential long-term income.
                </p>
            </div>

            {/* Tabletop Plug */}
            <div className="mt-6 p-4 border border-[#ca8a04]/30 bg-[#ca8a04]/10 rounded flex items-center gap-4">
                <Box size={24} className="text-[#fcd34d] shrink-0" />
                <div className="text-xs">
                    <span className="text-[#fcd34d] font-bold uppercase block mb-1">Tabletop Play: Remember the Ultimate Lie</span>
                    <span className="text-slate-300">
                        The digital companion uses automated banking, but in the **Tabletop Edition**, you can commit **Financial Fraud** by lying to the bank itself!
                    </span>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="bg-[#1e293b] p-6 border-t border-slate-700 flex justify-center shrink-0">
             <button 
                onClick={handleClose}
                className="w-full px-12 py-3 bg-[#ca8a04] hover:bg-[#eab308] text-black font-bold uppercase tracking-widest rounded shadow-lg transition-transform hover:scale-105 text-base"
             >
                 Enter the Eclipse
             </button>
        </div>

      </div>
    </div>
  );
};

export default WelcomeModal;
