import { useState, useEffect } from 'react';
import { GameState, Phase, Player, Resource, LogEntry, TileType, HexData, CitizenType, EventCard, SecretObjective, RelicPowerType, AiState, TraitType, PendingChallenge } from '../types';
import { generateMap, getNeighbors, getHexId, isAdjacent } from '../utils/hexUtils';
import { EVENTS_DECK, OBJECTIVES_DECK, TOTAL_ROUNDS, TILE_CONFIG, AI_DIALOGUE } from '../constants';
import { createInitialPlayers, updateMaxResources, updatePlayerStat, getAiDialogue, drawCardHelper, calculateScore, getIncomeRate, updateAiPsychology, calculateActionUtility } from '../logic/gameHelpers';

const shuffle = <T,>(array: T[]): T[] => array.sort(() => Math.random() - 0.5);

export const useGameEngine = () => {
    const [gameStarted, setGameStarted] = useState(false);
    const [isChallengeMode, setIsChallengeMode] = useState(false); 
    const [isCasualMode, setIsCasualMode] = useState(false); 
    const [resolvingEvent, setResolvingEvent] = useState<{card: EventCard, type: 'CHOICE'|'INFO', amount: number, isRelicPowered: boolean, onComplete?: (choice?: Resource) => void} | null>(null);
    
    const [gameState, setGameState] = useState<GameState>({
        phase: Phase.Income, round: 1, turnOrderIndex: 0, turnOrder: [], turnTrigger: 0, passOrder: [],
        players: [], map: {}, logs: [],
        uiState: { 
            isSelectingTile: false, isProcessing: false, actionType: null, selectedHexId: null, isDeclaring: false, pendingHexId: null, activeSidebarTab: 'LOG', isMarketOpen: false,
            isSelectingRevealCost: false, isPushingLimits: false, pendingActionAfterReveal: null,
            flashHexId: null 
        },
        activeEvent: null, pendingChallenge: null,
        eventDeck: [], discardPile: [], objectiveDeck: [], publicObjectives: []
    });

    useEffect(() => {
        if (gameState.uiState.flashHexId) {
            const timer = setTimeout(() => {
                setGameState(prev => ({
                    ...prev,
                    uiState: { ...prev.uiState, flashHexId: null }
                }));
            }, 2000); 
            return () => clearTimeout(timer);
        }
    }, [gameState.uiState.flashHexId]);

    const calculateFatigue = (actionsTaken: number) => actionsTaken;

    const addLog = (text: string, type: LogEntry['type'] = 'info', details?: any, actorId?: number, targetId?: number) => {
        setGameState(prev => ({
            ...prev,
            logs: [...prev.logs, { id: Date.now().toString() + Math.random(), turn: prev.round, text, type, actorId, targetId, details }]
        }));
    };

    const advanceTurn = () => {
        setGameState(prev => {
            let nextIndex = (prev.turnOrderIndex + 1) % prev.turnOrder.length;
            let attempts = 0;
            while ((prev.players[prev.turnOrder[nextIndex]].hasPassed || prev.players[prev.turnOrder[nextIndex]].isEliminated) && attempts < prev.turnOrder.length) {
                nextIndex = (nextIndex + 1) % prev.turnOrder.length;
                attempts++;
            }
            const newUi = { ...prev.uiState, isProcessing: false, isSelectingTile: false, actionType: null, isSelectingRevealCost: false, isPushingLimits: false, pendingActionAfterReveal: null, flashHexId: null };
            return { ...prev, turnOrderIndex: nextIndex, turnTrigger: prev.turnTrigger + 1, uiState: newUi };
        });
    };

    const applyEventEffect = (card: EventCard, choice?: Resource, useRelicEffect: boolean = false) => {
        setGameState(prev => {
            const activeId = prev.turnOrder[prev.turnOrderIndex];
            const ps = prev.players.map(p => ({ ...p, resources: { ...p.resources }, status: { ...p.status }, stats: {...p.stats} }));
            const map = { ...prev.map };
            Object.keys(map).forEach(k => map[k] = { ...map[k] });

            let logs = [...prev.logs];
            const effect = useRelicEffect ? card.relicEffect : card.normalEffect;
            let flashTargetId: string | null = null;
            let logText = "";

            if (['PASSIVE_INCOME', 'FREE_FORTIFY', 'WARLORD', 'TRADE_BARON', 'DOUBLE_TIME'].includes(effect.type)) {
                ps[activeId].activeRelicPower = effect.type as RelicPowerType;
                logs.push({ id: Date.now().toString(), turn: prev.round, text: `${ps[activeId].name} obtained the ${effect.type.replace('_', ' ')} Power!`, type: 'event', actorId: activeId });
                return { ...prev, players: ps, logs };
            }

            const targets = effect.target === 'SELF' ? [ps[activeId]] 
                          : effect.target === 'ENEMY' ? ps.filter(p => p.id !== activeId)
                          : effect.target === 'ALL' ? ps
                          : ps;

            if (effect.type === 'RESOURCE_GAIN') {
                targets.forEach(p => {
                    let gained = "";
                    if (choice && p.id === activeId) {
                        p.resources[choice] += effect.value;
                        gained = `+${effect.value} ${choice}`;
                    } else if (effect.target && typeof effect.target === 'string' && effect.target !== 'ALL' && effect.target !== 'SELF' && effect.target !== 'ENEMY') {
                         p.resources[effect.target as Resource] += effect.value;
                         gained = `+${effect.value} ${effect.target}`;
                    } else {
                        const gr = Math.floor(effect.value / 2);
                        const gd = Math.ceil(effect.value / 2);
                        p.resources[Resource.Grain] += gr;
                        p.resources[Resource.Gold] += gd;
                        gained = `+${gr} Grain, +${gd} Gold`;
                    }
                    if (p.id === 0) logText = `Event: ${card.title}. You gained ${gained}.`;
                });
                if(!logText) logText = `Event: ${card.title} distributed resources.`;
                logs.push({ id: Date.now().toString(), turn: prev.round, text: logText, type: 'event', actorId: activeId });
            }
            else if (effect.type === 'RESOURCE_LOSS') {
                 if (effect.target === 'ENEMY') {
                     const victim = targets[Math.floor(Math.random() * targets.length)];
                     if (victim) {
                         const lost = Math.min(victim.resources.Gold, effect.value);
                         victim.resources[Resource.Gold] -= lost;
                         logs.push({ id: Date.now().toString(), turn: prev.round, text: `Sabotage! ${victim.name} lost -${lost} Gold.`, type: 'event', actorId: activeId });
                         if (!victim.isHuman && victim.aiState) {
                             victim.aiState.grudges.push({ targetId: activeId, reason: 'THEFT', turn: prev.round });
                         }
                     }
                 }
            }
            else if (effect.type === 'FORTIFY_REMOVE') {
                 const fortifiedHexIds = Object.keys(map).filter(k => map[k].fortification);
                 if (fortifiedHexIds.length > 0) {
                     const targetId = fortifiedHexIds[Math.floor(Math.random() * fortifiedHexIds.length)];
                     const targetHex = map[targetId];
                     const ownerId = targetHex.fortification?.ownerId;
                     const ownerName = ownerId !== undefined ? ps[ownerId].name : "Unknown";
                     
                     map[targetId].fortification = null;
                     flashTargetId = targetId; 
                     
                     const tileName = TILE_CONFIG[targetHex.type].label;
                     const coords = `[${targetHex.diceCoords.col},${targetHex.diceCoords.row}]`;
                     
                     logs.push({ id: Date.now().toString(), turn: prev.round, text: `Earthquake! Fortification at ${coords} (${tileName}) owned by ${ownerName} was destroyed.`, type: 'combat' });
                 } else {
                     logs.push({ id: Date.now().toString(), turn: prev.round, text: `Earthquake struck, but no fortifications were found.`, type: 'event' });
                 }
            }
            else if (effect.type === 'TILE_REMOVE') {
                 const revealed = (Object.values(map) as HexData[]).filter(h => h.isRevealed && h.ownerId !== null);
                 if (revealed.length > 0) {
                     const target = revealed[Math.floor(Math.random() * revealed.length)];
                     const owner = ps.find(p => p.id === target.ownerId);
                     
                     map[target.id].ownerId = null;
                     map[target.id].fortification = null;
                     if (owner) owner.stats.tilesLost++;
                     flashTargetId = target.id; 
                     
                     const tileName = TILE_CONFIG[target.type].label;
                     const coords = `[${target.diceCoords.col},${target.diceCoords.row}]`;

                     logs.push({ id: Date.now().toString(), turn: prev.round, text: `Natural Disaster! ${owner?.name} lost territory at ${coords} (${tileName}).`, type: 'combat' });
                 }
            }
            else if (effect.type === 'COMBAT_BONUS') {
                ps[activeId].status.combatBonus += effect.value;
                logs.push({ id: Date.now().toString(), turn: prev.round, text: `${ps[activeId].name} gains +${effect.value} Combat Strength this round.`, type: 'info', actorId: activeId });
            }
            else if (effect.type === 'BLOCK_ATTACK') {
                 ps.forEach(p => p.status.canAttack = false);
                 logs.push({ id: Date.now().toString(), turn: prev.round, text: `Fog of War! All attacks are blocked this round.`, type: 'event' });
            }
            else if (effect.type === 'PASSIVE_INCOME') {
                ps[activeId].status.passiveIncome = true;
                logs.push({ id: Date.now().toString(), turn: prev.round, text: `${ps[activeId].name} establishes Passive Income.`, type: 'info', actorId: activeId });
            }
            else if (effect.type === 'FREE_FORTIFY') {
                ps[activeId].status.freeFortify = true;
                logs.push({ id: Date.now().toString(), turn: prev.round, text: `${ps[activeId].name} gains a Free Fortification.`, type: 'info', actorId: activeId });
            }
            else if (effect.type === 'TRADE_FREE') {
                ps[activeId].status.freeTrades += effect.value;
                logs.push({ id: Date.now().toString(), turn: prev.round, text: `${ps[activeId].name} gains ${effect.value} Free Trade actions.`, type: 'info', actorId: activeId });
            }

            return { 
                ...prev, 
                players: ps, 
                map: map, 
                logs: logs,
                uiState: { ...prev.uiState, flashHexId: flashTargetId } 
            };
        });
    };

    const handleHumanAction = (action: string, payload?: any) => {
        const player = gameState.players[0];
        if (!player) return;
        
        const isFatigued = player.actionsTaken >= 1; 

        if (action === 'PASS') {
             setGameState(prev => {
                const ps = prev.players.map(p => p.id === 0 ? { ...p, hasPassed: true } : p);
                const po = [...prev.passOrder]; if (!po.includes(0)) po.push(0);
                return { ...prev, players: ps, passOrder: po, logs: [...prev.logs, { id: Date.now().toString(), turn: prev.round, text: "You passed.", type: 'info' as const, actorId: 0 }], uiState: { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null, isProcessing: false } };
             });
             setTimeout(() => advanceTurn(), 200);
             return;
        }
        
        const isMapAction = ['WARRIOR_ATTACK', 'BUILD_FORTIFY', 'EXPLORE_CLAIM', 'EXPLORE_RUIN', 'ACTIVATE_RELIC', 'TRADE_BANK'].includes(action);
        
        if (isMapAction && isFatigued && !gameState.uiState.isSelectingRevealCost && !gameState.uiState.isPushingLimits) {
            const fatigue = player.actionsTaken;
            const role = player.selectedCitizen;
            const isMerc = (req: CitizenType) => role !== req;
            const tax = (req: CitizenType) => isMerc(req) ? 2 : 0;
            
            let canAfford = false;
            
            if (action === 'WARRIOR_ATTACK') {
                const costGrain = (player.actionsTaken === 0 ? 1 : 2) + fatigue;
                const costGold = tax(CitizenType.Warrior);
                canAfford = player.resources.Grain >= costGrain && player.resources.Gold >= costGold;
            } else if (action === 'BUILD_FORTIFY') {
                const isFree = (player.activeRelicPower === 'FREE_FORTIFY' && player.actionsTaken === 0) || player.status.freeFortify;
                const costStone = isFree ? 0 : (2 + fatigue);
                const costGold = tax(CitizenType.Builder);
                canAfford = player.resources.Stone >= costStone && player.resources.Gold >= costGold;
            } else if (action === 'EXPLORE_CLAIM') {
                const costGrain = 1 + fatigue;
                const costGold = tax(CitizenType.Explorer);
                canAfford = player.resources.Grain >= costGrain && player.resources.Gold >= costGold;
            } else if (action === 'TRADE_BANK') {
                const costGrain = 2 + fatigue;
                const costGold = tax(CitizenType.Merchant);
                const isFree = player.status.freeTrades > 0 || player.activeRelicPower === 'TRADE_BARON';
                canAfford = player.resources.Gold >= costGold && (isFree || player.resources.Grain >= costGrain);
            } else {
                canAfford = true;
            }
            
            if (!canAfford) {
                const hiddenTiles = (Object.values(gameState.map) as HexData[]).filter(h => h.ownerId === 0 && !h.isRevealed);
                if (hiddenTiles.length > 0) {
                    
                    const typeMap: Record<string, any> = {
                        'WARRIOR_ATTACK': 'ATTACK',
                        'BUILD_FORTIFY': 'FORTIFY',
                        'EXPLORE_CLAIM': 'CLAIM',
                        'EXPLORE_RUIN': 'EXPLORE',
                        'ACTIVATE_RELIC': 'ACTIVATE'
                    };

                    setGameState(prev => ({ 
                        ...prev, 
                        uiState: { 
                            ...prev.uiState, 
                            actionType: typeMap[action], 
                            isSelectingTile: true, 
                            isPushingLimits: true, // Enable flag
                            isSelectingRevealCost: false,
                            pendingActionAfterReveal: null 
                        } 
                    }));
                    return; 
                }
            }
        }

        if (action === 'OPEN_MARKET') {
             setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isMarketOpen: true } }));
        }
        else if (action === 'TRADE_MARKET') {
             const { cost, target } = payload;
             if (player.resources[cost] >= 3) {
                 setGameState(prev => {
                     const ps = prev.players.map(p => p.id === 0 ? { ...p, resources: { ...p.resources, [cost]: p.resources[cost] - 3, [target]: p.resources[target] + 1 } } : p);
                     return { ...prev, players: ps, uiState: { ...prev.uiState, isMarketOpen: false }, logs: [...prev.logs, { id: Date.now().toString(), turn: prev.round, text: `Market: Traded (-3 ${cost}, +1 ${target}).`, type: 'info' as const, actorId: 0 }] };
                 });
             }
        }
        else if (action === 'TRADE_BANK') {
             const isMerchant = player.selectedCitizen === CitizenType.Merchant;
             const tax = isMerchant ? 0 : 2; 
             
             let fatigue = player.actionsTaken;
             if (gameState.uiState.isPushingLimits) fatigue = 0;

             let tradeCost = 2 + fatigue;
             
             if (player.resources.Gold < tax || (player.activeRelicPower !== 'TRADE_BARON' && player.status.freeTrades <= 0 && player.resources.Grain < tradeCost)) return;

             setGameState(prev => {
                 const ps = prev.players.map(p => {
                     if (p.id === 0) {
                         let newRes = { ...p.resources };
                         let newStatus = { ...p.status };
                         newRes.Gold -= tax; 
                         if (p.status.freeTrades > 0) newStatus.freeTrades--;
                         else if (p.activeRelicPower !== 'TRADE_BARON') newRes.Grain -= tradeCost;
                         newRes.Gold += 1;
                         return { ...p, resources: newRes, status: newStatus, actionsTaken: p.actionsTaken + 1 };
                     }
                     return p;
                 });
                 let costStr = "";
                 if (tax > 0) costStr += `-${tax} Gold, `;
                 if (player.status.freeTrades > 0) costStr += "Free Trade Used, ";
                 else if (player.activeRelicPower !== 'TRADE_BARON') costStr += `-${tradeCost} Grain, `;
                 costStr += "+1 Gold";

                 return { ...prev, players: ps, logs: [...prev.logs, { id: Date.now().toString(), turn: prev.round, text: `Merchant Trade: (${costStr})`, type: 'info' as const, actorId: 0 }], uiState: { ...prev.uiState, isPushingLimits: false } };
             });
             setTimeout(() => advanceTurn(), 200);
        }
        else {
             const typeMap: Record<string, any> = {
                 'WARRIOR_ATTACK': 'ATTACK',
                 'BUILD_FORTIFY': 'FORTIFY',
                 'EXPLORE_CLAIM': 'CLAIM',
                 'EXPLORE_RUIN': 'EXPLORE',
                 'ACTIVATE_RELIC': 'ACTIVATE'
             };
             setGameState(prev => ({ 
                 ...prev, 
                 uiState: { 
                     ...prev.uiState, 
                     actionType: typeMap[action], 
                     isSelectingTile: true, 
                     isSelectingRevealCost: false, 
                     pendingActionAfterReveal: null 
                 } 
             }));
        }
    };

    const handleRevealPay = (hexId: string) => {
        if (gameState.map[hexId].ownerId !== 0 || gameState.map[hexId].isRevealed) return;
        
        if (gameState.uiState.pendingHexId === hexId) {
            addLog("Cannot reveal the sector you are currently claiming!", 'alert');
            return;
        }
        if (gameState.uiState.pendingActionAfterReveal?.target === hexId) {
            addLog("Cannot reveal the sector you are targeting!", 'alert');
            return;
        }

        setGameState(prev => {
            const nm = { ...prev.map };
            const prevPublicType = nm[hexId].publicType;
            const trueType = nm[hexId].type;
            
            nm[hexId].isRevealed = true;
            nm[hexId].publicType = trueType; 
            
            const logs = [...prev.logs];
            logs.push({ id: Date.now().toString(), turn: prev.round, text: `FATIGUE: You revealed sector [${nm[hexId].diceCoords.col},${nm[hexId].diceCoords.row}] as payment! (No resources spent)`, type: 'info' as const, actorId: 0 });

            if (prevPublicType !== trueType) {
                logs.push({ 
                    id: `bluff-${Date.now()}`, 
                    turn: prev.round, 
                    text: `SCANDAL! Sector [${nm[hexId].diceCoords.col},${nm[hexId].diceCoords.row}] exposed as ${TILE_CONFIG[trueType].label}, not ${TILE_CONFIG[prevPublicType].label}!`, 
                    type: 'bluff' as const,
                    actorId: 0
                });
            }

            const ps = prev.players.map(p => p.id === 0 ? updatePlayerStat(p, 'tilesRevealed', 1) : p);
            
            let nextUiState = { ...prev.uiState, isSelectingRevealCost: false };
            
            if (prev.uiState.pendingHexId && prev.uiState.isPushingLimits) {
                nextUiState.isDeclaring = true; 
            } 

            return { 
                ...prev, map: nm, players: ps, logs,
                uiState: nextUiState
            };
        });

        if (gameState.uiState.pendingActionAfterReveal) {
             const { action, target } = gameState.uiState.pendingActionAfterReveal;
             setTimeout(() => resolveMapAction(target, action), 50);
        }
    };

    const resolveMapAction = (hexId: string, overrideAction?: string) => {
        const hex = gameState.map[hexId];
        const player = gameState.players[0];
        const actionType = overrideAction || gameState.uiState.actionType;

        if (!hex || !actionType || gameState.uiState.isProcessing) return;

        const myTiles = (Object.values(gameState.map) as HexData[]).filter(h => h.ownerId === player.id);
        const isAdj = myTiles.some(t => isAdjacent(t, hex));

        if (actionType === 'ATTACK') {
             if (!player.status.canAttack) {
                 addLog("Command Denied: Attacks are blocked by global event.", 'alert');
                 return;
             }
             if (!isAdj) return;
        }

        setGameState(prev => {
            const hex = prev.map[hexId];
            
            let newMap = { ...prev.map };
            let newPlayers = [...prev.players];
            let newLogs = [...prev.logs];
            let actionSuccess = false;
            
            const mercenaryTax = (role: CitizenType) => player.selectedCitizen === role ? 0 : 2;
            const actionsTaken = player.actionsTaken;
            const fatigue = prev.uiState.isPushingLimits ? 0 : actionsTaken;
            
            const buildCostLog = (grain: number, stone: number, gold: number) => {
                const parts = [];
                if (grain > 0) parts.push(`-${grain} Grain`);
                if (stone > 0) parts.push(`-${stone} Stone`);
                if (gold > 0) parts.push(`-${gold} Gold`);
                return parts.length > 0 ? `(${parts.join(', ')})` : "";
            };

            if (actionType === 'ATTACK') {
                 const defenderId = hex.ownerId;
                 if (defenderId !== null && defenderId !== 0) {
                     let costGrain = (player.actionsTaken === 0 ? 1 : 2) + fatigue;
                     const costGold = mercenaryTax(CitizenType.Warrior);
                     
                     if (player.resources.Grain < costGrain || player.resources.Gold < costGold) return prev;

                     newPlayers[0] = { ...player, resources: { ...player.resources, Grain: player.resources.Grain - costGrain, Gold: player.resources.Gold - costGold } };
                     const costStr = buildCostLog(costGrain, 0, costGold);

                     if (hex.type === TileType.Trap) {
                        newMap[hexId] = { ...hex, type: TileType.Plains, publicType: TileType.Plains, ownerId: null, fortification: null, isRevealed: true };
                        newPlayers[0].resources.Grain = Math.max(0, newPlayers[0].resources.Grain - 2); 
                        newLogs.push({ id: Date.now().toString(), turn: prev.round, text: `IT'S A TRAP! Your army was decimated! (-2 Grain) ${costStr}`, type: 'combat' as const, actorId: 0 });
                        actionSuccess = true;
                        newPlayers[0].actionsTaken++;
                        newPlayers[0] = updateMaxResources(newPlayers[0]);
                        return { 
                            ...prev, map: newMap, players: newPlayers, logs: newLogs,
                            uiState: { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null, isProcessing: true, isPushingLimits: false, pendingActionAfterReveal: null } 
                        };
                     }

                     let attStr = 1 + (player.selectedCitizen === CitizenType.Warrior ? 1 : 0) + player.status.combatBonus + (player.activeRelicPower === 'WARLORD' ? 1 : 0);
                     let defStr = 1 + (hex.fortification ? 1 : 0);
                     const rollAtt = Math.floor(Math.random() * 6) + 1;
                     const rollDef = Math.floor(Math.random() * 6) + 1;
                     const won = (attStr + rollAtt) > (defStr + rollDef);
                     
                     newPlayers[0].stats.attacksMade++;
                     if (won) {
                         newMap[hexId] = { ...hex, ownerId: 0, fortification: null, isRevealed: true };
                         newPlayers[0].stats.battlesWon++;
                         newPlayers[defenderId].stats.tilesLost++;
                         const stealable = (['Grain','Stone','Gold'] as Resource[]).filter(r => newPlayers[defenderId].resources[r] > 0);
                         let stolen = "";
                         if (stealable.length > 0) {
                             const r = stealable[0];
                             newPlayers[defenderId].resources[r]--;
                             newPlayers[0].resources[r]++;
                             stolen = `, Stole +1 ${r}`;
                         }
                         
                         const isRelicSite = hex.type === TileType.RelicSite;
                         const relicLossText = isRelicSite ? " (Enemy lost control of Relic Site)" : "";

                         newLogs.push({ id: Date.now().toString(), turn: prev.round, text: `Victory! You conquered [${hex.diceCoords.col},${hex.diceCoords.row}]! ${costStr}${stolen}${relicLossText}`, type: 'combat' as const, details: { dice: { att: attStr, def: defStr, attRoll: rollAtt, defRoll: rollDef } }, actorId: 0 });
                         
                         if (newPlayers[defenderId].aiState) {
                             newPlayers[defenderId].aiState.grudges.push({ targetId: 0, reason: 'ATTACK', turn: prev.round });
                         }

                     } else {
                         newLogs.push({ id: Date.now().toString(), turn: prev.round, text: `Defeat at [${hex.diceCoords.col},${hex.diceCoords.row}]. ${costStr}`, type: 'combat' as const, details: { dice: { att: attStr, def: defStr, attRoll: rollAtt, defRoll: rollDef } }, actorId: 0 });
                     }
                     actionSuccess = true;
                 }
            }
            else if (actionType === 'FORTIFY') {
                const isFree = (player.activeRelicPower === 'FREE_FORTIFY' && player.actionsTaken === 0) || player.status.freeFortify;
                let costStone = isFree ? 0 : (2 + fatigue);

                const costGold = mercenaryTax(CitizenType.Builder);
                
                if (!isFree && (player.resources.Stone < costStone || player.resources.Gold < costGold)) return prev;

                newPlayers[0] = { ...player, resources: { ...player.resources, Stone: player.resources.Stone - costStone, Gold: player.resources.Gold - costGold } };
                const costStr = buildCostLog(0, costStone, costGold);
                newMap[hexId] = { ...hex, fortification: { ownerId: 0, level: 1 } };
                newLogs.push({ id: Date.now().toString(), turn: prev.round, text: `Fortified sector [${hex.diceCoords.col},${hex.diceCoords.row}]. ${costStr}`, type: 'info' as const, actorId: 0 });
                actionSuccess = true;
            }
            else if (actionType === 'ACTIVATE') {
                newMap[hexId] = { ...hex, publicType: TileType.RelicSite };
                newPlayers[0].stats.relicSitesRevealed++;
                
                newLogs.push({ 
                    id: Date.now().toString(), 
                    turn: prev.round, 
                    text: `Ancient Relic Uncovered! Gained Relic Token (+2 VP) & unlocked Relic Power card.`, 
                    type: 'info' as const, 
                    actorId: 0 
                });

                const { card, newDeck, newDiscard } = drawCardHelper(prev.eventDeck, prev.discardPile);
                setResolvingEvent({ card, type: 'INFO', amount: 0, isRelicPowered: true, onComplete: () => setTimeout(()=>advanceTurn(), 200) });
                return { ...prev, map: newMap, players: newPlayers, eventDeck: newDeck, discardPile: newDiscard, uiState: { ...prev.uiState, isSelectingTile: false, actionType: null }, logs: newLogs };
            }

            if (actionSuccess) {
                newPlayers[0].actionsTaken++;
                newPlayers[0] = updateMaxResources(newPlayers[0]);
                return { 
                    ...prev, map: newMap, players: newPlayers, logs: newLogs,
                    uiState: { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null, isProcessing: true, isPushingLimits: false, pendingActionAfterReveal: null } 
                };
            }
            return prev;
        });
        setTimeout(() => advanceTurn(), 500);
    };

    const handleHumanDeclaration = (declaredType: TileType) => {
         setGameState(prev => {
             const player = prev.players[0];
             const hexId = prev.uiState.pendingHexId;
             if (!hexId) return prev;
             
             const fatigue = prev.uiState.isPushingLimits ? 0 : player.actionsTaken;
             const mercenaryTax = player.selectedCitizen === CitizenType.Explorer ? 0 : 2;
             const costGrain = 1 + fatigue;
             
             if (player.resources.Grain < costGrain || player.resources.Gold < mercenaryTax) return prev;
             
             const ps = [...prev.players];
             ps[0] = { ...player, resources: { ...player.resources, Grain: player.resources.Grain - costGrain, Gold: player.resources.Gold - mercenaryTax } };
             
             let costStr = `(-${costGrain} Grain`;
             if (mercenaryTax > 0) costStr += `, -${mercenaryTax} Gold`;
             costStr += ")";

             const nm = { ...prev.map };
             nm[hexId] = { ...nm[hexId], ownerId: 0, publicType: declaredType };
             if (declaredType === TileType.Trap) {
                 nm[hexId].type = TileType.Trap;
                 nm[hexId].publicType = TileType.Plains;
             }
             
             ps[0].actionsTaken++;
             ps[0] = updateMaxResources(ps[0]);
             
             const neighbors = getNeighbors(nm[hexId].q, nm[hexId].r).map(n => getHexId(n.q, n.r));
             const rivals = neighbors
                 .map(id => nm[id]?.ownerId)
                 .filter(id => id !== null && id !== 0 && id !== undefined)
                 .filter((v, i, a) => a.indexOf(v) === i); 
             
             let pendingCh: PendingChallenge | null = null;
             
             for (const rid of rivals) {
                 if (rid === null) continue;
                 const rival = ps[rid as number];
                 if (!rival.aiState) continue;
                 
                 let chance = 0;
                 if (rival.aiState.suspicion > 60) chance += 30;
                 if (rival.aiState.activeTraits.includes('Paranoid')) chance += 20;
                 if (declaredType === TileType.Goldmine || declaredType === TileType.RelicSite) chance += 20;
                 
                 if (Math.random() * 100 < chance) {
                     pendingCh = {
                         isActive: true,
                         declarerId: 0,
                         hexId,
                         declaredType: declaredType === TileType.Trap ? TileType.Plains : declaredType,
                         realType: nm[hexId].type,
                         timer: 5
                     };
                     break; 
                 }
             }

             const logs = [...prev.logs, { id: Date.now().toString(), turn: prev.round, text: `You claimed [${nm[hexId].diceCoords.col},${nm[hexId].diceCoords.row}] as ${TILE_CONFIG[declaredType].label}. ${costStr}`, type: 'info' as const, actorId: 0 }];

             return {
                 ...prev,
                 players: ps,
                 map: nm,
                 logs,
                 pendingChallenge: pendingCh,
                 uiState: { ...prev.uiState, isDeclaring: false, pendingHexId: null, isProcessing: pendingCh ? true : true, isPushingLimits: false } 
             };
         });
         
         if (!gameState.pendingChallenge) {
             setTimeout(() => advanceTurn(), 500);
         }
    };

    const handleChallengeResponse = (doChallenge: boolean) => {
        setGameState(prev => {
            if (!prev.pendingChallenge) return prev;
            const challenge = prev.pendingChallenge;
            const map = { ...prev.map };
            const ps = prev.players.map(p => ({...p, status: {...p.status}, resources: {...p.resources}}));
            const logs = [...prev.logs];
            let logMsg = "";
            
            const isHumanChallenging = challenge.declarerId !== 0; 
            const challengerName = isHumanChallenging ? "You" : ps[0].name; 
            
            if (!doChallenge) {
                 map[challenge.hexId].ownerId = challenge.declarerId;
                 map[challenge.hexId].publicType = challenge.declaredType;
                 logMsg = `${isHumanChallenging ? "You" : challengerName} trusted ${ps[challenge.declarerId].name}'s claim.`;
            } else {
                 const isBluff = challenge.declaredType !== challenge.realType;
                 if (isBluff) {
                     logMsg = `CHALLENGE SUCCESS! ${ps[challenge.declarerId].name} was lying!`;
                     
                     if (isHumanChallenging) ps[0].vp += 1;
                     else ps[0].vp -= 1; 
                     
                     map[challenge.hexId].ownerId = null; 
                     map[challenge.hexId].isRevealed = true; 
                     map[challenge.hexId].publicType = challenge.realType;
                 } else {
                     logMsg = `CHALLENGE FAILED! ${ps[challenge.declarerId].name} told the truth!`;
                     
                     if (isHumanChallenging) {
                         if (isCasualMode) {
                             if (ps[0].resources.Gold >= 2) {
                                 ps[0].resources.Gold -= 2;
                                 logMsg += " You pay 2 Gold.";
                             } else {
                                 ps[0].vp -= 1;
                             }
                         } else {
                             ps[0].status.turnLost = true;
                             logMsg += " Penalty: You lose your next turn!";
                         }
                     }
                     
                     map[challenge.hexId].ownerId = challenge.declarerId;
                     map[challenge.hexId].isRevealed = true;
                     map[challenge.hexId].publicType = challenge.realType;
                 }
            }
            logs.push({ id: Date.now().toString(), turn: prev.round, text: logMsg, type: 'bluff' as const });
            
            let nextIndex = prev.turnOrderIndex;
            
            if (challenge.declarerId !== 0) { // AI was declarer
                 nextIndex = (prev.turnOrderIndex + 1) % prev.turnOrder.length;
                 // Loop to find next valid
                 let attempts = 0;
                 while ((ps[prev.turnOrder[nextIndex]].hasPassed || ps[prev.turnOrder[nextIndex]].isEliminated) && attempts < prev.turnOrder.length) {
                    nextIndex = (nextIndex + 1) % prev.turnOrder.length;
                    attempts++;
                 }
            } else {
                // Human was declarer, challenge handled, now advance
                nextIndex = (prev.turnOrderIndex + 1) % prev.turnOrder.length;
                 let attempts = 0;
                 while ((ps[prev.turnOrder[nextIndex]].hasPassed || ps[prev.turnOrder[nextIndex]].isEliminated) && attempts < prev.turnOrder.length) {
                    nextIndex = (nextIndex + 1) % prev.turnOrder.length;
                    attempts++;
                 }
            }

            return { ...prev, pendingChallenge: null, players: ps, map, logs, turnOrderIndex: nextIndex, turnTrigger: prev.turnTrigger + 1 };
        });
    };

    const handlePhaseTransition = () => {
      setGameState(prev => {
          let nextPhase = prev.phase;
          let nextRound = prev.round;
          let newTurnOrder = [...prev.turnOrder];
          let nextTurnOrderIndex = 0;
          let ui = { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null, isProcessing: false, isDeclaring: false, isSelectingRevealCost: false, pendingActionAfterReveal: null };
          let newPlayers = prev.players;
          let nextObjectiveDeck = [...prev.objectiveDeck];
          let nextPublicObjectives = [...prev.publicObjectives];
          let logs = [...prev.logs];
          let activeEvent = prev.activeEvent;

          if (prev.phase === Phase.Income) {
              nextPhase = Phase.CitizenChoice;
              newPlayers = newPlayers.map(p => ({ ...p, hasActed: false, hasPassed: false, actionsTaken: 0, selectedCitizen: null }));
              logs.push({ id: `phase-ii-${Date.now()}`, turn: prev.round, text: "Phase II: The Council convenes.", type: 'phase' as const });
              
              newPlayers = newPlayers.map(p => {
                  if (p.isHuman || p.isEliminated || p.selectedCitizen) return p;
                  let choice = CitizenType.Explorer;
                  if (prev.round === 1) {
                      choice = CitizenType.Explorer;
                  } else {
                      const hasGrain = p.resources[Resource.Grain] >= 2;
                      const hasStone = p.resources[Resource.Stone] >= 2;
                      if (p.resources[Resource.Grain] < 1 && p.resources[Resource.Gold] < 2) {
                          choice = CitizenType.Merchant;
                      } else if (hasStone && Math.random() > 0.4) {
                          choice = CitizenType.Builder;
                      } else if (hasGrain && Math.random() > 0.4) {
                          choice = CitizenType.Warrior;
                      } else {
                          choice = CitizenType.Explorer;
                      }
                  }
                  return { ...p, selectedCitizen: choice };
              });
          } 
          else if (prev.phase === Phase.CitizenChoice) {
              nextPhase = Phase.Action;
              logs.push({ id: `phase-iii-${Date.now()}`, turn: prev.round, text: "Phase III: Action Phase begins.", type: 'phase' as const });
          } 
          else if (prev.phase === Phase.Action) {
              nextPhase = Phase.Events;
              activeEvent = null; 
              logs.push({ id: `phase-iv-${Date.now()}`, turn: prev.round, text: "Phase IV: Event Phase.", type: 'phase' as const });
              newPlayers = newPlayers.map(p => ({ ...p, actionsTaken: 0 }));
              if (prev.passOrder.length > 0) {
                 const newOrder: number[] = [];
                 prev.passOrder.forEach(id => { if(!newOrder.includes(id)) newOrder.push(id); });
                 prev.players.forEach(p => { if(!newOrder.includes(p.id)) newOrder.push(p.id); });
                 newTurnOrder = newOrder;
              }
          } 
          else if (prev.phase === Phase.Events) {
              nextPhase = Phase.Scoring;
              newPlayers = newPlayers.map(p => {
                  const scoreData = calculateScore(p, prev.map, prev.publicObjectives);
                  return { ...p, vp: scoreData.total };
              });
              logs.push({ id: `phase-v-${Date.now()}`, turn: prev.round, text: "Phase V: Scoring complete.", type: 'phase' as const });
          } 
          else if (prev.phase === Phase.Scoring) {
              if (prev.round >= TOTAL_ROUNDS) {
                  nextPhase = Phase.EndGame;
                  logs.push({ id: `end-${Date.now()}`, turn: prev.round, text: "Game Over. Calculating Final Scores...", type: 'phase' as const });
              } else {
                  nextPhase = Phase.Income;
                  nextRound += 1;
                  logs.push({ id: `eclipse-${nextRound}-${Date.now()}`, turn: nextRound, text: `Eclipse ${nextRound} Begins.`, type: 'phase' as const });
                  
                  if (nextRound <= 4 && nextObjectiveDeck.length > 0) {
                       const newObj = nextObjectiveDeck.pop();
                       if (newObj) {
                           nextPublicObjectives.push(newObj);
                           logs.push({ id: `obj-reveal-${Date.now()}`, turn: nextRound, text: `Public Imperative Revealed: ${newObj.name}`, type: 'info' as const });
                       }
                  }
                  
                  const activeEventNormal = prev.activeEvent ? prev.activeEvent.normalEffect : null;
                  
                  newPlayers = newPlayers.map(p => {
                      const income = getIncomeRate(p, prev.map);
                      
                      if (p.id === 0) {
                          const gains = [];
                          if (income.Grain > 0) gains.push(`+${income.Grain} Grain`);
                          if (income.Stone > 0) gains.push(`+${income.Stone} Stone`);
                          if (income.Gold > 0) gains.push(`+${income.Gold} Gold`);
                          if (income.Relic > 0) gains.push(`+${income.Relic} Relic`);
                          
                          if (gains.length > 0) {
                              logs.push({ 
                                  id: `income-${Date.now()}`, 
                                  turn: nextRound, 
                                  text: `Income Received: ${gains.join(', ')}`, 
                                  type: 'info', 
                                  actorId: 0 
                              });
                          }
                      }

                      let canAttack = true;
                      if (activeEventNormal?.type === 'BLOCK_ATTACK') {
                          canAttack = false;
                      }
                      
                      let combatBonus = 0;
                      if (activeEventNormal?.type === 'COMBAT_BONUS' && activeEventNormal.target === 'ALL') {
                          combatBonus = activeEventNormal.value;
                      }

                      return {
                          ...p,
                          resources: {
                              Grain: p.resources.Grain + income.Grain,
                              Stone: p.resources.Stone + income.Stone,
                              Gold: p.resources.Gold + income.Gold,
                              Relic: p.resources.Relic + income.Relic
                          },
                          status: { 
                              canAttack, 
                              combatBonus, 
                              fortificationBlocked: false, 
                              incomeMultiplier: 1, 
                              freeTrades: 0, 
                              passiveIncome: p.status.passiveIncome, 
                              freeFortify: p.status.freeFortify, 
                              extraActions: 0, 
                              turnLost: false 
                          }
                      };
                  });
              }
          }

          return { ...prev, phase: nextPhase, round: nextRound, turnOrder: newTurnOrder, turnOrderIndex: nextTurnOrderIndex, uiState: ui, players: newPlayers, passOrder: nextPhase === Phase.Action ? [] : prev.passOrder, objectiveDeck: nextObjectiveDeck, publicObjectives: nextPublicObjectives, logs, activeEvent };
      });
    };

    const executeAiAction = (aiId: number) => {
        setGameState(prev => {
            const ai = prev.players.find(p => p.id === aiId);
            if (!ai || ai.hasPassed || ai.isEliminated) {
                return prev;
            }
            
            if (ai.status.turnLost) {
                 const ps = prev.players.map(p => p.id === aiId ? { ...p, hasPassed: true, status: { ...p.status, turnLost: false } } : p);
                 return { ...prev, players: ps, logs: [...prev.logs, { id: Date.now().toString(), turn: prev.round, text: `${ai.name} (AI) lost their turn due to penalty.`, type: 'info', actorId: aiId }] };
            }

            const human = prev.players[0];
            const aiPsych = updateAiPsychology(ai, human, prev.map, prev.players);

            const myTiles = (Object.values(prev.map) as HexData[]).filter(h => h.ownerId === ai.id);
            const neighborIds = myTiles.flatMap(h => getNeighbors(h.q, h.r)).map(n => getHexId(n.q, n.r));
            
            const actions: {type: string, target: string | null, score: number}[] = [];

            if (aiPsych.status.canAttack) {
                 const enemies = neighborIds.filter(nid => prev.map[nid] && prev.map[nid].ownerId !== null && prev.map[nid].ownerId !== ai.id);
                 enemies.forEach(eid => {
                     actions.push({ type: 'WARRIOR_ATTACK', target: eid, score: calculateActionUtility(aiPsych, 'WARRIOR_ATTACK', eid, prev.map, prev.players) });
                 });
            }

            const neutral = neighborIds.filter(nid => prev.map[nid] && prev.map[nid].ownerId === null);
            neutral.forEach(nid => {
                 actions.push({ type: 'EXPLORE_EXPAND', target: nid, score: calculateActionUtility(aiPsych, 'EXPLORE_EXPAND', nid, prev.map, prev.players) });
            });

            const unfortified = myTiles.filter(t => !t.fortification);
            unfortified.forEach(t => {
                 actions.push({ type: 'FORTIFY', target: t.id, score: calculateActionUtility(aiPsych, 'FORTIFY', t.id, prev.map, prev.players) });
            });
            
            actions.push({ type: 'MERCHANT_TRADE', target: null, score: calculateActionUtility(aiPsych, 'MERCHANT_TRADE', null, prev.map, prev.players) });

            actions.sort((a, b) => b.score - a.score);
            const bestAction = actions[0];

            if (!bestAction || bestAction.score <= 0) {
                 const ps = prev.players.map(p => p.id === ai.id ? { ...p, hasPassed: true } : p);
                 const po = [...prev.passOrder]; if(!po.includes(ai.id)) po.push(ai.id);
                 return { ...prev, players: ps, passOrder: po, logs: [...prev.logs, { id: Date.now().toString(), turn: prev.round, text: `${ai.name} passed.`, type: 'info', actorId: ai.id }] };
            }

            let newMap = { ...prev.map };
            let newPlayers = prev.players.map(p => p.id === ai.id ? aiPsych : p); 
            let logMsg = "";
            let logType: LogEntry['type'] = 'info';

            const fatigue = ai.actionsTaken;
            const role = ai.selectedCitizen;
            const isMerc = (req: CitizenType) => role !== req;
            const tax = (req: CitizenType) => isMerc(req) ? 2 : 0;
            
            const pay = (grain: number, stone: number, gold: number): boolean => {
                const p = newPlayers[ai.id];
                if (p.resources.Grain >= grain && p.resources.Stone >= stone && p.resources.Gold >= gold) {
                    newPlayers[ai.id] = { ...p, resources: { ...p.resources, Grain: p.resources.Grain - grain, Stone: p.resources.Stone - stone, Gold: p.resources.Gold - gold } };
                    return true;
                }
                return false;
            };

            // EXECUTE ACTION
            let actionSuccess = false;

            if (bestAction.type === 'WARRIOR_ATTACK' && bestAction.target) {
                 const cost = (ai.actionsTaken === 0 ? 1 : 2) + fatigue;
                 if (pay(cost, 0, tax(CitizenType.Warrior))) {
                     const target = newMap[bestAction.target];
                     let attStr = 1 + (ai.selectedCitizen === CitizenType.Warrior ? 1 : 0) + ai.status.combatBonus + (ai.activeRelicPower === 'WARLORD' ? 1 : 0);
                     let defStr = 1 + (target.fortification ? 1 : 0);
                     const rollAtt = Math.floor(Math.random() * 6) + 1;
                     const rollDef = Math.floor(Math.random() * 6) + 1;
                     
                     newPlayers[ai.id].stats.attacksMade++;
                     if ((attStr + rollAtt) > (defStr + rollDef)) {
                         const victimId = target.ownerId!;
                         newMap[bestAction.target] = { ...target, ownerId: ai.id, fortification: null };
                         newPlayers[ai.id].stats.battlesWon++;
                         newPlayers[victimId].stats.tilesLost++;
                         const stealable = (['Grain','Stone','Gold'] as Resource[]).filter(r => newPlayers[victimId].resources[r] > 0);
                         if (stealable.length > 0) {
                             const r = stealable[Math.floor(Math.random()*stealable.length)];
                             newPlayers[victimId].resources[r]--;
                             newPlayers[ai.id].resources[r]++;
                         }
                         logMsg = `${ai.name} ATTACKS ${newPlayers[victimId].name} at [${target.diceCoords.col},${target.diceCoords.row}] and WINS! (-${cost} Grain) ${getAiDialogue(ai, 'attack')}`;
                         logType = 'combat';
                     } else {
                         logMsg = `${ai.name} attacks [${target.diceCoords.col},${target.diceCoords.row}] but is repelled. (-${cost} Grain)`;
                         logType = 'combat';
                     }
                     actionSuccess = true;
                 } 
            }
            else if (bestAction.type === 'EXPLORE_EXPAND' && bestAction.target) {
                 const cost = 1 + fatigue;
                 if (pay(cost, 0, tax(CitizenType.Explorer))) {
                     // INTERCEPTION CHALLENGE POINT
                     // AI pauses for human response.
                     // IMPORTANT: AI pays cost immediately, but map update happens after challenge.
                     
                     // Only trigger if human is NOT eliminated
                     if (!human.isEliminated) {
                         const claimedType = TileType.Plains; // AI simplifies bluffing for now
                         const realType = TileType.Plains;
                         
                         // CRITICAL FIX: Increment fatigue for AI so they don't get free actions
                         newPlayers[ai.id].actionsTaken++;

                         // Set pending challenge state for human interception
                         return {
                             ...prev,
                             pendingChallenge: {
                                 isActive: true,
                                 declarerId: ai.id,
                                 hexId: bestAction.target,
                                 declaredType: claimedType,
                                 realType: realType,
                                 timer: 5 // 5 second window
                             },
                             // We DO NOT update map owner yet.
                             // We DO deduct resources already.
                             players: newPlayers
                         };
                     }
                     
                     // Fallback if human dead
                     newMap[bestAction.target].ownerId = ai.id;
                     logMsg = `${ai.name} expands to [${newMap[bestAction.target].diceCoords.col},${newMap[bestAction.target].diceCoords.row}]. (-${cost} Grain) ${getAiDialogue(ai, 'expand')}`;
                     actionSuccess = true;
                 } 
            }
            else if (bestAction.type === 'FORTIFY' && bestAction.target) {
                 const cost = 2 + fatigue;
                 if (pay(0, cost, tax(CitizenType.Builder))) {
                     newMap[bestAction.target].fortification = { ownerId: ai.id, level: 1 };
                     logMsg = `${ai.name} fortifies their position. (-${cost} Stone) ${getAiDialogue(ai, 'fortify')}`;
                     actionSuccess = true;
                 } 
            }
            else if (bestAction.type === 'MERCHANT_TRADE') {
                 const cost = 2 + fatigue;
                 if (pay(cost, 0, tax(CitizenType.Merchant))) {
                     newPlayers[ai.id].resources.Gold++;
                     logMsg = `${ai.name} trades grain for gold. (-${cost} Grain)`;
                     actionSuccess = true;
                 } 
            }

            if (!actionSuccess) {
                 const ps = prev.players.map(p => p.id === ai.id ? { ...p, hasPassed: true } : p);
                 const po = [...prev.passOrder]; if(!po.includes(ai.id)) po.push(ai.id);
                 return { ...prev, players: ps, passOrder: po, logs: [...prev.logs, { id: Date.now().toString(), turn: prev.round, text: `${ai.name} passed.`, type: 'info', actorId: ai.id }] };
            }

            newPlayers[ai.id].actionsTaken++;
            newPlayers[ai.id] = updateMaxResources(newPlayers[ai.id]);
            
            return {
                ...prev,
                players: newPlayers,
                map: newMap,
                logs: [...prev.logs, { id: Date.now().toString(), turn: prev.round, text: logMsg, type: logType, actorId: ai.id }]
            };
        });
        setTimeout(() => advanceTurn(), 500);
    };

    const startGame = (playerCount: number) => {
        setGameState(prev => {
            const map = generateMap(playerCount);
            const objDeck = shuffle([...OBJECTIVES_DECK]);
            const players = createInitialPlayers(map, objDeck, playerCount, isChallengeMode);
            const eventDeck = shuffle([...EVENTS_DECK]);
            
            return {
                ...prev,
                phase: Phase.Income,
                round: 1,
                turnOrderIndex: 0,
                turnOrder: players.map(p => p.id),
                turnTrigger: 0,
                passOrder: [],
                players,
                map,
                logs: [{ id: 'init', turn: 1, text: "Game Initialized. Phase I: Income.", type: 'phase' }],
                activeEvent: null,
                pendingChallenge: null,
                eventDeck,
                discardPile: [],
                objectiveDeck: objDeck,
                publicObjectives: []
            };
        });
        setGameStarted(true);
    };

    return {
        gameState, setGameState, gameStarted, setGameStarted, startGame, handleHumanAction,
        handleRevealPay, handlePhaseTransition, executeAiAction, resolveMapAction, 
        handleChallengeResponse, applyEventEffect, handleHumanDeclaration,
        setIsCasualMode, setIsChallengeMode, isCasualMode, isChallengeMode,
        addLog, advanceTurn, calculateFatigue, resolvingEvent, setResolvingEvent
    };
};