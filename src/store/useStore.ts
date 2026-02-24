
import { create } from 'zustand';
import { CharacterState, AnimationName, PerformanceStats, BoidsParams, ActiveEncounter } from '../types';
import { addAgent as addAgentData } from '../data/agents';

export const useStore = create<CharacterState>()(
  (set, get) => ({
    currentAction: AnimationName.WALK,
    isThinking: false,
    aiResponse: "Hello! I'm your AI character. Type something to talk to me.",
    isDebugOpen: false,
    instanceCount: 100,
    worldSize: 25,      // radius of Kaldera

    // Default Boids Parameters
    boidsParams: {
      speed: 0.025,
      separationRadius: 0.6,
      separationStrength: 0.030,
      alignmentRadius: 3.0,
      cohesionRadius: 3.0
    },

    debugPositions: null,
    debugStates: null,
    activeEncounter: null,
    selectedNpcIndex: null,
    selectedPosition: null,
    hoveredNpcIndex: null,
    hoverPosition: null,
    playerWaypoint: null,
    isChatting: false,
    chatMessages: [],
    agentLogs: [],
    isDashboardOpen: false,

    performance: {
      fps: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      entities: 0
    },

    agentsVersion: 0,
    addAgent: (agentData: any) => {
      const currentCount = get().instanceCount;
      addAgentData(agentData, currentCount);
      set((state) => ({ 
        instanceCount: state.instanceCount + 1,
        agentsVersion: state.agentsVersion + 1
      }));
    },

    updateAgent: (index: number, agentData: any) => {
      addAgentData(agentData, index);
      set((state) => ({ agentsVersion: state.agentsVersion + 1 }));
    },

    setAnimation: (name: string) => set({ currentAction: name }),
    setThinking: (isThinking: boolean) => set({ isThinking }),
    setAIResponse: (aiResponse: string) => set({ aiResponse }),
    toggleDebug: () => set((state) => ({ isDebugOpen: !state.isDebugOpen })),
    toggleDashboard: () => set((state) => ({ isDashboardOpen: !state.isDashboardOpen })),
    setInstanceCount: (count: number) => set({ instanceCount: count }),
    setWorldSize: (size: number) => set({ worldSize: size }),

    setBoidsParams: (params) => set((state) => ({
      boidsParams: { ...state.boidsParams, ...params }
    })),

    setDebugPositions: (positions) => set({ debugPositions: positions }),
    setDebugStates: (states) => set({ debugStates: states }),
    setActiveEncounter: (encounter: ActiveEncounter | null) => set({ activeEncounter: encounter }),
    setSelectedNpc: (index: number | null) => set({ selectedNpcIndex: index, selectedPosition: null }),
    setSelectedPosition: (pos: { x: number; y: number } | null) => set((state) => {
      if (!pos && !state.selectedPosition) return state;
      if (pos && state.selectedPosition) {
        if (Math.abs(pos.x - state.selectedPosition.x) < 1 && Math.abs(pos.y - state.selectedPosition.y) < 1) {
          return state;
        }
      }
      return { selectedPosition: pos };
    }),
    setHoveredNpc: (index: number | null, pos: { x: number; y: number } | null) => set((state) => {
      if (index === state.hoveredNpcIndex && !pos && !state.hoverPosition) return state;
      if (index === state.hoveredNpcIndex && pos && state.hoverPosition) {
        if (Math.abs(pos.x - state.hoverPosition.x) < 1 && Math.abs(pos.y - state.hoverPosition.y) < 1) {
          return state;
        }
      }
      return { hoveredNpcIndex: index, hoverPosition: pos };
    }),
    setPlayerWaypoint: (pos) => set({ playerWaypoint: pos }),
    startChat: () => {},
    endChat: () => {},
    sendMessage: async () => {},

    updatePerformance: (performance: PerformanceStats) => set({ performance }),
    addAgentLog: (log) => set((state) => ({
      agentLogs: [{ ...log, id: Math.random().toString(36).substr(2, 9), timestamp: new Date() }, ...state.agentLogs].slice(0, 500)
    })),
  })
);
