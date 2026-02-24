import React, { useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { AgentBehavior } from '../types';
import { AGENTS } from '../data/agents';
import { X, Activity, MessageSquare, Target } from 'lucide-react';
import * as d3 from 'd3';

const Dashboard: React.FC = () => {
  const { isDashboardOpen, toggleDashboard, agentLogs, debugStates, instanceCount } = useStore();
  const graphRef = useRef<HTMLDivElement>(null);

  // Calculate agent stats
  const stats = useMemo(() => {
    let active = 0;
    let idle = 0;
    let meeting = 0;

    if (debugStates) {
      for (let i = 0; i < instanceCount; i++) {
        const state = debugStates[i * 4 + 3];
        if (state === AgentBehavior.BOIDS) active++;
        else if (state === AgentBehavior.FROZEN) meeting++;
        else if (state === AgentBehavior.GOTO) active++;
      }
    }

    return { active, idle, meeting };
  }, [debugStates, instanceCount]);

  // Graph visualization
  useEffect(() => {
    if (!isDashboardOpen || !graphRef.current) return;

    const width = graphRef.current.clientWidth;
    const height = 300;

    // Clear previous graph
    d3.select(graphRef.current).selectAll('*').remove();

    const svg = d3.select(graphRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Create nodes and links from logs
    const nodesMap = new Map();
    const linksMap = new Map();

    agentLogs.forEach(log => {
      if (log.type === 'conversation' && log.participants.length === 2) {
        const [a, b] = log.participants;
        if (!nodesMap.has(a)) nodesMap.set(a, { id: a, group: AGENTS[a]?.department || 'Unknown' });
        if (!nodesMap.has(b)) nodesMap.set(b, { id: b, group: AGENTS[b]?.department || 'Unknown' });

        const linkId = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!linksMap.has(linkId)) {
          linksMap.set(linkId, { source: a, target: b, value: 1 });
        } else {
          linksMap.get(linkId).value += 1;
        }
      }
    });

    // Add player node if not present
    if (!nodesMap.has(0)) nodesMap.set(0, { id: 0, group: 'Player' });

    const nodes = Array.from(nodesMap.values());
    const links = Array.from(linksMap.values());

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(50))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d.value));

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const node = svg.append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', 5)
      .attr('fill', d => color(d.group))
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    node.append('title')
      .text(d => `Agent ${d.id} (${d.group})`);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [isDashboardOpen, agentLogs]);

  if (!isDashboardOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-100">
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" />
            Agent Network Dashboard
          </h2>
          <button
            onClick={toggleDashboard}
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-3 gap-6">
          {/* Stats & Graph Column */}
          <div className="col-span-2 flex flex-col gap-6">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                <div className="text-sm text-zinc-500 font-medium mb-1">Active Agents</div>
                <div className="text-3xl font-bold text-emerald-600">{stats.active}</div>
              </div>
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                <div className="text-sm text-zinc-500 font-medium mb-1">In Meetings</div>
                <div className="text-3xl font-bold text-indigo-600">{stats.meeting}</div>
              </div>
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                <div className="text-sm text-zinc-500 font-medium mb-1">Total Agents</div>
                <div className="text-3xl font-bold text-zinc-900">{instanceCount}</div>
              </div>
            </div>

            {/* Network Graph */}
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-zinc-100 bg-zinc-50 font-medium text-sm text-zinc-700">
                Communication Network
              </div>
              <div ref={graphRef} className="w-full h-[300px] bg-zinc-50/50" />
            </div>
          </div>

          {/* Logs Column */}
          <div className="col-span-1 flex flex-col bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50 font-medium text-sm text-zinc-700 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Interaction Logs
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {agentLogs.length === 0 ? (
                <div className="text-center text-zinc-400 text-sm py-8">
                  No interactions recorded yet.
                </div>
              ) : (
                agentLogs.map(log => (
                  <div key={log.id} className="text-sm border-l-2 border-indigo-200 pl-3 py-1">
                    <div className="text-xs text-zinc-400 mb-1">
                      {log.timestamp.toLocaleTimeString()}
                    </div>
                    <div className="text-zinc-700">
                      {log.details}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
