import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  Fn,
  instanceIndex,
  storage,
  float,
  vec3,
  vec4,
  mat3,
  mat4,
  uint,
  If,
  Loop,
  uniform,
  atan,
  attribute,
  positionLocal,
  time,
  texture,
  sin,
  cos
} from 'three/tsl';
import { BoidsParams, AgentBehavior } from '../../types';
import { AgentStateBuffer } from '../behavior/AgentStateBuffer';
import { AGENTS, PLAYER_INDEX } from '../../data/agents';

export class CharacterManager {
  private instanceCount = 100;

  // GPU buffers
  private posAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private velAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private timeOffsetAttribute: THREE.InstancedBufferAttribute | null = null;
  private colorAttribute: THREE.InstancedBufferAttribute | null = null;
  private positionStorage: any;
  private velocityStorage: any;

  // Agent state buffer (CPU + GPU)
  private agentStateBuffer: AgentStateBuffer | null = null;

  // CPU mirror of GPU positions — kept in sync regardless of mode
  private debugPosArray: Float32Array | null = null;

  // GPU compute node (WebGPU path only)
  private computeNode: any;

  // Scene objects
  private instancedMesh: THREE.Mesh | null = null;
  private baseGeometry: THREE.BufferGeometry | null = null;
  private baseMaterial: THREE.MeshStandardMaterial | null = null;

  // Baked animation data
  private bakedWalkBuffer: THREE.StorageBufferAttribute | null = null;
  private bakedIdleBuffer: THREE.StorageBufferAttribute | null = null;
  private numWalkFrames = 0;
  private numIdleFrames = 0;
  private walkDuration = 0;
  private idleDuration = 0;
  private numBones = 0;

  // Shared uniforms (read by both GPU shader and CPU loop)
  private uSpeed            = uniform(0.015);
  private uSeparationRadius = uniform(0.6);
  private uSeparationStrength = uniform(0.030);
  private uWorldSize        = uniform(20.0);
  private uPaused           = uniform(0.0);
  private uTimeScale        = uniform(1.0);
  private worldSize         = 20.0;

  /**
   * Whether the WebGPU compute backend is active.
   * Set by SceneManager via setMode() after renderer.init() resolves.
   */
  private useGPUCompute = false;

  // GPU readback throttle
  private lastSyncTime = 0;
  private isSyncing    = false;

  public isLoaded = false;

  constructor(private scene: THREE.Scene) {}

  // ─────────────────────────────────────────────────────────────
  //  Public configuration
  // ─────────────────────────────────────────────────────────────

  /**
   * Choose GPU compute (WebGPU) or CPU simulation (WebGL / all other browsers).
   * Must be called after load() and before the animation loop starts.
   */
  public setMode(isWebGPU: boolean): void {
    this.useGPUCompute = isWebGPU;
    if (!isWebGPU) {
      // Compute node is unused — release reference.
      this.computeNode = null;
      console.info('[CharacterManager] CPU simulation mode (WebGL/non-WebGPU backend).');
    } else {
      console.info('[CharacterManager] GPU compute mode (WebGPU backend).');
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Lifecycle
  // ─────────────────────────────────────────────────────────────

  public async load(): Promise<boolean> {
    const loader = new GLTFLoader();
    try {
      const gltf  = await loader.loadAsync('/models/character.glb');
      const model = gltf.scene;

      let skinnedMesh: THREE.SkinnedMesh | null = null;
      model.traverse((child) => {
        if ((child as any).isSkinnedMesh && !skinnedMesh) {
          skinnedMesh = child as THREE.SkinnedMesh;
        }
      });

      const walkClip = gltf.animations[1];
      const idleClip = gltf.animations[0];
      if (!skinnedMesh || !walkClip) {
        console.error('[CharacterManager] Required animation clips not found in GLB.');
        return false;
      }

      this.baseGeometry = skinnedMesh.geometry;
      this.baseMaterial = skinnedMesh.material as THREE.MeshStandardMaterial;

      const walkData        = this.bakeAnimation(skinnedMesh, walkClip, model);
      this.bakedWalkBuffer  = walkData.buffer;
      this.numWalkFrames    = walkData.numFrames;
      this.walkDuration     = walkData.duration;
      this.numBones         = walkData.numBones;

      if (idleClip) {
        const idleData        = this.bakeAnimation(skinnedMesh, idleClip, model);
        this.bakedIdleBuffer  = idleData.buffer;
        this.numIdleFrames    = idleData.numFrames;
        this.idleDuration     = idleData.duration;
      } else {
        this.bakedIdleBuffer  = this.bakedWalkBuffer;
        this.numIdleFrames    = this.numWalkFrames;
        this.idleDuration     = this.walkDuration;
      }

      this.initInstances();
      this.isLoaded = true;
      return true;
    } catch (err) {
      console.error('[CharacterManager] Failed to load character model:', err);
      return false;
    }
  }

  public setInstanceCount(count: number) {
    if (this.instanceCount === count) return;
    this.instanceCount = count;
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }

  public reinit() {
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }

  public updateBoidsParams(params: BoidsParams) {
    this.uSpeed.value             = params.speed;
    this.uSeparationRadius.value  = params.separationRadius;
    this.uSeparationStrength.value = params.separationStrength;
  }

  public updateWorldSize(size: number) {
    this.uWorldSize.value = size;
    this.worldSize        = size;
  }

  public setPaused(paused: boolean) {
    this.uPaused.value = paused ? 1.0 : 0.0;
  }

  public setTimeScale(scale: number) {
    this.uTimeScale.value = scale;
  }

  // ─────────────────────────────────────────────────────────────
  //  Per-frame update
  // ─────────────────────────────────────────────────────────────

  public update(_delta: number, renderer: any) {
    if (this.useGPUCompute && this.computeNode) {
      try {
        renderer.compute(this.computeNode);
      } catch (e) {
        // renderer.compute() failed — backend was probably recreated as WebGL.
        // Switch to CPU for all future frames.
        console.warn('[CharacterManager] renderer.compute() failed; switching to CPU mode:', e);
        this.useGPUCompute = false;
        this.computeNode   = null;
        this.updateCPU();
      }
    } else if (!this.useGPUCompute) {
      this.updateCPU();
    }
  }

  /**
   * CPU boids simulation — mirrors the GPU compute shader logic 1:1.
   *
   * Runs on every browser that lacks WebGPU support:
   *   • Firefox (no WebGPU as of 2026)
   *   • Safari (no WebGPU on iOS; partial on macOS)
   *   • All mobile browsers (iOS/Android)
   *   • Older Chrome without the flag
   *
   * After each tick it marks posAttribute and velAttribute needsUpdate so
   * Three.js re-uploads the arrays to the GPU for rendering.
   */
  private updateCPU(): void {
    if (!this.posAttribute || !this.velAttribute || !this.agentStateBuffer) return;
    if (this.uPaused.value === 1.0) return;

    const pos    = this.posAttribute.array as Float32Array;
    const vel    = this.velAttribute.array as Float32Array;
    const states = this.agentStateBuffer.array;
    const n      = this.instanceCount;

    const speed  = this.uSpeed.value * this.uTimeScale.value;
    const sepR   = this.uSeparationRadius.value;
    const sepR2  = sepR * sepR;
    const sepStr = this.uSeparationStrength.value;
    const ws     = this.uWorldSize.value;

    for (let i = 0; i < n; i++) {
      const state = states[i * 4 + 3];
      const ix    = i * 4;

      if (state > 1.5) {
        // ── GOTO ──────────────────────────────────────────────
        const wpx  = states[ix];
        const wpz  = states[ix + 2];
        const dx   = wpx - pos[ix];
        const dz   = wpz - pos[ix + 2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.2) {
          const goSpeed = speed * 3.0;
          const vx = (dx / dist) * goSpeed;
          const vz = (dz / dist) * goSpeed;
          vel[ix]     = vx;
          vel[ix + 2] = vz;
          pos[ix]     += vx;
          pos[ix + 2] += vz;
        }

      } else if (state > 0.5) {
        // ── FROZEN ────────────────────────────────────────────
        // Write facing direction into velocity so the vertex shader
        // can compute the correct yaw rotation (matches GPU shader).
        const fx = states[ix];
        const fz = states[ix + 2];
        const fl = Math.sqrt(fx * fx + fz * fz);
        if (fl > 0.001) {
          vel[ix]     = fx;
          vel[ix + 2] = fz;
        }
        // Position is unchanged.

      } else {
        // ── BOIDS ─────────────────────────────────────────────
        const px = pos[ix];
        const pz = pos[ix + 2];
        let vx   = vel[ix];
        let vz   = vel[ix + 2];
        let ax   = 0.0;
        let az   = 0.0;

        // Boundary repulsion (square world)
        if (Math.abs(px) > ws || Math.abs(pz) > ws) {
          const bl = Math.sqrt(px * px + pz * pz);
          if (bl > 0) { ax -= (px / bl) * 0.01; az -= (pz / bl) * 0.01; }
        }

        // Separation
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const jx  = j * 4;
          const ddx = px - pos[jx];
          const ddz = pz - pos[jx + 2];
          const d2  = ddx * ddx + ddz * ddz;
          if (d2 < sepR2 && d2 > 0.0001) {
            const d  = Math.sqrt(d2);
            ax += (ddx / d) * sepStr;
            az += (ddz / d) * sepStr;
          }
        }

        vx += ax; vz += az;
        const spd = Math.sqrt(vx * vx + vz * vz);
        if (spd > 0.001) {
          vx = (vx / spd) * speed;
          vz = (vz / spd) * speed;
        } else {
          vx = 0; vz = speed;
        }

        vel[ix]     = vx;   vel[ix + 2] = vz;
        pos[ix]     += vx;  pos[ix + 2] += vz;
      }
    }

    // Upload updated arrays to the GPU for rendering.
    this.posAttribute.needsUpdate = true;
    this.velAttribute.needsUpdate = true;

    // debugPosArray points to the live array — no copy needed.
    this.debugPosArray = pos;
  }

  /**
   * GPU readback (WebGPU) or immediate return (CPU mode).
   * Returns null when throttled or buffers not ready.
   */
  public async syncFromGPU(renderer: any): Promise<Float32Array | null> {
    if (!this.posAttribute) return null;

    // CPU mode: positions are already current in posAttribute.array.
    if (!this.useGPUCompute) return this.debugPosArray;

    // WebGPU: throttled async readback (~20 fps max to avoid stalling the pipeline).
    const now = performance.now();
    if (this.isSyncing || now - this.lastSyncTime < 50) return null;

    this.isSyncing = true;
    try {
      const buffer       = await renderer.getArrayBufferAsync(this.posAttribute);
      this.debugPosArray = new Float32Array(buffer);
      this.lastSyncTime  = performance.now();
      return this.debugPosArray;
    } catch {
      return null;
    } finally {
      this.isSyncing = false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Instance management
  // ─────────────────────────────────────────────────────────────

  private cleanupInstances() {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh = null;
    }
    this.computeNode = null;
  }

  private initInstances() {
    if (!this.baseGeometry || !this.baseMaterial) return;

    const posArray        = new Float32Array(this.instanceCount * 4);
    const velArray        = new Float32Array(this.instanceCount * 4);
    const timeOffsetArray = new Float32Array(this.instanceCount);
    const colorArray      = new Float32Array(this.instanceCount * 3);
    const tempColor       = new THREE.Color();
    const spawnRadius     = this.worldSize;

    for (let i = 0; i < this.instanceCount; i++) {
      const agent = AGENTS[i] || AGENTS[0];
      if (i === PLAYER_INDEX) {
        posArray[i * 4 + 0] = 0;
        posArray[i * 4 + 2] = 0;
        posArray[i * 4 + 3] = 1;
      } else {
        posArray[i * 4 + 0] = (Math.random() - 0.5) * spawnRadius * 2;
        posArray[i * 4 + 2] = (Math.random() - 0.5) * spawnRadius * 2;
        posArray[i * 4 + 3] = 1;
        velArray[i * 4 + 0] = (Math.random() - 0.5) * 0.1;
        velArray[i * 4 + 2] = (Math.random() - 0.5) * 0.1;
      }
      tempColor.set(agent.color);
      timeOffsetArray[i]     = Math.random() * 10;
      colorArray[i * 3 + 0] = tempColor.r;
      colorArray[i * 3 + 1] = tempColor.g;
      colorArray[i * 3 + 2] = tempColor.b;
    }

    this.debugPosArray       = new Float32Array(posArray);
    this.posAttribute        = new THREE.StorageInstancedBufferAttribute(posArray, 4);
    this.velAttribute        = new THREE.StorageInstancedBufferAttribute(velArray, 4);
    this.timeOffsetAttribute = new THREE.InstancedBufferAttribute(timeOffsetArray, 1);
    this.colorAttribute      = new THREE.InstancedBufferAttribute(colorArray, 3);
    this.positionStorage     = storage(this.posAttribute, 'vec4', this.instanceCount);
    this.velocityStorage     = storage(this.velAttribute, 'vec4', this.instanceCount);

    this.agentStateBuffer = new AgentStateBuffer(this.instanceCount);
    this.agentStateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);

    this.initComputeNode();
    this.createInstancedMesh();
  }

  private initComputeNode() {
    const agentStorage = this.agentStateBuffer!.storageNode;

    this.computeNode = Fn(() => {
      const index      = instanceIndex;
      const posElement = this.positionStorage.element(index);
      const velElement = this.velocityStorage.element(index);
      const agentData  = agentStorage.element(index);
      const agentState = agentData.w;
      const pos        = posElement.xyz.toVar();

      If(this.uPaused.equal(float(1.0)), () => { return; });

      const effectiveSpeed = this.uSpeed.mul(this.uTimeScale);

      If(agentState.greaterThan(float(0.5)), () => {
        If(agentState.greaterThan(float(1.5)), () => {
          const waypointXZ = vec3(agentData.x, float(0), agentData.z);
          const toTarget   = waypointXZ.sub(pos);
          const dist       = toTarget.length();
          If(dist.greaterThan(float(0.2)), () => {
            const gotoVel = toTarget.normalize().mul(effectiveSpeed.mul(3.0));
            velElement.assign(vec4(gotoVel, 0.0));
            posElement.assign(vec4(pos.add(gotoVel), 1.0));
          }).Else(() => { posElement.assign(vec4(pos, 1.0)); });
        }).Else(() => {
          const facing = vec3(agentData.x, float(0), agentData.z);
          If(facing.length().greaterThan(float(0.001)), () => {
            velElement.assign(vec4(facing, 0.0));
          });
          posElement.assign(vec4(pos, 1.0));
        });
      }).Else(() => {
        const vel   = velElement.xyz.toVar();
        const accel = vec3(0).toVar();
        const halfSize = this.uWorldSize;
        If(pos.x.abs().greaterThan(halfSize).or(pos.z.abs().greaterThan(halfSize)), () => {
          accel.addAssign(pos.negate().normalize().mul(0.01));
        });
        Loop({ start: uint(0), end: uint(this.instanceCount), type: 'uint' }, ({ i }) => {
          const otherPos = this.positionStorage.element(i).xyz;
          const diff     = pos.sub(otherPos);
          const dist     = diff.length();
          If(dist.lessThan(this.uSeparationRadius).and(dist.greaterThan(0.01)), () => {
            accel.addAssign(diff.normalize().mul(this.uSeparationStrength));
          });
        });
        const newVel = vel.add(accel).toVar();
        const speed  = newVel.length();
        If(speed.greaterThan(0.001), () => {
          newVel.assign(newVel.normalize().mul(effectiveSpeed));
        }).Else(() => { newVel.assign(vec3(0, 0, effectiveSpeed)); });
        velElement.assign(vec4(newVel, 0.0));
        posElement.assign(vec4(pos.add(newVel), 1.0));
      });
    })().compute(this.instanceCount);
  }

  private createInstancedMesh() {
    const instancedGeometry = new THREE.InstancedBufferGeometry();
    instancedGeometry.copy(this.baseGeometry as any);
    instancedGeometry.instanceCount = this.instanceCount;

    if (this.timeOffsetAttribute) instancedGeometry.setAttribute('instanceTimeOffset', this.timeOffsetAttribute);
    if (this.colorAttribute)      instancedGeometry.setAttribute('instanceColor', this.colorAttribute);

    const material         = new THREE.MeshStandardNodeMaterial();
    material.roughness     = 1;
    material.metalness     = 0.25;
    const map              = (this.baseMaterial as any).map;
    const instanceColor    = attribute('instanceColor', 'vec3');

    if (map) {
      const texColor     = texture(map);
      material.colorNode = vec4(texColor.rgb.mul(instanceColor), texColor.a);
    } else {
      material.colorNode = vec4(instanceColor, 1.0);
    }
    material.positionNode = this.createVertexNode();

    this.instancedMesh              = new THREE.Mesh(instancedGeometry, material);
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.castShadow   = true;
    this.instancedMesh.receiveShadow = true;
    this.scene.add(this.instancedMesh);
  }

  private createVertexNode() {
    return Fn(() => {
      const instancePos  = this.positionStorage.element(instanceIndex).xyz;
      const rawVel       = this.velocityStorage.element(instanceIndex).xyz;
      const timeOffset   = attribute('instanceTimeOffset', 'float');

      const isMoving = rawVel.length().greaterThan(float(0.001));
      const safeVel  = vec3(0, 0, 1).toVar();
      If(isMoving, () => { safeVel.assign(rawVel); });

      const angle       = atan(safeVel.z, safeVel.x).negate().add(float(Math.PI / 2));
      const rotationMat = mat3(
        vec3(cos(angle), float(0), sin(angle).negate()),
        vec3(float(0), float(1), float(0)),
        vec3(sin(angle), float(0), cos(angle))
      );

      const finalPosition = positionLocal.toVar();

      if (this.bakedWalkBuffer && this.bakedIdleBuffer) {
        const walkBuffer  = storage(this.bakedWalkBuffer, 'mat4', this.numWalkFrames * this.numBones);
        const idleBuffer  = storage(this.bakedIdleBuffer, 'mat4', this.numIdleFrames * this.numBones);
        const agentState  = this.agentStateBuffer!.storageNode.element(instanceIndex).w;
        const skinIndex   = attribute('skinIndex', 'uvec4');
        const skinWeight  = attribute('skinWeight', 'vec4');
        const skinMat     = mat4(0).toVar();
        const isFrozen    = agentState.greaterThan(float(0.5)).and(agentState.lessThan(float(1.5)));

        const buildSkinMat = (animBuf: any, numFrames: number, duration: number) => {
          const animTime     = time.add(timeOffset).mul(this.uTimeScale);
          const t            = animTime.div(float(duration)).fract();
          const currentFrame = uint(t.mul(float(numFrames)));
          const safeFrame    = currentFrame.min(uint(numFrames - 1));
          const addInfluence = (boneIdxNode: any, weightNode: any) => {
            If(weightNode.greaterThan(0), () => {
              const address = safeFrame.mul(uint(this.numBones)).add(boneIdxNode);
              skinMat.addAssign(animBuf.element(address).mul(weightNode));
            });
          };
          addInfluence(skinIndex.x, skinWeight.x);
          addInfluence(skinIndex.y, skinWeight.y);
          addInfluence(skinIndex.z, skinWeight.z);
          addInfluence(skinIndex.w, skinWeight.w);
        };

        If(isFrozen, () => {
          buildSkinMat(idleBuffer, this.numIdleFrames, this.idleDuration);
        }).Else(() => {
          buildSkinMat(walkBuffer, this.numWalkFrames, this.walkDuration);
        });

        finalPosition.assign(skinMat.mul(vec4(positionLocal, 1.0)).xyz);
      }

      return rotationMat.mul(finalPosition).add(instancePos);
    })();
  }

  // ─────────────────────────────────────────────────────────────
  //  Animation baking
  // ─────────────────────────────────────────────────────────────

  private bakeAnimation(mesh: THREE.SkinnedMesh, clip: THREE.AnimationClip, root: THREE.Object3D) {
    const mixer    = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();
    const skeleton  = mesh.skeleton;
    const duration  = clip.duration;
    const numFrames = Math.ceil(duration * 60);
    const numBones  = skeleton.bones.length;
    const data      = new Float32Array(numFrames * numBones * 16);
    for (let f = 0; f < numFrames; f++) {
      mixer.setTime((f / numFrames) * duration);
      root.updateMatrixWorld(true);
      skeleton.update();
      for (let b = 0; b < numBones; b++) {
        const idx = (f * numBones + b) * 16;
        for (let k = 0; k < 16; k++) data[idx + k] = skeleton.boneMatrices[b * 16 + k];
      }
    }
    return { buffer: new THREE.StorageBufferAttribute(data, 16), numFrames, numBones, duration };
  }

  // ─────────────────────────────────────────────────────────────
  //  Public accessors
  // ─────────────────────────────────────────────────────────────

  public fadeToAction(_name: string) {}
  public getCount() { return this.instanceCount; }

  public getAgentStateBuffer(): AgentStateBuffer | null { return this.agentStateBuffer; }
  public getCPUPositions(): Float32Array | null          { return this.debugPosArray; }

  public getCPUPosition(index: number): THREE.Vector3 | null {
    if (!this.debugPosArray || index < 0 || index >= this.instanceCount) return null;
    const i = index * 4;
    return new THREE.Vector3(this.debugPosArray[i], this.debugPosArray[i + 1], this.debugPosArray[i + 2]);
  }

  public getAgentState(index: number): number {
    if (!this.agentStateBuffer || index < 0 || index >= this.instanceCount) return 0;
    return this.agentStateBuffer.getState(index);
  }

  public setColors(hexColors: string[]) {
    if (this.isLoaded) { this.cleanupInstances(); this.initInstances(); }
    else { /* store for after load */ }
    void hexColors;
  }
}
