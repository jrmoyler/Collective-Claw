
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
  const [isHelpOpen,    setHelpOpen]    = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950 p-6">
        <div className="max-w-md w-full bg-white rounded-[32px] p-10 shadow-2xl text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Activity size={32} />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 mb-4 tracking-tight">Graphics Error</h2>
          <p className="text-zinc-500 text-sm leading-relaxed mb-8">{error}</p>
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
  const hoveredAgent  = hoveredNpcIndex  != null ? AGENTS[hoveredNpcIndex]  ?? null : null;

  const getAgentStateLabel = (index: number | null) => {
    if (index === null || !debugStates) return '';
    const s = debugStates[index * 4 + 3];
    if (s === 0) return 'Active';
    if (s === 1) return 'In Meeting';
    if (s === 2) return 'Moving';
    return 'Idle';
  };

  const handleStartChat = () => { if (selectedNpcIndex !== null) startChat(selectedNpcIndex); };
  const handleEndChat   = () => endChat();

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-8">
      <AnimatePresence>
        <ChatPanel />
      </AnimatePresence>

      {/* Selected bubble (always visible when selected) */}
      {selectedAgent && selectedPosition && (
        <div
          className="absolute z-10 pointer-events-none transition-all duration-75 ease-out"
          style={{ left: selectedPosition.x, top: selectedPosition.y, transform: 'translate(-50%, -100%) translateY(-10px)' }}
        >
          <div className="bg-zinc-800/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedAgent.color }} />
            <div className="flex items-center gap-1.5">
              {selectedAgent.isPlayer ? (
                <span className="text-[10px] font-black uppercase tracking-widest text-white">CEO (You)</span>
              ) : (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">{selectedAgent.role}</span>
                  <span className="text-[10px] text-white/40">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{selectedAgent.department}</span>
                  <span className="text-[10px] text-white/40">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">{getAgentStateLabel(selectedNpcIndex)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hover bubble */}
      {hoveredAgent && hoverPosition && hoveredNpcIndex !== selectedNpcIndex && (
        <div
          className="absolute z-10 pointer-events-none transition-all duration-75 ease-out"
          style={{ left: hoverPosition.x, top: hoverPosition.y, transform: 'translate(-50%, -100%) translateY(-10px)' }}
        >
          <div className="bg-zinc-800/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hoveredAgent.color }} />
            <div className="flex items-center gap-1.5">
              {hoveredAgent.isPlayer ? (
                <span className="text-[10px] font-black uppercase tracking-widest text-white">CEO (You)</span>
              ) : (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">{hoveredAgent.role}</span>
                  <span className="text-[10px] text-white/40">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{hoveredAgent.department}</span>
                  <span className="text-[10px] text-white/40">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">{getAgentStateLabel(hoveredNpcIndex)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top header */}
      <div className="flex justify-between items-start relative z-30">
        {/* Brand card — compact on mobile, full on sm+ */}
        <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-[32px] border border-black/5 shadow-xl pointer-events-auto flex gap-3 sm:gap-4 max-w-[200px] sm:max-w-[340px]">
          <div className="w-2 h-8 sm:h-10 bg-[#7EACEA] rounded-full shrink-0 mt-0.5 sm:mt-1" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
              <h1 className="text-base sm:text-2xl font-black text-zinc-900 tracking-tight truncate">CollectiveClaw</h1>
              <button onClick={() => setHelpOpen(true)} className="text-zinc-300 hover:text-zinc-500 transition-colors shrink-0">
                <HelpCircle size={16} strokeWidth={2} />
              </button>
            </div>
            <p className="text-[11px] sm:text-[13px] text-zinc-400 font-medium leading-snug hidden sm:block">
              Autonomous corporate agent simulation powered by{' '}
              <a href="https://threejs.org" target="_blank" rel="noopener noreferrer" className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-600">three.js</a>
            </p>
          </div>
        </div>

        {/* Action buttons — icon-only on mobile, icon+label on sm+ */}
        <div className="flex gap-1.5 sm:gap-2">
          <button
            onClick={() => useStore.getState().toggleDashboard()}
            title="Dashboard"
            className="pointer-events-auto p-2.5 sm:px-4 sm:py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 border bg-white/80 text-zinc-500 border-black/5 hover:bg-white hover:text-zinc-900 shadow-sm flex items-center gap-2"
          >
            <Activity size={16} /><span className="hidden sm:inline">Dashboard</span>
          </button>
          <button
            onClick={() => setSidebarOpen(true)}
            title="Agents"
            className="pointer-events-auto p-2.5 sm:px-4 sm:py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 border bg-white/80 text-zinc-500 border-black/5 hover:bg-white hover:text-zinc-900 shadow-sm flex items-center gap-2"
          >
            <Users size={16} /><span className="hidden sm:inline">Agents</span>
          </button>
          <button
            onClick={toggleDebug}
            title="Debug"
            className={`pointer-events-auto p-2.5 sm:px-4 sm:py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 border ${
              isDebugOpen ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg' : 'bg-white/80 text-zinc-500 border-black/5 hover:bg-white hover:text-zinc-900'
            }`}
          >
            <span className="sm:hidden">⚙</span>
            <span className="hidden sm:inline">{isDebugOpen ? 'Close Debug' : 'Debug'}</span>
          </button>
        </div>
      </div>

      <DebugPanel />
      <HelpModal isOpen={isHelpOpen} onClose={() => setHelpOpen(false)} />
      <AgentSidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* NPC info panel — bottom-sheet on mobile, floating card on sm+ */}
      {selectedAgent && (
        <div className="absolute bottom-0 left-0 right-0 sm:bottom-8 sm:left-8 sm:right-auto sm:w-72
          bg-white/90 backdrop-blur-2xl
          rounded-t-2xl sm:rounded-2xl
          border-t sm:border border-black/5
          shadow-2xl p-5 pointer-events-auto
          animate-in fade-in slide-in-from-bottom-4 duration-300 z-30 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: selectedAgent.color }} />
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">{selectedAgent.department}</p>
              <h2 className="text-xl font-black text-zinc-900 leading-tight">{selectedAgent.role}</h2>
            </div>
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed mb-3 italic">"{selectedAgent.mission}"</p>
          <div className="flex flex-wrap gap-1 mb-3">
            {selectedAgent.expertise.map((tag) => (
              <span key={tag} className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">{tag}</span>
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
