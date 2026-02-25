import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS, DEPARTMENTS } from '../data/agents';
import { X, Edit2, Plus, Users, ChevronDown, ChevronUp } from 'lucide-react';

interface AgentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const AgentSidebar: React.FC<AgentSidebarProps> = ({ isOpen, onClose }) => {
  const { agentsVersion, updateAgent, addAgent, instanceCount } = useStore();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [mission, setMission] = useState('');
  const [personality, setPersonality] = useState('');
  const [expertise, setExpertise] = useState('');

  // We use agentsVersion to trigger re-renders when agents change
  const _ = agentsVersion;

  const openEdit = (index: number) => {
    const agent = AGENTS[index];
    setRole(agent.role);
    setDepartment(agent.department);
    setMission(agent.mission);
    setPersonality(agent.personality);
    setExpertise(agent.expertise.join(', '));
    setEditingIndex(index);
    setIsCreating(false);
  };

  const openCreate = () => {
    setRole('');
    setDepartment(DEPARTMENTS[0].name);
    setMission('');
    setPersonality('');
    setExpertise('');
    setEditingIndex(null);
    setIsCreating(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const deptConfig = DEPARTMENTS.find(d => d.name === department);
    const agentData = {
      role,
      department,
      mission,
      personality,
      expertise: expertise.split(',').map(s => s.trim()).filter(Boolean),
      color: deptConfig?.color || '#9ca3af',
    };

    if (isCreating) {
      addAgent(agentData);
    } else if (editingIndex !== null) {
      updateAgent(editingIndex, agentData);
    }

    setIsCreating(false);
    setEditingIndex(null);
  };

  return (
    <div className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col pointer-events-auto`}>
      <div className="flex items-center justify-between p-6 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users size={24} className="text-indigo-600" /> Agents
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <X size={20} className="text-gray-500" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        {isCreating || editingIndex !== null ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button 
              type="button" 
              onClick={() => { setIsCreating(false); setEditingIndex(null); }} 
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 mb-2 flex items-center gap-1 transition-colors"
            >
              &larr; Back to list
            </button>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role / Name</label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="e.g. Senior Architect"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white"
              >
                {DEPARTMENTS.map(dept => (
                  <option key={dept.name} value={dept.name}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mission</label>
              <textarea
                required
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all h-24 resize-none"
                placeholder="What is their primary objective?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personality</label>
              <input
                type="text"
                required
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="e.g. Analytical, Cheerful"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expertise (comma separated)</label>
              <input
                type="text"
                value={expertise}
                onChange={(e) => setExpertise(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="e.g. React, Three.js, AI"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
              >
                {isCreating ? 'Create Agent' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <button 
              onClick={openCreate} 
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-2 transition-all font-medium"
            >
              <Plus size={18} /> Create New Agent
            </button>
            
            <div className="space-y-2">
              {(() => {
                const activeCount = Math.min(instanceCount, AGENTS.length);
                const visibleAgents = showAll ? AGENTS : AGENTS.slice(0, activeCount);
                return (
                  <>
                    {visibleAgents.map((agent, idx) => (
                      <div key={idx} className="p-3 border border-gray-100 rounded-xl flex justify-between items-center hover:shadow-md transition-shadow bg-white group">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: agent.color }} />
                          <div>
                            <div className="font-bold text-sm text-gray-900">{agent.role} {agent.isPlayer && '(You)'}</div>
                            <div className="text-xs text-gray-500 font-medium">{agent.department}</div>
                          </div>
                        </div>
                        {!agent.isPlayer && (
                          <button
                            onClick={() => openEdit(idx)}
                            className="p-2 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    {AGENTS.length > activeCount && (
                      <button
                        onClick={() => setShowAll(v => !v)}
                        className="w-full py-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1 transition-colors"
                      >
                        {showAll
                          ? <><ChevronUp size={14} /> Show active only ({activeCount})</>
                          : <><ChevronDown size={14} /> Show all {AGENTS.length} agents</>
                        }
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentSidebar;
