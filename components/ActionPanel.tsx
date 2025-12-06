import React, { useState } from 'react';
import { Phase, Player, CitizenType, HexData, TileType, Resource } from '../types';
import { CITIZEN_INFO } from '../constants';
import { Scale, Hammer, Sword, Compass, Play, RotateCcw, X, SkipForward, Hourglass, Crown, RefreshCcw, Amphora, CheckCircle, AlertTriangle, Sparkles, Radio } from 'lucide-react';

interface ModalWrapperProps {
  title: string;
  children: React.ReactNode;
  icon?: any;
  borderColor?: string;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({ title, children, icon: Icon, borderColor = "border-[#ca8a04]" }) => (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 z-[100] animate-in fade-in zoom-in-95 duration-300 pointer-events-auto">
        <div className={`w-full max-w-lg bg-[#0f172a] border-2 ${borderColor} rounded-xl shadow-2xl overflow-hidden flex flex-col`}>
            <div className="bg-[#1e293b] p-4 border-b border-slate-700 flex items-center justify-center gap-3">
                {Icon && <Icon className="text-[#fcd34d]" size={24} />}
                <h2 className="text-[#fcd34d] font-title text-xl uppercase tracking-widest font-bold">{title}</h2>
            </div>
            <div className="p-6">{children}</div>
        </div>
    </div>
);

const ActionBtn = ({ onClick, disabled, icon: Icon, label, subLabel, colorClass = "text-white", borderClass = "border-slate-600", isWarning = false, isReveal = false }: any) => (
    <button onClick={onClick} disabled={disabled} className={`group relative flex flex-col items-center justify-center p-2 md:p-3 rounded-lg border-2 transition-all duration-200 min-w-[80px] w-20 md:w-24 shrink-0 pointer-events-auto ${disabled ? 'bg-slate-900/80 border-slate-800 cursor-not-allowed' : `bg-[#0f172a] hover:bg-[#1e293b] ${isReveal ? 'border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : borderClass} hover:scale-105 shadow-lg cursor-pointer`}`}>
       <Icon size={20} className={`mb-1 transition-colors ${disabled ? 'text-slate-600' : (isReveal ? 'text-cyan-400 animate-pulse' : colorClass)}`} />
       <span className={`text-[9px] font-bold uppercase tracking-wider ${disabled ? 'text-slate-600' : (isReveal ? 'text-cyan-100' : 'text-slate-200')}`}>{label}</span>
       {subLabel && <span className={`text-[8px] mt-0.5 font-mono ${disabled && isWarning ? 'text-red-500 font-bold animate-pulse' : (isReveal ? 'text-cyan-500 font-bold' : 'text-slate-500')}`}>{subLabel}</span>}
    </button>
);

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
  uiState: any; 
}

const ActionPanel: React.FC<ActionPanelProps> = ({ phase, player, isMyTurn, activePlayerName, onSelectCitizen, onAction, onEndPhase, map, isEliminated, isLastStand, uiState }) => {
  if (!player) return null;
  const [isReselecting, setIsReselecting] = useState(false);

  if (phase === Phase.Income) return <ModalWrapper title={isEliminated ? "Eliminated" : "Phase I: Income"} icon={RefreshCcw} borderColor={isEliminated ? 'border-red-500' : 'border-[#ca8a04]'}><div className="text-center space-y-6"><p className="text-slate-300 text-lg">{isEliminated ? "Your empire has fallen." : "Resources have been collected from your lands."}</p><button onClick={onEndPhase} className="w-full py-4 bg-[#ca8a04] hover:bg-[#eab308] text-black font-bold text-lg uppercase tracking-widest rounded transition-transform hover:scale-105 cursor-pointer">Enter Council</button></div></ModalWrapper>;
  if (phase === Phase.CitizenChoice || isReselecting) return <ModalWrapper title={isReselecting ? "Re-Assemble Council" : "Phase II: The Council"} icon={Crown}><p className="text-slate-400 text-center text-sm mb-6 uppercase tracking-wide">Select your specialist for this Eclipse.</p><div className="grid grid-cols-2 gap-3 mb-2">{Object.values(CitizenType).map((cType) => { const info = CITIZEN_INFO[cType]; let Icon = Scale; if(cType === CitizenType.Builder) Icon = Hammer; if(cType === CitizenType.Warrior) Icon = Sword; if(cType === CitizenType.Explorer) Icon = Compass; return <button key={cType} onClick={() => { onSelectCitizen(cType); if (isReselecting) setIsReselecting(false); else onEndPhase(); }} className="p-4 rounded-lg border-2 border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-[#fcd34d] hover:scale-105 transition-all duration-200 flex flex-col items-center gap-2 group cursor-pointer shadow-lg pointer-events-auto"><Icon size={32} color={info.color} className="group-hover:scale-110 transition-transform"/><span className="font-bold text-white uppercase tracking-wider text-sm">{cType}</span><span className="text-[10px] text-slate-500 text-center leading-tight group-hover:text-slate-300">{info.description}</span></button> })}</div>{isReselecting && <div className="mt-4 pt-4 border-t border-slate-700/50"><button onClick={() => setIsReselecting(false)} className="w-full py-3 border border-slate-600 text-slate-400 font-bold uppercase rounded hover:bg-slate-800 cursor-pointer pointer-events-auto">Cancel (Keep Current)</button></div>}</ModalWrapper>;

  if (phase === Phase.Action) {
      if (player.hasPassed || isEliminated) return null; 
      const role = player.selectedCitizen;
      if (!role) return null;

      const fatigue = player.actionsTaken;
      const myHiddenTiles = map ? (Object.values(map) as HexData[]).filter(h => h.ownerId === player.id && !h.isRevealed).length : 0;
      const canPush = myHiddenTiles > 0 && fatigue > 0;

      const getTax = (reqRole: CitizenType) => role === reqRole ? 0 : 2; 
      
      const expandTax = getTax(CitizenType.Explorer);
      const expandCost = 1 + fatigue;
      const canAffordExpandFull = player.resources.Grain >= expandCost && player.resources.Gold >= expandTax;
      const canAffordExpandPush = canPush && player.resources.Grain >= 1 && player.resources.Gold >= expandTax;
      const hasExpandRes = canAffordExpandFull || canAffordExpandPush;
      
      const attackBase = player.actionsTaken === 0 ? 1 : 2;
      const attackTax = getTax(CitizenType.Warrior);
      const attackCost = attackBase + fatigue;
      const canAffordAttackFull = player.resources.Grain >= attackCost && player.resources.Gold >= attackTax;
      const canAffordAttackPush = canPush && player.resources.Grain >= attackBase && player.resources.Gold >= attackTax;
      const hasAttackRes = canAffordAttackFull || canAffordAttackPush;
      
      const buildTax = getTax(CitizenType.Builder);
      const isRelicFortifyFree = player.activeRelicPower === 'FREE_FORTIFY' && player.actionsTaken === 0;
      const isFreeFort = isRelicFortifyFree || player.status.freeFortify;
      const fortCost = isFreeFort ? 0 : (2 + fatigue);
      const canAffordFortFull = (isFreeFort || player.resources.Stone >= fortCost) && player.resources.Gold >= buildTax;
      const canAffordFortPush = !isFreeFort && canPush && player.resources.Stone >= 2 && player.resources.Gold >= buildTax;
      const hasFortRes = canAffordFortFull || canAffordFortPush;

      const tradeTax = getTax(CitizenType.Merchant);
      const tradeCost = 2 + fatigue;
      const hasFreeTrade = player.status.freeTrades > 0 || player.activeRelicPower === 'TRADE_BARON';
      const canAffordTradeFull = player.resources.Gold >= tradeTax && (hasFreeTrade || player.resources.Grain >= tradeCost);
      const canAffordTradePush = !hasFreeTrade && canPush && player.resources.Gold >= tradeTax && player.resources.Grain >= 2;
      const hasTradeRes = canAffordTradeFull || canAffordTradePush;

      const getCostLabel = (base: number, tax: number, fullAffordable: boolean, pushAffordable: boolean) => {
          if (fatigue > 0) {
              if (!fullAffordable && pushAffordable) return "Pay: Reveal Tile";
              return `${base} + ${fatigue}F` + (tax > 0 ? ` + ${tax}Gd` : "");
          }
          return `${base}` + (tax > 0 ? ` + ${tax}Gd` : "");
      };

      const isPushing = (fullAffordable: boolean, pushAffordable: boolean) => !fullAffordable && pushAffordable && fatigue > 0;

      return (
          <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center justify-end gap-2 md:gap-4 z-50 pointer-events-none w-full max-w-full">
              <div className={`pointer-events-auto px-4 md:px-6 py-2 rounded-full border shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-10 ${isMyTurn ? 'bg-[#0f172a] border-[#fcd34d] text-[#fcd34d]' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                  <div className="flex items-center gap-2"><Hourglass size={14} className={`md:w-4 md:h-4 ${isMyTurn ? "animate-spin" : ""}`} /><span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">{isMyTurn ? (isLastStand ? "FINAL STAND" : "YOUR TURN") : `${activePlayerName}'s Turn`}</span></div>
                  {isMyTurn && <><div className="w-px h-3 md:h-4 bg-slate-700 mx-1"></div><button onClick={() => setIsReselecting(true)} className="text-[10px] uppercase underline hover:text-white transition-colors cursor-pointer pointer-events-auto">Role: {role}</button></>}
              </div>
              {isMyTurn && (
                  <div className="pointer-events-auto flex items-center justify-start md:justify-center gap-2 p-2 rounded-xl bg-[#0f172a]/95 backdrop-blur border border-slate-700 shadow-2xl animate-in slide-in-from-bottom-2 max-w-[95vw] overflow-x-auto scrollbar-hide snap-x">
                      <ActionBtn onClick={() => onAction('WARRIOR_ATTACK')} disabled={!player.status.canAttack || !hasAttackRes} icon={Sword} label={attackTax ? "Merc. Attack" : "Attack"} subLabel={getCostLabel(attackBase, attackTax, canAffordAttackFull, canAffordAttackPush) + " Gr"} isWarning={!hasAttackRes} isReveal={isPushing(canAffordAttackFull, canAffordAttackPush)} colorClass="text-red-400" borderClass="border-red-500/50" />
                      <ActionBtn onClick={() => onAction('BUILD_FORTIFY')} disabled={!hasFortRes} icon={Hammer} label={buildTax ? "Merc. Fortify" : "Fortify"} subLabel={isFreeFort ? "Free" : getCostLabel(2, buildTax, canAffordFortFull, canAffordFortPush) + " St"} isWarning={!hasFortRes} isReveal={isPushing(canAffordFortFull, canAffordFortPush)} colorClass="text-green-400" borderClass="border-green-500/50" />
                      <ActionBtn onClick={() => onAction('EXPLORE_CLAIM')} disabled={!hasExpandRes} icon={Compass} label={expandTax ? "Merc. Expand" : "Expand"} subLabel={getCostLabel(1, expandTax, canAffordExpandFull, canAffordExpandPush) + " Gr"} isWarning={!hasExpandRes} isReveal={isPushing(canAffordExpandFull, canAffordExpandPush)} colorClass="text-blue-400" borderClass="border-blue-500/50" />
                      <ActionBtn onClick={() => onAction('TRADE_BANK')} disabled={!hasTradeRes} icon={Scale} label={tradeTax ? "Merc. Trade" : "Sell Grain"} subLabel={hasFreeTrade ? "Free" : getCostLabel(2, tradeTax, canAffordTradeFull, canAffordTradePush) + " Gr"} isWarning={!hasTradeRes} isReveal={isPushing(canAffordTradeFull, canAffordTradePush)} colorClass="text-amber-400" borderClass="border-amber-500/50" />
                      <div className="w-px h-8 bg-slate-700 mx-1 shrink-0"></div>
                      <ActionBtn onClick={() => onAction('OPEN_MARKET')} disabled={false} icon={RefreshCcw} label="Emerg. Swap" subLabel="3Any -> 1Gr" colorClass="text-purple-400" borderClass="border-purple-500/50" />
                      <ActionBtn onClick={() => onAction('PASS')} disabled={false} icon={SkipForward} label="Pass" subLabel="End Round" colorClass="text-slate-300" borderClass="border-slate-500" />
                  </div>
              )}
          </div>
      );
  }
  if (phase === Phase.Events) return <ModalWrapper title="Phase IV: Events" icon={Sparkles}><div className="text-center py-4"><Hourglass className="animate-spin text-[#fcd34d] mx-auto mb-4" size={32} /><p className="text-slate-300">Resolving Global Events...</p></div></ModalWrapper>;
  if (phase === Phase.Scoring) return <ModalWrapper title="Phase V: Scoring" icon={Crown}><div className="text-center space-y-6"><p className="text-slate-300 text-lg">Tallying Victory Points for this Eclipse.</p><button onClick={onEndPhase} className="w-full py-4 bg-[#ca8a04] hover:bg-[#eab308] text-black font-bold text-lg uppercase tracking-widest rounded transition-transform hover:scale-105 cursor-pointer flex items-center justify-center gap-2"><RotateCcw size={20}/> Begin Next Eclipse</button></div></ModalWrapper>;
  return null;
};

export default ActionPanel;