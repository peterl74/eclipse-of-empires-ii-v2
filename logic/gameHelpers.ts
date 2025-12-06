import { Player, HexData, SecretObjective, TileType, Resource, AiState, TraitType, EventCard, CitizenType } from '../types';
import { FACTIONS, VP_CONFIG, TILE_CONFIG, OBJECTIVES_DECK, FACTION_TRAITS, AI_DIALOGUE, EVENTS_DECK } from '../constants';
import { getNeighbors, getHexId } from '../utils/hexUtils';

// --- MATH HELPERS ---
export const calculateFatigue = (actionsTaken: number) => {
    return actionsTaken;
};

// --- SETUP HELPERS ---
export const createInitialPlayers = (map: Record<string, HexData>, objectiveDeck: SecretObjective[], playerCount: number, isChallengeMode: boolean): Player[] => {
  const players: Player[] = [];
  const allIds = Object.keys(map || {});
  const edgeIds = allIds.filter(id => {
     const neighbors = getNeighbors(map[id].q, map[id].r).filter(n => map[getHexId(n.q, n.r)]);
     return neighbors.length < 6;
  }).sort(() => Math.random() - 0.5).slice(0, playerCount);

  FACTIONS.slice(0, playerCount).forEach((faction, idx) => {
      const startHexId = edgeIds[idx];
      let startResources = { [Resource.Grain]: 2, [Resource.Stone]: 1, [Resource.Gold]: 1, [Resource.Relic]: 0 };

      if (map && map[startHexId]) {
          const originalType = map[startHexId].type;
          if (originalType === TileType.Plains) startResources[Resource.Grain] += 2;
          else if (originalType === TileType.Mountains) startResources[Resource.Stone] += 2;
          else if (originalType === TileType.Goldmine) startResources[Resource.Gold] += 2;
          else if (originalType === TileType.RelicSite) { startResources[Resource.Gold]++; startResources[Resource.Stone]++; }
          else { startResources[Resource.Grain]++; startResources[Resource.Stone]++; }

          map[startHexId].type = TileType.Capital; 
          map[startHexId].publicType = TileType.Capital; 
          map[startHexId].ownerId = idx; 
          map[startHexId].isRevealed = true; 
          map[startHexId].fortification = { ownerId: idx, level: 1 }; 
      }

      const secretObj = objectiveDeck.pop() || OBJECTIVES_DECK[0];
      const aiState: AiState | undefined = idx === 0 ? undefined : {
          fear: isChallengeMode ? 30 : 10, 
          suspicion: isChallengeMode ? 30 : 10,
          diplomaticStance: 'Neutral',
          activeTraits: FACTION_TRAITS[faction.name] || (['Cautious'] as TraitType[]),
          lastDialogue: undefined,
          grudges: [],
          lastObservedWealth: 4
      };

      players.push({
          id: idx, name: idx === 0 ? "You" : faction.name, faction, isHuman: idx === 0,
          resources: startResources, activeRelicPower: null, selectedCitizen: null, vp: 0,
          secretObjectives: [secretObj], eventHand: [], hasActed: false, hasPassed: false,
          actionsTaken: 0, isEliminated: false, aiState,
          stats: { battlesWon: 0, tilesRevealed: 0, relicEventsTriggered: 0, maxResourcesHeld: 4, tilesLost: 0, attacksMade: 0, uniquePlayersAttacked: [], relicSitesRevealed: 0 },
          status: { canAttack: true, combatBonus: 0, fortificationBlocked: false, incomeMultiplier: 1, freeTrades: 0, passiveIncome: false, freeFortify: false, extraActions: 0, turnLost: false }
      });
  });
  return players;
};

// --- ECONOMY HELPERS ---
export const getIncomeRate = (player: Player, map: Record<string, HexData>, usePublicTypes = false) => {
    const rates = { [Resource.Grain]: 0, [Resource.Stone]: 0, [Resource.Gold]: 0, [Resource.Relic]: 0 };
    if (!player || !map) return rates;
    
    Object.values(map).forEach(hex => {
        if (hex.ownerId === player.id) {
            const typeToCheck = usePublicTypes ? hex.publicType : hex.type;
            const fortificationBonus = hex.fortification ? 1 : 0;
            if (typeToCheck === TileType.Capital) {
                rates[Resource.Grain] += (1 + fortificationBonus);
                rates[Resource.Stone] += (1 + fortificationBonus);
                rates[Resource.Gold] += (1 + fortificationBonus);
            } else {
                const config = TILE_CONFIG[typeToCheck];
                if (config && config.resource) {
                    rates[config.resource] += (1 + fortificationBonus);
                }
            }
        }
    });
    if (player.activeRelicPower === 'PASSIVE_INCOME' || player.status.passiveIncome) {
        rates[Resource.Grain]++; rates[Resource.Gold]++;
    }
    return rates;
};

export const updateMaxResources = (player: Player): Player => {
    if (!player || !player.resources) return player;
    const total = Object.values(player.resources).reduce((a: number, b: number) => a + b, 0);
    if (total > player.stats.maxResourcesHeld) {
        return { ...player, stats: { ...player.stats, maxResourcesHeld: total } };
    }
    return player;
};

export const updatePlayerStat = (player: Player, statKey: keyof Player['stats'], value: any): Player => {
    const newStats = { ...player.stats };
    if (typeof value === 'number' && typeof newStats[statKey] === 'number') {
        (newStats[statKey] as number) += value;
    } else if (Array.isArray(newStats[statKey]) && typeof value === 'number') {
         if (!(newStats[statKey] as number[]).includes(value)) {
             (newStats[statKey] as number[]).push(value);
         }
    }
    return { ...player, stats: newStats };
};

// --- SCORING HELPERS ---
export const calculateScore = (player: Player, map: Record<string, HexData>, publicObjectives: SecretObjective[]) => {
    if (!player || !map) return { total: 0, breakdown: { tileVp: 0, fortVp: 0, relicVp: 0, totalObjVp: 0 } };

    const ownedTiles = (Object.values(map) as HexData[]).filter(h => h.ownerId === player.id);
    let tileVp = ownedTiles.reduce((acc, t) => acc + (VP_CONFIG[t.type] || 0), 0);
    let fortVp = (Object.values(map) as HexData[]).filter(h => h.fortification?.ownerId === player.id).length * VP_CONFIG.Fortification;
    const relicVp = player.resources[Resource.Relic] * VP_CONFIG.RelicToken;

    let objVp = 0;
    player.secretObjectives.forEach(obj => { if (obj.condition(player, map)) { objVp += obj.vp; } });
    let publicObjVp = 0;
    publicObjectives.forEach(obj => { if (obj.condition(player, map)) publicObjVp += obj.vp; });

    return { total: tileVp + fortVp + relicVp + objVp + publicObjVp, breakdown: { tileVp, fortVp, relicVp, totalObjVp: objVp + publicObjVp } };
};

// --- AI LOGIC V2 (Psychology Engine) ---

export const getAiDialogue = (player: Player, type: 'attack' | 'defend' | 'expand' | 'fortify'): string => {
    const key = type === 'defend' ? 'fear_attack' : type; 
    const texts = AI_DIALOGUE[key as keyof typeof AI_DIALOGUE] || ["..."];
    return texts[Math.floor(Math.random() * texts.length)];
};

export const drawCardHelper = (deck: EventCard[], discard: EventCard[]) => {
    let newDeck = [...deck];
    let newDiscard = [...discard];
    let reshuffled = false;
    if (newDeck.length === 0) {
        if (newDiscard.length === 0) {
            newDeck = [...EVENTS_DECK].sort(() => Math.random() - 0.5);
            reshuffled = true;
        } else {
            newDeck = newDiscard.sort(() => Math.random() - 0.5);
            newDiscard = [];
            reshuffled = true;
        }
    }
    const card = newDeck.pop() || EVENTS_DECK[0];
    newDiscard.push(card);
    return { card, newDeck, newDiscard, reshuffled };
};

// --- NEW UTILITY AI HELPERS ---

export const updateAiPsychology = (ai: Player, human: Player, map: Record<string, HexData>, allPlayers: Player[]) => {
    if (!ai.aiState) return ai;

    const newState = { ...ai.aiState };
    const myTiles = Object.values(map).filter(h => h.ownerId === ai.id);
    const humanTiles = Object.values(map).filter(h => h.ownerId === human.id);
    const humanForts = humanTiles.filter(h => h.fortification).length;
    
    // 1. CALCULATE FEAR (Capability)
    // Metrics: Human Forts + Human Tiles + Human Wealth
    const humanWealth = Object.values(human.resources).reduce((a, b) => a + b, 0);
    const fearScore = (humanForts * 15) + (humanTiles.length * 3) + (humanWealth * 1);
    
    newState.fear = Math.min(100, Math.max(0, fearScore + (ai.aiState.activeTraits.includes('Paranoid') ? 20 : 0)));

    // 2. CALCULATE SUSPICION (Intent)
    // Metrics: Grudges, Proximity, Attacks Made
    let suspicionScore = newState.grudges.reduce((sum, g) => sum + (g.targetId === human.id ? 20 : 0), 0); // Grudges weigh heavily
    
    // Proximity Rule: If Human is adjacent, +20 Suspicion
    const myHexIds = myTiles.map(h => h.id);
    const isAdjacentToHuman = humanTiles.some(ht => 
        getNeighbors(ht.q, ht.r).some(n => myHexIds.includes(getHexId(n.q, n.r)))
    );
    if (isAdjacentToHuman) suspicionScore += 20;

    // Leader Envy: If Human is winning, +20 Suspicion
    if (human.vp > ai.vp + 3) suspicionScore += 20;

    if (human.stats.attacksMade > ai.stats.attacksMade) suspicionScore += 10;
    if (ai.aiState.activeTraits.includes('Paranoid') || ai.aiState.activeTraits.includes('Vengeful')) suspicionScore += 15;

    newState.suspicion = Math.min(100, Math.max(0, suspicionScore));
    newState.lastObservedWealth = humanWealth;

    // 3. STANCE UPDATE
    if (newState.fear > 75 || (newState.fear > 50 && newState.suspicion > 50)) {
        newState.diplomaticStance = 'War';
    } else if (newState.suspicion > 40 || newState.fear > 40) {
        newState.diplomaticStance = 'Hostile';
    } else {
        newState.diplomaticStance = 'Neutral';
    }

    return { ...ai, aiState: newState };
};

export const calculateActionUtility = (ai: Player, actionType: string, targetHexId: string | null, map: Record<string, HexData>, players: Player[]) => {
    let utility = 0;
    const role = ai.selectedCitizen;
    
    // Explicit mapping to handle Action String vs Enum mismatches
    const actionRoleMap: Record<string, CitizenType> = {
        'WARRIOR_ATTACK': CitizenType.Warrior,
        'EXPLORE_EXPAND': CitizenType.Explorer, 
        'FORTIFY': CitizenType.Builder,
        'MERCHANT_TRADE': CitizenType.Merchant
    };
    
    const requiredRole = actionRoleMap[actionType];
    const isMerc = role !== requiredRole;
    
    // 1. BASE UTILITY (Role Efficiency)
    utility += 20; // Bias towards doing SOMETHING
    if (!isMerc) utility += 60; // Huge bonus for using the selected role efficiency

    // 2. CONTEXTUAL UTILITY
    const myTiles = Object.values(map).filter(h => h.ownerId === ai.id);
    const fatigue = ai.actionsTaken;
    
    if (actionType === 'WARRIOR_ATTACK' && targetHexId) {
        const targetHex = map[targetHexId];
        const victim = players[targetHex.ownerId!];
        
        // ATTACK LOGIC
        if (victim.isHuman) {
            // "Human-like" behavior: Attack the leader or the threat
            if (ai.aiState?.diplomaticStance === 'War') utility += 60; 
            else if (ai.aiState?.diplomaticStance === 'Hostile') utility += 30;
            
            // Kingmaking: If human is VP leader, drag them down
            if (victim.vp > ai.vp) utility += 25; 
        }
        
        // Opportunism
        if (!targetHex.fortification) utility += 20; // Weak target
        if (ai.aiState?.activeTraits.includes('Aggressive')) utility += 30;
        
        // Grudge
        if (ai.aiState?.grudges.some(g => g.targetId === victim.id)) utility += 50; // Revenge is sweet
    }
    
    else if (actionType === 'FORTIFY' && targetHexId) {
        utility += 25;
        if (ai.aiState?.fear! > 50) utility += 30;
        if (ai.aiState?.activeTraits.includes('Defensive')) utility += 40;
        if (map[targetHexId].type === TileType.Capital) utility += 30;
    }
    
    else if (actionType === 'EXPLORE_EXPAND' && targetHexId) {
        utility += 40; // High base desire to expand
        if (ai.resources.Grain < 2 && ai.resources.Gold < 2) utility += 30; // Desperate for resources
        if (ai.aiState?.activeTraits.includes('Expansionist')) utility += 25;
        if (myTiles.length < 5) utility += 30; // Early game expand hard
    }
    
    else if (actionType === 'MERCHANT_TRADE') {
        if (ai.resources.Grain >= 3) utility += 60; // Dump excess grain
        if (ai.resources.Gold < 1) utility += 50; // Need gold for Merc actions
        if (ai.aiState?.activeTraits.includes('Greedy')) utility += 30;
    }

    // 3. COST CALCULATION & PENALTY
    let grainCost = 0;
    let goldCost = 0;
    let stoneCost = 0;
    
    const baseCost = fatigue === 0 ? 1 : (1 + fatigue); 
    
    if (actionType === 'WARRIOR_ATTACK' || actionType === 'EXPLORE_EXPAND') grainCost = baseCost;
    if (actionType === 'FORTIFY') stoneCost = baseCost + 1; // Approx 2
    if (isMerc) goldCost = 2;
    
    // Hard affordability check (Utility -> -999 if cannot afford)
    if (ai.resources.Grain < grainCost || ai.resources.Gold < goldCost || ai.resources.Stone < stoneCost) {
        return -999;
    }

    // Soft penalty for cost
    if (isMerc) utility -= 30; // Hate paying taxes
    if (fatigue > 0) utility -= (fatigue * 15); // Hate fatigue

    return utility;
};