import React, { useState, useEffect, useRef } from 'react';
import { GameState, Phase, Player, Resource, LogEntry, TileType, HexData, CitizenType, EventCard, SecretObjective, RelicPowerType, AiState, PendingChallenge, TraitType } from './types';
import { generateMap, getHexId, getNeighbors, isAdjacent } from './utils/hexUtils';
import { FACTIONS, TOTAL_ROUNDS, EVENTS_DECK, OBJECTIVES_DECK, TILE_CONFIG, VP_CONFIG, FACTION_TRAITS, AI_DIALOGUE, RESOURCE_COLORS } from './constants';
import HexGrid from './components/HexGrid';
import ActionPanel from './components/ActionPanel';
import HelpModal from './components/HelpModal';
import MarketModal from './components/MarketModal';
import ChallengeModal from './components/ChallengeModal';
import DeclarationModal from './components/DeclarationModal';
import TurnOrderTracker from './components/TurnOrderTracker';
import SplashScreen from './components/SplashScreen';
import SimulationOverlay from './components/SimulationOverlay';
import WelcomeModal from './components/WelcomeModal';
import SimulationRunner from './components/SimulationRunner';
import ResourceIcon from './components/ResourceIcon';
import RuinsModal from './components/RuinsModal';
import EventModal from './components/EventModal';
import EndGameModal from './components/EndGameModal';
import { useGameEngine } from './hooks/useGameEngine';
import { Eye, Trophy, Target, Zap, X, BookOpen, Info, Sword, Hammer, Beaker, FlaskConical, AlertTriangle, Handshake, Activity, Skull, Crown, Shield, MapPin, Search, Users, VenetianMask, Settings, Sparkles, Scroll, BarChart3, Crosshair, Radio, Menu } from 'lucide-react';
import { calculateScore, getIncomeRate, drawCardHelper, calculateFatigue, updatePlayerStat, updateMaxResources } from './logic/gameHelpers';

interface TileMenuState {
  hexId: string;
  screenPosition: { x: number, y: number }; 
  actions: { 
      label: string; 
      cost?: string; 
      variant: 'primary' | 'danger' | 'success' | 'neutral';
      handler: () => void; 
  }[];
}

const renderTileTooltip = (hoveredHexId: string | null, map: Record<string, HexData>, players: Player[]) => {
    if (!hoveredHexId || !map[hoveredHexId]) return null;
    const hex = map[hoveredHexId];
    const owner = hex.ownerId !== null ? players[hex.ownerId] : null;
    
    const isUnknown = hex.ownerId === null && !hex.isRevealed;
    const typeLabel = isUnknown ? "Unexplored Sector" : TILE_CONFIG[hex.publicType].label;
    const showTrueType = hex.ownerId === 0 || (players[0] && players[0].isEliminated);
    const isPubliclyRevealed = hex.isRevealed && hex.ownerId !== null;

    return (
        <div className="absolute top-4 left-4 z-50 bg-slate-900/95 border border-slate-600 p-3 rounded-lg shadow-xl backdrop-blur pointer-events-none animate-in fade-in slide-in-from-left-2 w-64 hidden md:block">
            <div className="flex items-center gap-2 mb-2 border-b border-slate-700 pb-2">
                <MapPin size={16} className="text-[#fcd34d]" />
                <span className="font-bold text-slate-200 text-sm">Sector [{hex.diceCoords.col}, {hex.diceCoords.row}]</span>
            </div>
            <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                    <span className="text-slate-400 flex items-center gap-1"><Users size={12}/> Owner:</span>
                    {owner ? <span className="font-bold" style={{ color: owner.faction.color }}>{owner.name}</span> : <span className="text-slate-500 italic">Unclaimed</span>}
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-slate-400 flex items-center gap-1"><Search size={12}/> Terrain:</span>
                    <div className="text-right">
                        <div className={`font-bold ${isUnknown ? 'text-slate-500 italic' : 'text-white'}`}>{typeLabel}</div>
                        {isPubliclyRevealed && (
                            <div className="text-[10px] text-cyan-400 flex items-center gap-1 justify-end font-bold"><Radio size={10}/> (PUBLIC KNOWLEDGE)</div>
                        )}
                        {showTrueType && !isUnknown && hex.publicType !== hex.type && (
                            <div className="text-[10px] text-purple-400 flex items-center gap-1 justify-end"><VenetianMask size={10}/> (Real: {TILE_CONFIG[hex.type].label})</div>
                        )}
                    </div>
                </div>
                {hex.fortification && (
                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-800">
                        <span className="text-green-400 flex items-center gap-1"><Shield size={12}/> Fortified</span>
                        <span className="text-green-400 font-bold">Lvl {hex.fortification.level}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const { 
    gameState, setGameState, gameStarted, setGameStarted, startGame, handleHumanAction, 
    setIsCasualMode, setIsChallengeMode, isCasualMode, isChallengeMode, 
    advanceTurn, resolvingEvent, setResolvingEvent,
    handlePhaseTransition, executeAiAction, handleRevealPay, resolveMapAction,
    handleChallengeResponse, applyEventEffect, calculateFatigue, addLog,
    handleHumanDeclaration 
  } = useGameEngine();

  const [showSplash, setShowSplash] = useState(true);
  const [showSim, setShowSim] = useState(false);
  const [showStrategyLab, setShowStrategyLab] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [hoveredHexId, setHoveredHexId] = useState<string | null>(null);
  const [showRuinsModal, setShowRuinsModal] = useState(false);
  const [pendingRuinId, setPendingRuinId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [activeTileMenu, setActiveTileMenu] = useState<TileMenuState | null>(null);
  const [activeTab, setActiveTab] = useState<'LOG' | 'GOALS' | 'INTEL'>('LOG');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
      if (activeTab === 'LOG') {
          logEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
  }, [gameState.logs.length, activeTab]);

  useEffect(() => {
      if (!gameStarted) return;

      if (gameState.phase === Phase.Action) {
          const activeId = gameState.turnOrder[gameState.turnOrderIndex];
          const activePlayer = gameState.players[activeId];
          if (!activePlayer) return;

          const activePlayersList = gameState.players.filter(p => !p.isEliminated);
          if (activePlayersList.every(p => p.hasPassed)) {
               const timer = setTimeout(() => handlePhaseTransition(), 1000);
               return () => clearTimeout(timer);
          }

          if (activePlayer.hasPassed || activePlayer.isEliminated) {
              const timer = setTimeout(() => advanceTurn(), 500);
              return () => clearTimeout(timer);
          }

          if (!activePlayer.isHuman && !gameState.pendingChallenge && !gameState.uiState.isProcessing) {
              const timer = setTimeout(() => executeAiAction(activeId), 1500); 
              return () => clearTimeout(timer);
          }
      }

      if (gameState.phase === Phase.Events && !resolvingEvent) {
          const timer = setTimeout(() => {
             const { card, newDeck, newDiscard, reshuffled } = drawCardHelper(gameState.eventDeck, gameState.discardPile);
             
             const p = gameState.players[0];
             const hasRelic = p.resources.Relic > 0 || p.activeRelicPower !== null;

             setResolvingEvent({ 
                 card, 
                 type: card.id === 'e1' ? 'CHOICE' : 'INFO', 
                 amount: 0, 
                 isRelicPowered: hasRelic, 
                 onComplete: (choice) => {
                     applyEventEffect(card, choice, hasRelic); 
                     setGameState(prev => ({ ...prev, eventDeck: newDeck, discardPile: newDiscard, activeEvent: card }));
                     handlePhaseTransition();
                     setResolvingEvent(null);
                 } 
             });
          }, 1000);
          return () => clearTimeout(timer);
      }
  }, [gameState.phase, gameState.turnOrderIndex, gameState.turnTrigger, gameStarted, gameState.pendingChallenge?.isActive, resolvingEvent]);

    const executeScavenge = () => {
        if (!gameState || !gameState.uiState || !pendingRuinId) return;

        const player = gameState.players[0];
        const cost = 1 + player.actionsTaken; 
        const isMerc = player.selectedCitizen !== CitizenType.Explorer;
        const costGold = isMerc ? 2 : 0;

        if (player.resources.Grain < cost || player.resources.Gold < costGold) {
            setShowRuinsModal(false);
            return;
        }

        setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isProcessing: true } }));
        const { card, newDeck, newDiscard } = drawCardHelper(gameState.eventDeck, gameState.discardPile);

        setGameState(prev => {
            const acquiredVP = prev.map[pendingRuinId].type === TileType.RelicSite ? 2 : 1; 

            const ps = prev.players.map(p => p.id === 0 ? { 
                ...p, 
                resources: { ...p.resources, Grain: p.resources.Grain - cost, Gold: p.resources.Gold - costGold }, 
                actionsTaken: p.actionsTaken + 1,
                vp: p.vp + acquiredVP 
            } : p);
            const nm = { ...prev.map };
            
            nm[pendingRuinId] = { 
                ...nm[pendingRuinId], 
                type: TileType.Plains, 
                publicType: TileType.Plains, 
                isRevealed: true, 
                ownerId: player.id 
            };

            const logs = [...prev.logs, { id: Date.now().toString(), turn: prev.round, text: `Ruins Scavenged: Found ${card.title}. (Gained ${acquiredVP} VP)`, type: 'event' as const }];
            return { ...prev, players: ps, map: nm, logs, eventDeck: newDeck, discardPile: newDiscard };
        });

        setShowRuinsModal(false);
        setPendingRuinId(null);

        setResolvingEvent({ 
            card, 
            type: card.id === 'e1' ? 'CHOICE' : 'INFO', 
            amount: card.id === 'e1' ? 2 : 0, 
            isRelicPowered: false, 
            onComplete: (choice) => {
                applyEventEffect(card, choice);
                advanceTurn();
                setResolvingEvent(null);
            }
        });
    };

  const handleHexClick = (hexId: string) => {
      if (gameState.uiState.isProcessing) return;
      
      if (activeTileMenu) {
          setActiveTileMenu(null);
          return;
      }

      if (gameState.uiState.isSelectingRevealCost) {
          handleRevealPay(hexId);
          return;
      }

      const hex = gameState.map[hexId];
      const p = gameState.players[0];
      if (!p || p.isEliminated) return;

      if (gameState.uiState.isSelectingTile && gameState.uiState.actionType) {
          if (gameState.uiState.actionType === 'EXPLORE') {
               const myTiles = (Object.values(gameState.map) as HexData[]).filter(h => h.ownerId === 0);
               if (hex.type === TileType.Ruins && hex.ownerId === null && myTiles.some(t => isAdjacent(t, hex))) {
                   setPendingRuinId(hexId);
                   setShowRuinsModal(true);
                   return;
               }
          }
          if (gameState.uiState.actionType === 'CLAIM') {
               const myTiles = (Object.values(gameState.map) as HexData[]).filter(h => h.ownerId === 0);
               if (hex.ownerId === null && myTiles.some(t => isAdjacent(t, hex))) {
                   if (gameState.uiState.isPushingLimits) {
                        setGameState(prev => ({
                            ...prev,
                            uiState: {
                                ...prev.uiState,
                                isSelectingTile: false,
                                isSelectingRevealCost: true,
                                pendingHexId: hexId,
                                actionType: null
                            }
                        }));
                        return;
                   }

                   setGameState(prev => ({
                       ...prev,
                       uiState: { ...prev.uiState, isSelectingTile: false, isDeclaring: true, pendingHexId: hexId, actionType: null }
                   }));
                   return;
               }
          }
          
          if ((gameState.uiState.actionType === 'ATTACK' || gameState.uiState.actionType === 'FORTIFY') && gameState.uiState.isPushingLimits) {
               setGameState(prev => ({
                   ...prev,
                   uiState: {
                       ...prev.uiState,
                       isSelectingTile: false,
                       isSelectingRevealCost: true,
                       pendingActionAfterReveal: { action: gameState.uiState.actionType, target: hexId },
                       actionType: null
                   }
               }));
               return;
          }
          
          resolveMapAction(hexId);
      }
  };

  const humanPlayer = gameState.players[0];

  const formatLogText = (text: string) => {
      const parts = text.split(/([+-]?\d+ |Grain|Gold|Stone|Relic|VP|Victory Points)/g);
      return parts.map((part, i) => {
          const trimmed = part.trim();
          if (trimmed === 'Grain') return <span key={i} className="text-yellow-500 font-bold">{part}</span>;
          if (trimmed === 'Gold') return <span key={i} className="text-amber-400 font-bold">{part}</span>;
          if (trimmed === 'Stone') return <span key={i} className="text-slate-400 font-bold">{part}</span>;
          if (trimmed === 'Relic') return <span key={i} className="text-emerald-400 font-bold">{part}</span>;
          if (part.match(/^[+-]\d+ $/)) {
              const isPositive = part.startsWith('+');
              return <span key={i} className={`font-mono font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>{part}</span>;
          }
          if (part.match(/^\d+ $/)) return <span key={i} className="text-white font-mono font-bold">{part}</span>;
          return <span key={i} className="text-slate-300">{part}</span>;
      });
  };

  // Reusable Sidebar Content for Desktop & Mobile
  const renderSidebarContent = () => (
      <>
          <div className="flex border-b border-slate-700 bg-[#0b0a14] shrink-0">
              <button 
                onClick={() => setActiveTab('LOG')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1 ${activeTab === 'LOG' ? 'text-[#fcd34d] bg-[#1e293b] border-b-2 border-[#fcd34d]' : 'text-slate-500 hover:text-slate-300'}`}
              >
                  <Scroll size={12}/> Comms
              </button>
              <button 
                onClick={() => setActiveTab('GOALS')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1 ${activeTab === 'GOALS' ? 'text-[#fcd34d] bg-[#1e293b] border-b-2 border-[#fcd34d]' : 'text-slate-500 hover:text-slate-300'}`}
              >
                  <Crosshair size={12}/> Goals
              </button>
              <button 
                onClick={() => setActiveTab('INTEL')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1 ${activeTab === 'INTEL' ? 'text-[#fcd34d] bg-[#1e293b] border-b-2 border-[#fcd34d]' : 'text-slate-500 hover:text-slate-300'}`}
              >
                  <BarChart3 size={12}/> Intel
              </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-[#0b0a14]">
              {activeTab === 'LOG' && (
                <div className="p-4 space-y-3">
                    {gameState.logs.map((log) => {
                        const actor = log.actorId !== undefined ? gameState.players[log.actorId] : null;
                        return (
                            <div key={log.id} className={`p-3 rounded text-xs leading-relaxed animate-in slide-in-from-left-2 shadow-sm relative overflow-hidden
                                ${log.type === 'combat' ? 'bg-red-950/40 border-l-4 border-red-500 text-red-100' : 
                                  log.type === 'event' ? 'bg-purple-950/40 border-l-4 border-purple-500 text-purple-100' : 
                                  log.type === 'bluff' ? 'bg-amber-950/40 border-l-4 border-amber-500 text-amber-100' : 
                                  log.type === 'phase' ? 'bg-[#1e293b] border-y border-slate-600 text-slate-200 font-bold uppercase text-center py-2 my-4 tracking-widest' : 
                                  log.type === 'alert' ? 'bg-orange-950/40 border-l-4 border-orange-500 text-orange-100 font-bold' :
                                  'bg-slate-800/50 border-l-4 border-slate-600'}`}>
                                
                                {log.type !== 'phase' && (
                                    <div className="flex justify-between items-center mb-1 border-b border-white/10 pb-1">
                                        <div className="flex items-center gap-2">
                                            {actor && (
                                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: actor.faction.color}}></div>
                                            )}
                                            <span className="font-bold text-[10px] uppercase tracking-wide opacity-80" style={{color: actor?.faction.color || '#94a3b8'}}>
                                                {actor ? actor.name : 'System'}
                                            </span>
                                        </div>
                                        <span className="text-[9px] text-slate-500 font-mono">Turn {log.turn}</span>
                                    </div>
                                )}
                                <div className={log.type === 'combat' ? 'text-red-100' : 'text-slate-300'}>
                                    {formatLogText(log.text)}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={logEndRef} />
                </div>
              )}

              {activeTab === 'GOALS' && humanPlayer && (
                  <div className="p-4 space-y-6">
                      <div>
                          <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3 border-b border-slate-800 pb-1">Secret Directives</h3>
                          <div className="space-y-3">
                              {humanPlayer.secretObjectives.map(obj => {
                                  const isComplete = obj.condition(humanPlayer, gameState.map);
                                  return (
                                      <div key={obj.id} className={`p-3 rounded border ${isComplete ? 'bg-emerald-950/20 border-emerald-500/50' : 'bg-slate-900 border-slate-700'}`}>
                                          <div className="flex justify-between items-start mb-1">
                                              <span className={`font-bold text-sm ${isComplete ? 'text-emerald-400' : 'text-slate-200'}`}>{obj.name}</span>
                                              <span className="text-xs font-mono bg-black/40 px-1.5 py-0.5 rounded text-[#fcd34d]">{obj.vp} VP</span>
                                          </div>
                                          <p className="text-xs text-slate-400 mb-2">{obj.description}</p>
                                          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider">
                                              <span className="text-slate-500">Progress</span>
                                              <span className={isComplete ? 'text-emerald-500 font-bold' : 'text-slate-400'}>{obj.progress(humanPlayer, gameState.map)}</span>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                      <div>
                          <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3 border-b border-slate-800 pb-1">Public Imperatives</h3>
                          {gameState.publicObjectives.length === 0 ? (
                              <div className="text-center p-4 text-slate-600 text-xs italic border border-slate-800 border-dashed rounded">
                                  No public directives revealed yet.
                              </div>
                          ) : (
                              <div className="space-y-3">
                                  {gameState.publicObjectives.map(obj => {
                                      const isComplete = obj.condition(humanPlayer, gameState.map);
                                      return (
                                          <div key={obj.id} className={`p-3 rounded border ${isComplete ? 'bg-[#ca8a04]/10 border-[#ca8a04]/50' : 'bg-slate-900 border-slate-700'}`}>
                                              <div className="flex justify-between items-start mb-1">
                                                  <span className={`font-bold text-sm ${isComplete ? 'text-[#fcd34d]' : 'text-slate-200'}`}>{obj.name}</span>
                                                  <span className="text-xs font-mono bg-black/40 px-1.5 py-0.5 rounded text-[#fcd34d]">{obj.vp} VP</span>
                                              </div>
                                              <p className="text-xs text-slate-400 mb-2">{obj.description}</p>
                                              <div className="flex justify-between items-center text-[10px] uppercase tracking-wider">
                                                   <span className="text-slate-500">Status</span>
                                                   <span className={isComplete ? 'text-[#fcd34d] font-bold' : 'text-slate-400'}>{isComplete ? 'Qualified' : 'Incomplete'}</span>
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {activeTab === 'INTEL' && (
                  <div className="p-4 space-y-4">
                      {gameState.players.filter(p => !p.isHuman).map(p => {
                          const tileCount = (Object.values(gameState.map) as HexData[]).filter(h => h.ownerId === p.id).length;
                          const fortCount = (Object.values(gameState.map) as HexData[]).filter(h => h.fortification?.ownerId === p.id).length;
                          return (
                              <div key={p.id} className="bg-slate-900 border border-slate-700 rounded p-3 relative overflow-hidden">
                                  <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: p.faction.color }}></div>
                                  <div className="flex justify-between items-center mb-2 pl-2">
                                      <span className="font-bold text-sm text-white">{p.name}</span>
                                      {p.isEliminated && <span className="text-[9px] bg-red-900 text-red-200 px-1 rounded uppercase">Eliminated</span>}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs pl-2">
                                      <div className="flex justify-between text-slate-400">
                                          <span>Territory</span>
                                          <span className="text-white font-mono">{tileCount}</span>
                                      </div>
                                      <div className="flex justify-between text-slate-400">
                                          <span>Defense</span>
                                          <span className="text-white font-mono">{fortCount} Forts</span>
                                      </div>
                                      <div className="flex justify-between text-slate-400">
                                          <span>Score (Est)</span>
                                          <span className="text-[#fcd34d] font-mono">{p.vp} VP</span>
                                      </div>
                                      <div className="flex justify-between text-slate-400">
                                          <span>Attitude</span>
                                          <span className="text-white font-mono">{p.aiState?.diplomaticStance || 'Unknown'}</span>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>

          <div className="p-4 border-t border-slate-700 bg-[#1e293b] shrink-0">
              <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => setShowHelpModal(true)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-300 flex items-center justify-center gap-2"><BookOpen size={14}/> Manual</button>
                 <button onClick={() => { setIsCasualMode(!isCasualMode); addLog(`Mode switched to ${!isCasualMode ? 'Casual' : 'Standard'}`); }} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-300 flex items-center justify-center gap-2"><Settings size={14}/> {isCasualMode ? 'Casual' : 'Std'}</button>
              </div>
          </div>
      </>
  );

  return (
    <div className="w-full h-screen bg-[#0b0a14] overflow-hidden flex relative">
      {showSplash && <SplashScreen onStart={() => { setShowSplash(false); if(!gameStarted) startGame(4); }} onOpenSim={() => setShowSim(true)} onOpenStrategyLab={() => setShowStrategyLab(true)} />}
      {showSim && <SimulationOverlay onClose={() => setShowSim(false)} />}
      {showStrategyLab && <SimulationRunner onClose={() => setShowStrategyLab(false)} />}
      
      <WelcomeModal onClose={() => {}} forceShow={!showSplash && !gameStarted} />

      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      
      {gameState.phase === Phase.EndGame && (
          <EndGameModal 
            players={gameState.players} 
            map={gameState.map} 
            publicObjectives={gameState.publicObjectives}
            onRestart={() => window.location.reload()} 
          />
      )}
      
      {/* MARKET MODAL */}
      {gameState.players.length > 0 && (
         <MarketModal 
            isOpen={gameState.uiState.isMarketOpen} 
            onClose={() => setGameState(prev => ({...prev, uiState: {...prev.uiState, isMarketOpen: false}}))} 
            onConfirm={(target) => handleHumanAction('TRADE_MARKET', { cost: Resource.Grain, target })} 
            playerResources={gameState.players[0].resources}
         />
      )}

      {/* CHALLENGE MODAL */}
      {gameState.pendingChallenge && (
          <ChallengeModal 
            challenge={gameState.pendingChallenge} 
            declarer={gameState.players[gameState.pendingChallenge.declarerId]}
            onResolve={handleChallengeResponse}
          />
      )}

      {/* DECLARATION MODAL */}
      {gameState.uiState.isDeclaring && gameState.uiState.pendingHexId && (
          <DeclarationModal 
              isOpen={true} 
              trueType={gameState.map[gameState.uiState.pendingHexId].type}
              onConfirm={handleHumanDeclaration} 
              onCancel={() => setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isDeclaring: false, pendingHexId: null, isSelectingTile: true, actionType: 'CLAIM' } }))}
          />
      )}

      <RuinsModal isOpen={showRuinsModal} onScavenge={executeScavenge} onIgnore={() => setShowRuinsModal(false)} />

      {resolvingEvent && (
          <EventModal 
            eventData={resolvingEvent} 
            onComplete={resolvingEvent.onComplete!} 
          />
      )}

      {/* GUIDANCE BANNER - DYNAMIC */}
      {gameState.uiState.isSelectingRevealCost && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-10 w-full px-4 text-center pointer-events-none">
              <div className="bg-yellow-900/90 border border-yellow-500 text-yellow-100 px-6 py-2 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.5)] flex items-center justify-center gap-3 pointer-events-auto inline-flex">
                  <Radio className="animate-pulse shrink-0" size={20} />
                  <span className="font-bold uppercase tracking-widest text-[10px] md:text-sm">Pay: Select Hidden Sector to Reveal</span>
              </div>
          </div>
      )}
      
      {!gameState.uiState.isSelectingRevealCost && gameState.uiState.isPushingLimits && gameState.uiState.isSelectingTile && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-10 w-full px-4 text-center pointer-events-none">
              <div className="bg-cyan-900/90 border border-cyan-500 text-cyan-100 px-6 py-2 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.5)] flex items-center justify-center gap-3 pointer-events-auto inline-flex">
                  <Radio className="animate-pulse shrink-0" size={20} />
                  <span className="font-bold uppercase tracking-widest text-[10px] md:text-sm">Fatigue Active: Select Target First</span>
              </div>
          </div>
      )}

      {/* DESKTOP SIDEBAR - LOGS & INFO (Hidden on mobile) */}
      <div className="hidden md:flex flex-col w-80 bg-[#0f172a] border-r border-slate-700 relative z-20 shrink-0">
          <div className="p-4 border-b border-slate-700 bg-[#1e293b]">
             <h1 className="text-[#fcd34d] font-title text-2xl font-bold tracking-widest text-center">ECLIPSE II</h1>
             <div className="text-center text-[10px] text-slate-500 uppercase tracking-[0.2em] mt-1">Tabletop Edition</div>
          </div>
          {renderSidebarContent()}
      </div>

      {/* MOBILE SIDEBAR MODAL */}
      {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col md:hidden animate-in fade-in">
              <div className="p-4 border-b border-slate-700 bg-[#1e293b] flex justify-between items-center shrink-0">
                  <h2 className="text-[#fcd34d] font-title text-xl tracking-widest font-bold">Mission Data</h2>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700">
                      <X size={24} />
                  </button>
              </div>
              {renderSidebarContent()}
          </div>
      )}

      {/* MAIN GAME AREA */}
      <div className="flex-1 relative bg-[#0b0a14] w-full">
          
          {/* Top Bar: Mobile Menu + Turn Order */}
          <div className="absolute top-0 left-0 right-0 p-2 md:p-4 flex flex-col md:flex-row justify-between items-start pointer-events-none z-10 gap-2">
              <div className="flex items-center gap-2 pointer-events-auto w-full md:w-auto">
                 {/* Mobile Menu Button */}
                 <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="md:hidden p-2 bg-[#0f172a]/90 border border-slate-600 rounded text-slate-300 shadow-lg"
                 >
                     <Menu size={20} />
                 </button>
                 
                 {gameStarted && <TurnOrderTracker players={gameState.players} turnOrder={gameState.turnOrder} turnOrderIndex={gameState.turnOrderIndex} />}
              </div>

              <div className="flex flex-col items-end gap-2 pointer-events-auto self-end md:self-auto">
                  <div className="bg-[#0f172a]/90 backdrop-blur border border-slate-600 px-3 py-1 md:px-4 md:py-2 rounded-full shadow-xl flex items-center">
                      <span className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest mr-2">Eclipse</span>
                      <span className="text-[#fcd34d] font-title text-lg md:text-xl font-bold">{gameState.round}/{TOTAL_ROUNDS}</span>
                  </div>
                  {/* Global Event Active Indicator */}
                  {gameState.activeEvent && (
                      <div className="bg-purple-900/80 backdrop-blur border border-purple-500 px-3 py-1 md:px-4 md:py-2 rounded-lg shadow-xl animate-in fade-in flex items-center gap-2 max-w-[200px] md:max-w-none">
                          <Sparkles size={14} className="text-purple-300 shrink-0" />
                          <div className="overflow-hidden">
                              <div className="text-[9px] md:text-[10px] text-purple-300 uppercase tracking-widest leading-none">Global Event</div>
                              <div className="text-white font-bold text-xs truncate">{gameState.activeEvent.title}</div>
                          </div>
                      </div>
                  )}
              </div>
          </div>

          {/* Hex Grid Layer */}
          <div className="w-full h-full">
               <HexGrid 
                  map={gameState.map} 
                  players={gameState.players} 
                  humanPlayerId={0} 
                  onHexClick={handleHexClick}
                  onHexHover={setHoveredHexId}
                  uiState={gameState.uiState}
                  revealAll={gameState.phase === Phase.EndGame}
                  playerCount={4}
               />
          </div>

          {/* Hover Tooltip */}
          {renderTileTooltip(hoveredHexId, gameState.map, gameState.players)}

          {/* Action Panel (Bottom HUD) */}
          {gameStarted && (
              <ActionPanel 
                phase={gameState.phase}
                player={humanPlayer}
                isMyTurn={gameState.turnOrder[gameState.turnOrderIndex] === 0}
                activePlayerName={gameState.players[gameState.turnOrder[gameState.turnOrderIndex]]?.name}
                onSelectCitizen={(c) => {
                     const newPlayers = gameState.players.map(p => p.id === 0 ? { ...p, selectedCitizen: c } : p);
                     setGameState(prev => ({ ...prev, players: newPlayers }));
                }}
                onAction={handleHumanAction}
                onEndPhase={() => {
                   if (gameState.phase === Phase.Income || gameState.phase === Phase.CitizenChoice || gameState.phase === Phase.Scoring) {
                       handlePhaseTransition();
                   } else {
                       advanceTurn();
                   }
                }}
                map={gameState.map}
                isEliminated={humanPlayer?.isEliminated}
                uiState={gameState.uiState}
              />
          )}

          {/* Resource Bar (Top Right Overlay - Mobile Adjusted) */}
          {humanPlayer && !humanPlayer.isEliminated && (
             <div className="absolute top-16 md:top-20 right-2 md:right-4 pointer-events-none flex flex-col gap-2 items-end z-40">
                <div className="bg-[#0f172a]/90 backdrop-blur p-2 md:p-3 rounded-lg border border-slate-700 shadow-xl pointer-events-auto transition-transform hover:scale-105 origin-top-right scale-90 md:scale-100">
                    <div className="flex gap-2 md:gap-4">
                        <div className="flex flex-col items-center w-8 md:w-12">
                            <ResourceIcon resource={Resource.Grain} size={16} className="md:w-5 md:h-5 mb-1"/>
                            <span className="font-bold text-yellow-500 text-sm md:text-lg">{humanPlayer.resources.Grain}</span>
                        </div>
                        <div className="flex flex-col items-center w-8 md:w-12 border-l border-slate-700">
                            <ResourceIcon resource={Resource.Stone} size={16} className="md:w-5 md:h-5 mb-1"/>
                            <span className="font-bold text-slate-400 text-sm md:text-lg">{humanPlayer.resources.Stone}</span>
                        </div>
                        <div className="flex flex-col items-center w-8 md:w-12 border-l border-slate-700">
                            <ResourceIcon resource={Resource.Gold} size={16} className="md:w-5 md:h-5 mb-1"/>
                            <span className="font-bold text-amber-400 text-sm md:text-lg">{humanPlayer.resources.Gold}</span>
                        </div>
                        <div className="flex flex-col items-center w-8 md:w-12 border-l border-slate-700">
                            <ResourceIcon resource={Resource.Relic} size={16} className="md:w-5 md:h-5 mb-1"/>
                            <span className="font-bold text-emerald-400 text-sm md:text-lg">{humanPlayer.resources.Relic}</span>
                        </div>
                    </div>
                </div>
                
                {/* Relic Power Indicator */}
                {humanPlayer.activeRelicPower && (
                    <div className="bg-emerald-900/80 backdrop-blur px-2 py-1 md:px-3 md:py-1.5 rounded-full border border-emerald-500 shadow-lg flex items-center gap-2 animate-in slide-in-from-right-2 scale-90 md:scale-100 origin-right pointer-events-auto">
                        <Zap size={12} className="text-emerald-300 md:w-[14px] md:h-[14px]" />
                        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-emerald-100 truncate max-w-[100px] md:max-w-none">{humanPlayer.activeRelicPower.replace('_', ' ')}</span>
                    </div>
                )}
             </div>
          )}
      </div>
    </div>
  );
};

export default App;