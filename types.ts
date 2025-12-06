

export enum Resource {
  Grain = 'Grain',
  Stone = 'Stone',
  Gold = 'Gold',
  Relic = 'Relic' 
}

export enum TileType {
  Plains = 'Plains',
  Mountains = 'Mountains',
  Goldmine = 'Goldmine',
  RelicSite = 'RelicSite',
  Ruins = 'Ruins',
  Capital = 'Capital',
  Trap = 'Trap'
}

export enum CitizenType {
  Merchant = 'Merchant',
  Builder = 'Builder',
  Warrior = 'Warrior',
  Explorer = 'Explorer'
}

export enum Phase {
  Income = 'Income',
  CitizenChoice = 'CitizenChoice',
  Action = 'Action',
  Events = 'Events',
  Scoring = 'Scoring',
  EndGame = 'EndGame'
}

export interface FactionInfo {
  name: string;
  title: string;
  color: string; 
  textColor: string;
  personality: 'AGGRESSIVE' | 'EXPANSIONIST' | 'DEFENSIVE' | 'BALANCED';
}

export interface HexData {
  q: number;
  r: number;
  id: string;
  diceCoords: { col: number; row: number };
  type: TileType;
  publicType: TileType;
  isRevealed: boolean;
  ownerId: number | null; 
  fortification: {
    ownerId: number;
    level: number; 
  } | null;
}

export type EventEffectType = 'RESOURCE_GAIN' | 'RESOURCE_LOSS' | 'FORTIFY_REMOVE' | 'TILE_REMOVE' | 'COMBAT_BONUS' | 'BLOCK_ATTACK' | 'TRADE_FREE' | 'PASSIVE_INCOME' | 'FREE_FORTIFY' | 'DOUBLE_ACTION' | 'WARLORD' | 'TRADE_BARON' | 'DOUBLE_TIME';

export interface EventCard {
  id: string;
  title: string;
  normalText: string;
  relicText: string;
  normalEffect: { type: EventEffectType; value: number; target?: Resource | 'ALL' | 'ENEMY' | 'SELF' | string };
  relicEffect: { type: EventEffectType; value: number; target?: Resource | 'ALL' | 'ENEMY' | 'SELF' | string };
}

export interface SecretObjective {
  id: string;
  name: string;
  description: string;
  vp: number;
  condition: (player: Player, map: Record<string, HexData>) => boolean;
  progress: (player: Player, map: Record<string, HexData>) => string;
}

export interface PlayerStats {
  battlesWon: number;
  tilesRevealed: number;
  relicEventsTriggered: number;
  maxResourcesHeld: number;
  tilesLost: number;
  attacksMade: number;
  uniquePlayersAttacked: number[];
  relicSitesRevealed: number;
}

export type RelicPowerType = 'PASSIVE_INCOME' | 'FREE_FORTIFY' | 'WARLORD' | 'TRADE_BARON' | 'DOUBLE_TIME' | null;
export type DiplomaticStance = 'War' | 'Hostile' | 'Neutral' | 'Pact' | 'Ally';
export type TraitType = 'Aggressive' | 'Cautious' | 'Greedy' | 'Expansionist' | 'Paranoid' | 'Vengeful' | 'Treacherous' | 'Defensive';

export interface AiState {
    fear: number;
    suspicion: number;
    diplomaticStance: DiplomaticStance;
    activeTraits: TraitType[];
    lastDialogue?: string;
    grudges: { targetId: number; reason: string; turn: number }[];
    lastObservedWealth: number;
}

export interface Player {
    id: number;
    name: string;
    faction: FactionInfo;
    isHuman: boolean;
    resources: Record<Resource, number>;
    activeRelicPower: RelicPowerType;
    selectedCitizen: CitizenType | null;
    vp: number;
    secretObjectives: SecretObjective[];
    eventHand: EventCard[];
    hasActed: boolean;
    hasPassed: boolean;
    actionsTaken: number;
    isEliminated: boolean;
    aiState?: AiState;
    stats: PlayerStats;
    status: {
        canAttack: boolean;
        combatBonus: number;
        fortificationBlocked: boolean;
        incomeMultiplier: number;
        freeTrades: number;
        passiveIncome: boolean;
        freeFortify: boolean;
        extraActions: number;
        turnLost: boolean;
    };
}

export interface LogEntry {
    id: string;
    turn: number;
    text: string;
    type: 'info' | 'combat' | 'event' | 'bluff' | 'phase' | 'alert';
    actorId?: number;
    targetId?: number;
    details?: any;
}

export interface PendingChallenge {
    isActive: boolean;
    declarerId: number;
    hexId: string;
    declaredType: TileType;
    realType: TileType;
    timer: number;
}

export interface GameState {
    phase: Phase;
    round: number;
    turnOrderIndex: number;
    turnOrder: number[];
    turnTrigger: number;
    passOrder: number[];
    players: Player[];
    map: Record<string, HexData>;
    logs: LogEntry[];
    uiState: {
        isSelectingTile: boolean;
        isProcessing: boolean;
        actionType: string | null;
        selectedHexId: string | null;
        isDeclaring: boolean;
        pendingHexId: string | null;
        activeSidebarTab: string;
        isMarketOpen: boolean;
        isSelectingRevealCost: boolean;
        pendingActionAfterReveal: any | null;
        flashHexId?: string | null;
        isPushingLimits: boolean;
    };
    activeEvent: EventCard | null;
    pendingChallenge: PendingChallenge | null;
    eventDeck: EventCard[];
    discardPile: EventCard[];
    objectiveDeck: SecretObjective[];
    publicObjectives: SecretObjective[];
}