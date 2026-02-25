import * as THREE from 'three/webgpu';
import { AgentStateBuffer } from '../behavior/AgentStateBuffer';
import { AgentBehavior } from '../../types';

export class SpeechBubbles {
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private maxInstances: number;

  constructor(scene: THREE.Scene, maxInstances: number) {
    this.maxInstances = maxInstances;

    // Create a speech bubble texture using Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    // Draw speech bubble — roundRect polyfill for Safari < 15.4 / Firefox < 112
    const roundRect = (
      c: CanvasRenderingContext2D,
      x: number, y: number, w: number, h: number, r: number
    ) => {
      if (typeof c.roundRect === 'function') {
        c.roundRect(x, y, w, h, r);
      } else {
        c.moveTo(x + r, y);
        c.arcTo(x + w, y,     x + w, y + h, r);
        c.arcTo(x + w, y + h, x,     y + h, r);
        c.arcTo(x,     y + h, x,     y,     r);
        c.arcTo(x,     y,     x + w, y,     r);
        c.closePath();
      }
    };

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    roundRect(ctx, 16, 16, 96, 64, 16);
    ctx.fill();
    
    // Tail
    ctx.beginPath();
    ctx.moveTo(64, 80);
    ctx.lineTo(48, 100);
    ctx.lineTo(80, 80);
    ctx.fill();
    
    // Dots
    ctx.fillStyle = '#18181b'; // zinc-900
    ctx.beginPath();
    ctx.arc(44, 48, 6, 0, Math.PI * 2);
    ctx.arc(64, 48, 6, 0, Math.PI * 2);
    ctx.arc(84, 48, 6, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.PlaneGeometry(0.5, 0.5);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    this.mesh.count = 0; // Start with 0 visible
    this.mesh.renderOrder = 999; // Render on top
    
    scene.add(this.mesh);
  }

  public update(positions: Float32Array, stateBuffer: AgentStateBuffer, camera: THREE.Camera) {
    let visibleCount = 0;
    const time = Date.now() * 0.005;

    for (let i = 0; i < this.maxInstances; i++) {
      const state = stateBuffer.getState(i);
      if (state === AgentBehavior.FROZEN) {
        // NPC is in conversation
        const x = positions[i * 4];
        const y = positions[i * 4 + 1] + 1.8; // Above head
        const z = positions[i * 4 + 2];

        // Add a subtle floating animation
        const floatOffset = Math.sin(time + i) * 0.05;

        this.dummy.position.set(x, y + floatOffset, z);
        
        // Make the bubble face the camera
        this.dummy.quaternion.copy(camera.quaternion);
        
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(visibleCount, this.dummy.matrix);
        visibleCount++;
      }
    }

    this.mesh.count = visibleCount;
    if (visibleCount > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose() {
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach(m => m.dispose());
    } else {
      this.mesh.material.dispose();
    }
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}
