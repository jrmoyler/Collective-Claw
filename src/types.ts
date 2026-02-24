
export interface PerformanceStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  entities: number;
}

export interface BoidsParams {
  speed: number;
  separationRadius: number;
  separationStrength: number;
  alignmentRadius: number;
  cohesionRadius: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface AgentLog {
  id: string;
  timestamp: Date;
  type: 'conversation' | 'decision' | 'mission';
  participants: number[];
  details: string;
}

export interface CharacterState {
  currentAction: string;
  isThinking: boolean;
  aiResponse: string;
  isDebugOpen: boolean;
  instanceCount: number;
  worldSize: number;
  boidsParams: BoidsParams;
  debugPositions: Float32Array | null;
  debugStates: Float32Array | null;    // vec4 stride: .w = AgentBehavior per instance
  activeEncounter: ActiveEncounter | null;
  selectedNpcIndex: number | null;    // NPC explicitly clicked in the scene
  selectedPosition: { x: number; y: number } | null; // Screen coordinates for selected bubble
  hoveredNpcIndex: number | null;     // NPC currently under the cursor
  hoverPosition: { x: number; y: number } | null; // Screen coordinates for hover bubble
  playerWaypoint: { x: number; z: number } | null; // World coordinates for the player's destination
  isChatting: boolean;
  chatMessages: ChatMessage[];
  agentLogs: AgentLog[];
  isDashboardOpen: boolean;

  performance: PerformanceStats;

  agentsVersion: number;
  addAgent: (agent: any) => void;
  updateAgent: (index: number, agent: any) => void;
  setAnimation: (name: string) => void;
  setThinking: (isThinking: boolean) => void;
  setAIResponse: (response: string) => void;
  toggleDebug: () => void;
  toggleDashboard: () => void;
  setInstanceCount: (count: number) => void;
  setWorldSize: (size: number) => void;
  setBoidsParams: (params: Partial<BoidsParams>) => void;
  setDebugPositions: (positions: Float32Array) => void;
  setDebugStates: (states: Float32Array) => void;
  setActiveEncounter: (encounter: ActiveEncounter | null) => void;
  setSelectedNpc: (index: number | null) => void;
  setSelectedPosition: (pos: { x: number; y: number } | null) => void;
  setHoveredNpc: (index: number | null, pos: { x: number; y: number } | null) => void;
  setPlayerWaypoint: (pos: { x: number; z: number } | null) => void;
  startChat: (index: number) => void;
  endChat: () => void;
  sendMessage: (text: string) => Promise<void>;
  updatePerformance: (stats: PerformanceStats) => void;
  addAgentLog: (log: Omit<AgentLog, 'id' | 'timestamp'>) => void;
}

export enum AnimationName {
  IDLE = 'Idle',
  WALK = 'Walk'
}

/** Stored as a float in the GPU agent buffer (.w component). */
export enum AgentBehavior {
  BOIDS = 0,   // follows Reynolds separation
  FROZEN = 1,  // position locked, velocity zero
  GOTO = 2,    // moves toward waypoint (.x/.z of agent buffer)
}

export interface ActiveEncounter {
  npcIndex: number;
  npcDepartment: string;
  npcRole: string;
  npcMission: string;
  npcPersonality: string;
}
