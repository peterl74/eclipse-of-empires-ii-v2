
import React, { useState } from 'react';
import { Phase, Player, CitizenType, HexData, TileType, Resource } from '../types';
import { CITIZEN_INFO } from '../constants';
import { Scale, Hammer, Sword, Compass, Play, RotateCcw, X, SkipForward, Hourglass, Crown, RefreshCcw, Amphora, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';

interface ActionPanelProps {
  phase: Phase;
  player: Player;
  isMyTurn: boolean;
  activePlayerName?: string;
  onSelectCitizen: (c: CitizenType) => void;
  onAction: (action: string, payload?: any) => void;
  onEndPhase: () => void;
  map?: Record<string, HexData>; 
  isActionPhaseDone?: boolean;
  isEliminated?: boolean;
  isLastStand?: boolean;
  uiState: {
    isSelectingTile: boolean;
    isDeclaring: boolean;
    isProcessing: boolean;
  };
}

interface ModalWrapperProps {
  title: string;
  children: React.ReactNode;
  icon?: any;
  borderColor?: string;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({ title, children, icon: Icon, borderColor = "border-[#ca8a04]" }) => (
    // pointer-events-auto IS CRITICAL HERE to re-enable clicking inside the overlay
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 z-[100] animate-in fade-in zoom-in-95 duration-300 pointer-events-auto">
        <div className={`w-full max-w-lg bg-[#0f172a] border-2 ${borderColor} rounded-xl shadow-2xl overflow-hidden flex flex-col`}>
            <div className="bg-[#1e293b] p-4 border-b border-slate-700 flex items-center justify-center gap-3">
                {Icon && <Icon className="text-[#fcd34d]" size={24} />}
                <h2 className="text-[#fcd34d] font-title text-xl uppercase tracking-widest font-bold">{title}</h2>
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    </div>
);

const ActionBtn = ({ onClick, disabled, icon: Icon, label, subLabel, colorClass = "text-white", borderClass = "border-slate-600", isWarning = false }: any) => (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex flex-col items-center justify-center p-2 md:p-3 rounded-lg border-2 transition-all duration-200 w-24 shrink-0 pointer-events-auto
          ${disabled 
              ? 'bg-slate-900/80 border-slate-800 cursor-not-allowed' 
              : `bg-[#0f172a] hover:bg-[#1e293b] ${borderClass} hover:scale-105 shadow-lg cursor-pointer`
          }
      `}
    >
       <Icon size={20} className={`mb-1 transition-colors ${disabled ? 'text-slate-600' : colorClass}`} />
       <span className={`text-[10px] font-bold uppercase tracking-wider ${disabled ? 'text-slate-600' : 'text-slate-200'}`}>{label}</span>
       
       {/* Dynamic Sublabel: Turns RED if disabled due to cost */}
       {subLabel && (
           <span className={`text-[8px] mt-0.5 font-mono ${disabled && isWarning ? 'text-red-500 font-bold animate-pulse' : 'text-slate-500'}`}>
               {subLabel}
           </span>
       )}
    </button>
);

const ActionPanel: React.FC<ActionPanelProps> = ({ phase, player, isMyTurn, activePlayerName, onSelectCitizen, onAction, onEndPhase, map, isEliminated, isLastStand, uiState }) => {
  const [isReselecting, setIsReselecting] = useState(false);
  const hasRuins = map ? Object.values(map).some((h: HexData) => h.ownerId === player.id && h.type === TileType.Ruins) : false;
  const hasHiddenRelic = map ? Object.values(map).some((h: HexData) => h.ownerId === player.id && h.type === TileType.RelicSite && h.publicType !== TileType.RelicSite) : false;

  // --- PHASE 1: INCOME (CENTER MODAL) ---
  if (phase === Phase.Income) {
      return (
          <ModalWrapper title={isEliminated ? "Eliminated" : "Phase I: Income"} icon={RefreshCcw} borderColor={isEliminated ? 'border-red-500' : 'border-[#ca8a04]'}>
             <div className="text-center space-y-6">
                 <p className="text-slate-300 text-lg">
                     {isEliminated ? "Your empire has fallen." : "Resources have been collected from your lands."}
                 </p>
                 <button onClick={onEndPhase} className="w-full py-4 bg-[#ca8a04] hover:bg-[#eab308] text-black font-bold text-lg uppercase tracking-widest rounded transition-transform hover:scale-105 cursor-pointer">
                     Enter Council
                 </button>
             </div>
          </ModalWrapper>
      );
  }

  // --- PHASE 2: CITIZEN CHOICE (CENTER MODAL - ONE CLICK) ---
  if (phase === Phase.CitizenChoice || isReselecting) {
      return (
          <ModalWrapper title={isReselecting ? "Re-Assemble Council" : "Phase II: The Council"} icon={Crown}>
              <p className="text-slate-400 text-center text-sm mb-6 uppercase tracking-wide">
                  Select your specialist for this Eclipse.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-2">
                 {Object.values(CitizenType).map((cType) => {
                     const info = CITIZEN_INFO[cType];
                     let Icon = Scale;
                     if(cType === CitizenType.Builder) Icon = Hammer;
                     if(cType === CitizenType.Warrior) Icon = Sword;
                     if(cType === CitizenType.Explorer) Icon = Compass;

                     return (
                         <button 
                            key={cType}
                            onClick={() => {
                                onSelectCitizen(cType);
                                if (isReselecting) {
                                    setIsReselecting(false);
                                } else {
                                    onEndPhase(); // Immediate proceed
                                }
                            }}
                            className="p-4 rounded-lg border-2 border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-[#fcd34d] hover:scale-105 transition-all duration-200 flex flex-col items-center gap-2 group cursor-pointer shadow-lg pointer-events-auto"
                         >
                             <Icon size={32} color={info.color} className="group-hover:scale-110 transition-transform"/>
                             <span className="font-bold text-white uppercase tracking-wider text-sm">{cType}</span>
                             <span className="text-[10px] text-slate-500 text-center leading-tight group-hover:text-slate-300">{info.description}</span>
                         </button>
                     )
                 })}
              </div>
              
              {isReselecting && (
                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                      <button onClick={() => setIsReselecting(false)} className="w-full py-3 border border-slate-600 text-slate-400 font-bold uppercase rounded hover:bg-slate-800 cursor-pointer pointer-events-auto">
                          Cancel (Keep Current)
                      </button>
                  </div>
              )}
          </ModalWrapper>
      );
  }

  // --- PHASE 3: ACTION (FLOATING HUD - MOVED TO BOTTOM) ---
  if (phase === Phase.Action) {
      if (player.hasPassed || isEliminated) return null; 

      const role = player.selectedCitizen;
      
      // FATIGUE LOGIC:
      // If actionsTaken is 0, fatigue is 0.
      // If actionsTaken > 0, fatigue is 1 (Caps at 1 for now).
      const fatigue = player.actionsTaken > 0 ? 1 : 0;
      
      // --- COST CALCULATIONS ---
      // Explorer: Base 1 + Fatigue
      // FIX: Explorer now scales like Warrior (1st = 1 Grain, 2nd+ = 2 Grain)
      const expandCost = (player.actionsTaken === 0 ? 1 : 2) + fatigue;
      const hasExpandRes = player.resources.Grain >= expandCost;
      
      // Warrior: Base 1 (if first action) or 2 (if later) + Fatigue
      // Note: This means 2nd attack costs 3 Grain (2 base + 1 fatigue)
      const attackBase = player.actionsTaken === 0 ? 1 : 2;
      const attackCost = attackBase + fatigue;
      const hasAttackRes = player.resources.Grain >= attackCost;
      
      // Builder: Base 2 + Fatigue (unless Free)
      const isRelicFortifyFree = player.activeRelicPower === 'FREE_FORTIFY' && player.actionsTaken === 0;
      const isFreeFort = isRelicFortifyFree || player.status.freeFortify;
      const fortCost = isFreeFort ? 0 : (2 + fatigue);
      const hasFortRes = player.resources.Stone >= fortCost;

      // Merchant: Base 2 + Fatigue (unless Free)
      const tradeCost = 2 + fatigue;
      const hasFreeTrade = player.status.freeTrades > 0 || player.activeRelicPower === 'TRADE_BARON';
      const hasTradeRes = hasFreeTrade || player.resources.Grain >= tradeCost;

      // --- SUB-LABEL GENERATORS (Messages) ---
      const getAttackLabel = () => {
          if (!player.status.canAttack) return "Blocked";
          if (hasAttackRes) return `${attackCost} Grain`;
          return `Need ${attackCost} Grain`;
      };

      const getFortifyLabel = () => {
          if (isFreeFort) return "Free (Relic)";
          if (hasFortRes) return `${fortCost} Stone`;
          return `Need ${fortCost} Stone`;
      };

      const getExpandLabel = () => {
          if (hasExpandRes) return `${expandCost} Grain`;
          return `Need ${expandCost} Grain`;
      };

      const getTradeLabel = () => {
          if (hasFreeTrade) return "Free (Relic)";
          if (hasTradeRes) return `${tradeCost}Gr -> 1Gd`;
          return `Need ${tradeCost} Grain`;
      };

      // FLOATING HUD: MOVED TO BOTTOM-CENTER (bottom-8)
      // z-index 50 ensures it floats above map, pointer-events-none ensures the gap is clickable
      return (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center justify-end gap-4 z-50 pointer-events-none">
              
              {/* STATUS BANNER */}
              <div className={`pointer-events-auto px-6 py-2 rounded-full border shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-10
                  ${isMyTurn ? 'bg-[#0f172a] border-[#fcd34d] text-[#fcd34d]' : 'bg-slate-900 border-slate-700 text-slate-500'}
              `}>
                  <div className="flex items-center gap-2">
                      <Hourglass size={16} className={isMyTurn ? "animate-spin" : ""} />
                      <span className="text-xs font-bold uppercase tracking-widest">
                          {isMyTurn ? (isLastStand ? "FINAL STAND" : "YOUR TURN") : `${activePlayerName}'s Turn`}
                      </span>
                  </div>
                  {isMyTurn && (
                      <div className="w-px h-4 bg-slate-700 mx-1"></div>
                  )}
                  {isMyTurn && (
                      <button 
                          onClick={() => setIsReselecting(true)}
                          className="text-[10px] uppercase underline hover:text-white transition-colors cursor-pointer pointer-events-auto"
                      >
                          Role: {role}
                      </button>
                  )}
              </div>

              {/* ACTION BUTTONS */}
              {isMyTurn && (
                  <div className="pointer-events-auto flex items-center justify-center gap-2 p-2 rounded-xl bg-[#0f172a]/90 backdrop-blur border border-slate-700 shadow-2xl animate-in slide-in-from-bottom-2">
                      
                      {/* DYNAMIC ROLE BUTTONS */}
                      {role === CitizenType.Warrior && (
                          <ActionBtn 
                            onClick={() => onAction('WARRIOR_ATTACK')} 
                            disabled={!player.status.canAttack || !hasAttackRes} 
                            icon={Sword} 
                            label="Attack" 
                            subLabel={getAttackLabel()} 
                            isWarning={!hasAttackRes} // Triggers red text
                            colorClass="text-red-400" borderClass="border-red-500/50" 
                          />
                      )}
                      {role === CitizenType.Builder && (
                          <ActionBtn 
                            onClick={() => onAction('BUILD_FORTIFY')} 
                            disabled={!hasFortRes} 
                            icon={Hammer} 
                            label="Fortify" 
                            subLabel={getFortifyLabel()} 
                            isWarning={!hasFortRes}
                            colorClass="text-green-400" borderClass="border-green-500/50" 
                          />
                      )}
                      {role === CitizenType.Explorer && (
                          <ActionBtn 
                            onClick={() => onAction('EXPLORE_CLAIM')} 
                            disabled={!hasExpandRes} 
                            icon={Compass} 
                            label="Expand" 
                            subLabel={getExpandLabel()} 
                            isWarning={!hasExpandRes}
                            colorClass="text-blue-400" borderClass="border-blue-500/50" 
                          />
                      )}
                      {role === CitizenType.Merchant && (
                          <ActionBtn 
                            onClick={() => onAction('TRADE_BANK')} 
                            disabled={!hasTradeRes} 
                            icon={Scale} 
                            label="Sell Grain" 
                            subLabel={getTradeLabel()} 
                            isWarning={!hasTradeRes}
                            colorClass="text-amber-400" borderClass="border-amber-500/50" 
                          />
                      )}

                      {/* UTILITY ACTIONS */}
                      {hasHiddenRelic && (
                          <ActionBtn onClick={() => onAction('ACTIVATE_RELIC')} disabled={false} icon={CheckCircle} label="Unveil" subLabel="Relic" colorClass="text-emerald-400" borderClass="border-emerald-500/50" />
                      )}
                      
                      <div className="w-px h-8 bg-slate-700 mx-1"></div>

                      <ActionBtn onClick={() => onAction('OPEN_MARKET')} disabled={false} icon={RefreshCcw} label="Emerg. Swap" subLabel="3Any -> 1Gr" colorClass="text-purple-400" borderClass="border-purple-500/50" />
                      
                      <ActionBtn onClick={() => onAction('PASS')} disabled={false} icon={SkipForward} label="Pass" subLabel="End Round" colorClass="text-slate-300" borderClass="border-slate-500" />
                  </div>
              )}
          </div>
      );
  }

  // --- PHASE 4: EVENTS (CENTER MODAL) ---
  if (phase === Phase.Events) {
     return (
          <ModalWrapper title="Phase IV: Events" icon={Sparkles}>
             <div className="text-center py-4">
                 <Hourglass className="animate-spin text-[#fcd34d] mx-auto mb-4" size={32} />
                 <p className="text-slate-300">Resolving Global Events...</p>
             </div>
          </ModalWrapper>
     );
  }
  
  // --- PHASE 5: SCORING (CENTER MODAL) ---
  if (phase === Phase.Scoring) {
     return (
          <ModalWrapper title="Phase V: Scoring" icon={Crown}>
             <div className="text-center space-y-6">
                 <p className="text-slate-300 text-lg">Tallying Victory Points for this Eclipse.</p>
                 <button onClick={onEndPhase} className="w-full py-4 bg-[#ca8a04] hover:bg-[#eab308] text-black font-bold text-lg uppercase tracking-widest rounded transition-transform hover:scale-105 cursor-pointer flex items-center justify-center gap-2">
                     <RotateCcw size={20}/> Begin Next Eclipse
                 </button>
             </div>
          </ModalWrapper>
     );
  }

  return null;
};

export default ActionPanel;
