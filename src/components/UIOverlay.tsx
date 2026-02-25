
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import DebugPanel from './DebugPanel';
import HelpModal from './HelpModal';
import AgentSidebar from './AgentSidebar';
import ChatPanel from './ChatPanel';
import Dashboard from './Dashboard';
import { AGENTS } from '../data/agents';
import { HelpCircle, Users, Activity } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

const UIOverlay: React.FC = () => {
  const { 
    isThinking, 
    isDebugOpen, 
    toggleDebug, 
    selectedNpcIndex,
    selectedPosition,
    hoveredNpcIndex,
    hoverPosition,
    startChat,
    endChat,
    isChatting,
    debugStates,
    activeEncounter,
    error
  } = useStore();
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950 p-6">
        <div className="max-w-md w-full bg-white rounded-[32px] p-10 shadow-2xl text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Activity size={32} />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 mb-4 tracking-tight">Graphics Error</h2>
          <p className="text-zinc-500 text-sm leading-relaxed mb-8">
            {error}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  const selectedAgent = selectedNpcIndex != null ? AGENTS[selectedNpcIndex] ?? null : null;
  const hoveredAgent = hoveredNpcIndex != null ? AGENTS[hoveredNpcIndex] ?? null : null;

  const getAgentStateLabel = (index: number | null) => {
    if (index === null || !debugStates) return '';
    const state = debugStates[index * 4 + 3];
    if (state === 0) return 'Active';
    if (state === 1) return 'In Meeting';
    if (state === 2) return 'Moving';
    return 'Idle';
  };

  const handleStartChat = () => {
    if (selectedNpcIndex !== null) {
      startChat(selectedNpcIndex);
    }
  };

  const handleEndChat = () => {
    endChat();
  };

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-8">
      <AnimatePresence>
        <ChatPanel />
      </AnimatePresence>
      {/* Selected Bubble (Always visible when selected) */}
      {selectedAgent && selectedPosition && (
        <div 
          className="absolute z-10 pointer-events-none transition-all duration-75 ease-out"
          style={{ 
            left: selectedPosition.x, 
            top: selectedPosition.y,
            transform: 'translate(-50%, -100%) translateY(-10px)'
          }}
        >
          <div className="bg-zinc-800/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
            <div 
              className="w-2 h-2 rounded-full shrink-0" 
              style={{ backgroundColor: selectedAgent.color }}
            />
            <div className="flex items-center gap-1.5">
              {selectedAgent.isPlayer ? (
                <span className="text-[10px] font-black uppercase tracking-widest text-white">CEO (You)</span>
              ) : (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">
                    {selectedAgent.role}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {selectedAgent.department}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                    {getAgentStateLabel(selectedNpcIndex)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hover Bubble */}
      {hoveredAgent && hoverPosition && hoveredNpcIndex !== selectedNpcIndex && (
        <div 
          className="absolute z-10 pointer-events-none transition-all duration-75 ease-out"
          style={{ 
            left: hoverPosition.x, 
            top: hoverPosition.y,
            transform: 'translate(-50%, -100%) translateY(-10px)'
          }}
        >
          <div className="bg-zinc-800/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
            <div 
              className="w-2 h-2 rounded-full shrink-0" 
              style={{ backgroundColor: hoveredAgent.color }}
            />
            <div className="flex items-center gap-1.5">
              {hoveredAgent.isPlayer ? (
                <span className="text-[10px] font-black uppercase tracking-widest text-white">CEO (You)</span>
              ) : (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">
                    {hoveredAgent.role}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {hoveredAgent.department}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                    {getAgentStateLabel(hoveredNpcIndex)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex justify-between items-start relative z-30">
        <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-xl max-w-[340px] pointer-events-auto flex gap-4">
          <div className="w-2.5 h-10 bg-[#7EACEA] rounded-full shrink-0 mt-1" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-zinc-900 tracking-tight">CollectiveClaw</h1>
              <button
                onClick={() => setHelpOpen(true)}
                className="text-zinc-300 hover:text-zinc-500 transition-colors"
              >
                <HelpCircle size={22} strokeWidth={2} />
              </button>
            </div>
            <p className="text-[13px] text-zinc-400 font-medium leading-snug">
              Autonomous corporate agent simulation powered by <a href="https://threejs.org" target="_blank" rel="noopener noreferrer" className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-600">three.js</a> WebGPU renderer
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => useStore.getState().toggleDashboard()}
            className="pointer-events-auto px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 border bg-white/80 text-zinc-500 border-black/5 hover:bg-white hover:text-zinc-900 shadow-sm flex items-center gap-2"
          >
            <Activity size={16} /> Dashboard
          </button>

          <button
            onClick={() => setSidebarOpen(true)}
            className="pointer-events-auto px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 border bg-white/80 text-zinc-500 border-black/5 hover:bg-white hover:text-zinc-900 shadow-sm flex items-center gap-2"
          >
            <Users size={16} /> Agents
          </button>

          {/* Debug Button */}
          <button
            onClick={toggleDebug}
            className={`pointer-events-auto px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 border ${
              isDebugOpen
              ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg'
              : 'bg-white/80 text-zinc-500 border-black/5 hover:bg-white hover:text-zinc-900'
            }`}
          >
            {isDebugOpen ? 'Close Debug' : 'Debug'}
          </button>
        </div>
      </div>

      {/* Debug Panel Mount */}
      <DebugPanel />

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setHelpOpen(false)} />
      
      {/* Agent Sidebar */}
      <AgentSidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* NPC Info Panel — shown when an NPC is selected */}
      {selectedAgent && (
        <div className="absolute bottom-8 left-8 w-72 bg-white/85 backdrop-blur-2xl rounded-2xl border border-black/5 shadow-2xl p-5 pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-300 z-30 overflow-hidden">
          {/* Color accent bar */}
          <div 
            className="absolute top-0 left-0 w-full h-1" 
            style={{ backgroundColor: selectedAgent.color }}
          />
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">
                {selectedAgent.department}
              </p>
              <h2 className="text-xl font-black text-zinc-900 leading-tight">{selectedAgent.role}</h2>
            </div>
          </div>

          <p className="text-xs text-zinc-600 leading-relaxed mb-3 italic">
            "{selectedAgent.mission}"
          </p>

          <div className="flex flex-wrap gap-1 mb-3">
            {selectedAgent.expertise.map((tag) => (
              <span key={tag} className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>

          <p className="text-[11px] text-zinc-400 leading-snug mb-5">{selectedAgent.personality}</p>

          {isChatting ? (
            <button
              onClick={handleEndChat}
              style={{ backgroundColor: selectedAgent.color }}
              className="w-full py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-90 active:scale-[0.98] transition-all shadow-lg pointer-events-auto"
            >
              End Chat
            </button>
          ) : (
            <button
              onClick={handleStartChat}
              className="w-full py-3 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black active:scale-[0.98] transition-all shadow-lg shadow-zinc-200 pointer-events-auto"
            >
              {activeEncounter?.isBusy && activeEncounter.npcIndex === selectedNpcIndex ? 'Join Conversation' : 'Start Chat'}
            </button>
          )}
        </div>
      )}

      <Dashboard />
    </div>
  );
};

export default UIOverlay;
