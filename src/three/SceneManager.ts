
import { Engine } from './core/Engine';
import { Stage } from './core/Stage';
import { CharacterManager } from './entities/CharacterManager';
import { InputManager } from './input/InputManager';
import { BehaviorManager } from './behavior/BehaviorManager';
import { SpeechBubbles } from './entities/SpeechBubbles';
import { AGENTS, PLAYER_INDEX } from '../data/agents';
import { useStore } from '../store/useStore';
import { AgentBehavior, ChatMessage } from '../types';
import { geminiService } from '../services/geminiService';
import * as THREE from 'three/webgpu';

export class SceneManager {
  private engine: Engine;
  private stage: Stage | null = null;
  private characters: CharacterManager | null = null;
  private speechBubbles: SpeechBubbles | null = null;

  private inputManager: InputManager | null = null;
  private behaviorManager: BehaviorManager | null = null;
  private selectedIndex: number | null = null;

  private frameCount = 0;
  private lastTime = 0;
  private unsubs: (() => void)[] = [];
  private isDisposed = false;
  private readonly boundOnResize = this.onResize.bind(this);

  constructor(private container: HTMLElement) {
    this.engine = new Engine(container);
    this.init();
  }

  private async init() {
    const success = await this.engine.init(this.container);
    if (!success) {
      useStore.setState({ error: 'Failed to initialize 3D Graphics. Your browser may not support WebGPU or WebGL2, or hardware acceleration might be disabled.' });
      return;
    }
    if (this.isDisposed) return;

    // Only create stage and characters after successful engine init
    this.stage = new Stage(this.engine.renderer.domElement);
    this.characters = new CharacterManager(this.stage.scene);

    const loaded = await this.characters.load();
    if (!loaded) {
      useStore.setState({ error: 'Failed to load the 3D character model. Please check your network connection and reload.' });
      return;
    }
    if (this.isDisposed) return;

    this.characters.setMode(this.engine.isWebGPU);

    const state = useStore.getState();

    // Initial sync
    this.characters?.setInstanceCount(state.instanceCount);
    this.characters?.updateBoidsParams(state.boidsParams);
    this.characters?.updateWorldSize(state.worldSize);
    this.stage?.updateDimensions(state.worldSize);

    this.engine.renderer.setAnimationLoop(this.animate.bind(this));
    window.addEventListener('resize', this.boundOnResize);

    const stateBuffer = this.characters?.getAgentStateBuffer();
    if (stateBuffer && this.stage) {
      this.behaviorManager = new BehaviorManager(
        stateBuffer,
        AGENTS,
        (encounter) => {
          if (!useStore.getState().isChatting) {
            useStore.getState().setActiveEncounter(encounter);
          }
        },
      );
      this.speechBubbles = new SpeechBubbles(this.stage.scene, 500); // Max 500 agents
    }

    this.inputManager = new InputManager(
      this.engine.renderer.domElement,
      this.stage?.camera as any,
      () => this.characters?.getCPUPositions() ?? null,
      () => this.characters?.getCount() ?? 0,
      (index) => {
        this.selectedIndex = index;
        // Update store: null = default (follow player), number = selected NPC
        useStore.getState().setSelectedNpc(index !== PLAYER_INDEX ? index : null);
        
        // If we click anywhere (even the same NPC or floor), and we are chatting, end it.
        // The user wants to end chat when clicking on the scene.
        if (useStore.getState().isChatting) {
          useStore.getState().endChat();
        }
      },
      (x, z) => { 
        const { worldSize } = useStore.getState();
        // Constrain to grid boundaries
        if (Math.abs(x) <= worldSize && Math.abs(z) <= worldSize) {
          this.behaviorManager?.setPlayerWaypoint(x, z); 
          useStore.getState().setPlayerWaypoint({ x, z });
        }
      },
      (index, pos) => { useStore.getState().setHoveredNpc(index, pos); },
    );

    useStore.setState({
      startChat: async (index: number) => {
        const positions = this.characters?.getCPUPositions();
        if (positions) {
          this.behaviorManager?.startChat(index, positions);
          useStore.setState({ 
            isChatting: true,
            chatMessages: [],
            isThinking: true
          });

          // Auto-presentation
          const agent = AGENTS[index];
          try {
            const systemInstruction = `You are ${agent.role} at CollectiveClaw. 
Department: ${agent.department}
Mission: ${agent.mission}
Personality: ${agent.personality}
Expertise: ${agent.expertise.join(', ')}

Keep your responses extremely brief (1-2 short sentences max) and professional.
CRITICAL INSTRUCTION: Your responses MUST be heavily influenced by your specific Personality and Mission. Speak and act exactly as someone with this personality and mission would. Introduce yourself very briefly and ask how you can help.`;

            const responseText = await geminiService.chat(
              systemInstruction,
              [],
              "Hello! Please introduce yourself briefly."
            );

            const modelMessage: ChatMessage = {
              role: 'model',
              text: responseText,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            useStore.setState((s) => ({ 
              chatMessages: [modelMessage],
              isThinking: false 
            }));
            
            this.characters?.fadeToAction('Wave');
            setTimeout(() => this.characters?.fadeToAction('Idle'), 2000);
          } catch (error) {
            console.error("Auto-presentation error:", error);
            useStore.setState({ isThinking: false });
          }
        }
      },
      endChat: () => {
        const { selectedNpcIndex } = useStore.getState();
        this.behaviorManager?.endChat(selectedNpcIndex);
        useStore.setState({ 
          isChatting: false,
          chatMessages: []
        });
      },
      sendMessage: async (text: string) => {
        const state = useStore.getState();
        if (state.selectedNpcIndex === null || state.isThinking) return;

        const agent = AGENTS[state.selectedNpcIndex];
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const userMessage: ChatMessage = {
          role: 'user',
          text,
          timestamp
        };

        useStore.setState((s) => ({ 
          chatMessages: [...s.chatMessages, userMessage],
          isThinking: true 
        }));

        try {
          const systemInstruction = `You are ${agent.role} at CollectiveClaw. 
Department: ${agent.department}
Mission: ${agent.mission}
Personality: ${agent.personality}
Expertise: ${agent.expertise.join(', ')}

Keep your responses extremely brief (1-2 short sentences max) and professional.
CRITICAL INSTRUCTION: Your responses MUST be heavily influenced by your specific Personality and Mission. Speak and act exactly as someone with this personality and mission would.`;

          const responseText = await geminiService.chat(
            systemInstruction,
            useStore.getState().chatMessages.slice(0, -1), // History without the last user message
            text
          );

          const modelMessage: ChatMessage = {
            role: 'model',
            text: responseText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          useStore.setState((s) => ({ 
            chatMessages: [...s.chatMessages, modelMessage],
            isThinking: false 
          }));
          
          this.characters?.fadeToAction('Wave');
          setTimeout(() => this.characters?.fadeToAction('Idle'), 2000);

        } catch (error) {
          console.error("Gemini Error:", error);
          useStore.setState({ isThinking: false });
        }
      }
    });

    // Subscriptions
    const sub1 = useStore.subscribe((state) => {
      this.characters.fadeToAction(state.currentAction);
    });

    const sub2 = useStore.subscribe((state, prevState) => {
      if (state.instanceCount !== prevState.instanceCount) {
        this.characters.setInstanceCount(state.instanceCount);
      } else if (state.agentsVersion !== prevState.agentsVersion) {
        this.characters.reinit();
      }
      // Update Uniforms when params change
      if (state.boidsParams !== prevState.boidsParams) {
        this.characters.updateBoidsParams(state.boidsParams);
      }

      // Update World Size
      if (state.worldSize !== prevState.worldSize) {
        this.characters.updateWorldSize(state.worldSize);
        this.stage.updateDimensions(state.worldSize);
      }

      // Update Simulation Controls
      if (state.isPaused !== prevState.isPaused) {
        this.characters.setPaused(state.isPaused);
      }
      if (state.timeScale !== prevState.timeScale) {
        this.characters.setTimeScale(state.timeScale);
      }
    });

    const sub3 = useStore.subscribe((state, prevState) => {
      if (state.activeEncounter !== prevState.activeEncounter) {
        if (state.activeEncounter) {
          const npcIndex = state.activeEncounter.npcIndex;
          if (!state.isChatting || state.selectedNpcIndex !== npcIndex) {
            useStore.getState().setSelectedNpc(npcIndex);
            // Do not auto-start chat; require user approval (clicking Start Chat)
          }
        } else {
          if (state.isChatting) {
            useStore.getState().endChat();
          }
          if (prevState.activeEncounter && state.selectedNpcIndex === prevState.activeEncounter.npcIndex) {
            useStore.getState().setSelectedNpc(null);
          }
        }
      }
    });

    const sub4 = useStore.subscribe((state, prevState) => {
      if (state.playerWaypoint !== prevState.playerWaypoint) {
        this.stage.setWaypointMarker(state.playerWaypoint);
      }
    });

    this.unsubs.push(sub1, sub2, sub3, sub4);
  }

  private onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.engine.onResize(w, h);
    this.stage.onResize(w, h);
  }

  private animate() {
    if (this.isDisposed) return;
    this.engine.timer.update();
    const delta = this.engine.timer.getDelta();
    const time = this.engine.timer.getElapsed();

    this.stage?.update();

    // 1. GPU Update
    this.characters?.update(delta, this.engine.renderer);

    // 2. GPU → CPU readback (async, 1-frame lag). Keeps debugPosArray in sync with the compute shader.
    //    Used for picking, camera follow, and the debug canvas/markers.
    const { isDebugOpen, isDashboardOpen } = useStore.getState();
    this.characters?.syncFromGPU(this.engine.renderer)
      .then((positions) => {
        if (this.isDisposed || !this.stage || !this.characters) return;
        if (!positions) return;
        // Run behavior logic with fresh GPU positions
        this.behaviorManager?.update(positions);
        
        if (isDebugOpen) {
          useStore.getState().setDebugPositions(new Float32Array(positions));
        }
        
        if (isDebugOpen || isDashboardOpen || useStore.getState().hoveredNpcIndex !== null || useStore.getState().selectedNpcIndex !== null) {
          const stateBuffer = this.characters.getAgentStateBuffer();
          if (stateBuffer) {
            useStore.getState().setDebugStates(new Float32Array(stateBuffer.array));
          }
        }

        const stateBuffer = this.characters.getAgentStateBuffer();
        if (stateBuffer && this.speechBubbles) {
          this.speechBubbles.update(new Float32Array(positions), stateBuffer, this.stage.camera);
        }
      })
      .catch((error) => {
        console.warn('GPU->CPU sync failed for current frame:', error);
      });

    // 3. Camera follow: NPC if one is selected, otherwise always follow the player
    const { isChatting, selectedNpcIndex, setSelectedPosition } = useStore.getState();
    const followIdx = this.selectedIndex ?? PLAYER_INDEX;
    const pos = this.characters?.getCPUPosition(followIdx);
    this.stage?.setFollowTarget(pos ?? null);

    // Update selected NPC screen position for UI bubble
    if (selectedNpcIndex !== null && this.characters && this.stage) {
      const npcPos = this.characters.getCPUPosition(selectedNpcIndex);
      if (npcPos) {
        const screenPos = npcPos.clone();
        screenPos.y += 1.3; // CHARACTER_Y_OFFSET + bubble offset
        screenPos.project(this.stage.camera);
        
        const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (screenPos.y * -0.5 + 0.5) * window.innerHeight;
        setSelectedPosition({ x, y });
      }
    } else {
      setSelectedPosition(null);
    }

    // 4. Chat camera logic
    if (isChatting && this.stage && this.characters) {
      // Disable controls while moving to NPC
      const playerState = this.characters.getAgentState(PLAYER_INDEX);
      if (playerState === AgentBehavior.GOTO) {
        if (this.stage.controls) this.stage.controls.enabled = false;
        // Slow zoom in
        if (this.stage.controls) {
          this.stage.controls.minDistance = THREE.MathUtils.lerp(this.stage.controls.minDistance, 4, 0.05);
          this.stage.controls.maxDistance = THREE.MathUtils.lerp(this.stage.controls.maxDistance, 6, 0.05);
        }
      } else {
        // Re-enable controls once arrived
        if (this.stage.controls) {
          this.stage.controls.enabled = true;
          // Keep it zoomed in but allow some zoom range
          this.stage.controls.minDistance = THREE.MathUtils.lerp(this.stage.controls.minDistance, 3, 0.05);
          this.stage.controls.maxDistance = THREE.MathUtils.lerp(this.stage.controls.maxDistance, 10, 0.05);
        }
      }
    } else if (this.stage) {
      // Reset camera constraints when not chatting
      if (this.stage.controls) {
        this.stage.controls.enabled = true;
        this.stage.controls.minDistance = THREE.MathUtils.lerp(this.stage.controls.minDistance, 3, 0.05);
        this.stage.controls.maxDistance = THREE.MathUtils.lerp(this.stage.controls.maxDistance, 50, 0.05);
      }
    }

    if (this.stage) {
      this.engine.render(this.stage.scene, this.stage.camera);
    }

    this.updateStats(time);
  }

  private updateStats(time: number) {
    this.frameCount++;
    if (this.frameCount >= 20) {
      const fps = Math.round(20 / (time - this.lastTime));
      const info = this.engine.renderer.info;
      const count = this.characters?.getCount() ?? 0;

      useStore.getState().updatePerformance({
        fps,
        drawCalls: info.render.drawCalls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        entities: count
      });

      this.frameCount = 0;
      this.lastTime = time;
    }
  }

  public dispose() {
    this.isDisposed = true;
    this.unsubs.forEach(unsub => unsub());
    window.removeEventListener('resize', this.boundOnResize);
    this.inputManager?.dispose();
    this.speechBubbles?.dispose();
    this.engine.dispose();
    if (this.stage?.controls) this.stage.controls.dispose();
  }
}
