
import * as THREE from 'three/webgpu';

export class Engine {
  public renderer: THREE.WebGPURenderer;
  public timer: THREE.Timer;
  /** True only when the WebGPU backend is actually active after init(). */
  public isWebGPU = false;

  private isDisposed = false;

  constructor(container: HTMLElement) {
    const gpuSupported = typeof navigator !== 'undefined' && !!(navigator as any).gpu;

    try {
      this.renderer = new THREE.WebGPURenderer({
        antialias: true,
        forceWebGL: !gpuSupported,
      });
      // Cap at 2× DPR: retina is fine, 3× (iPhone 15 Pro Max etc.) wastes GPU budget.
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      // Use default PCF shadow map — VSM in WebGPU/NodeMaterial can be sensitive.
      this.renderer.shadowMap.enabled = true;
      container.appendChild(this.renderer.domElement);
    } catch (err) {
      console.error('Renderer creation failed, attempting WebGL fallback:', err);
      this.renderer = new THREE.WebGPURenderer({ forceWebGL: true }) as any;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(this.renderer.domElement);
    }

    this.timer = new THREE.Timer();
  }

  public async init(container: HTMLElement) {
    try {
      await this.renderer.init();
      // backend.isWebGLBackend is true when forceWebGL or WebGPU unavailable.
      const backend = (this.renderer as any).backend;
      this.isWebGPU = !(backend?.isWebGLBackend ?? true);
      if (this.isDisposed) this.renderer.dispose();
      return true;
    } catch (e) {
      console.warn('WebGPU init failed, falling back to WebGL:', e);
      try {
        if (this.renderer.domElement.parentNode) {
          this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
        this.renderer.dispose();

        this.renderer = new THREE.WebGPURenderer({ forceWebGL: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        await this.renderer.init();
        this.isWebGPU = false; // confirmed WebGL
        return true;
      } catch (fallbackErr) {
        console.error('WebGL fallback also failed:', fallbackErr);
        return false;
      }
    }
  }

  public onResize(width: number, height: number) {
    if (this.isDisposed) return;
    this.renderer.setSize(width, height);
  }

  public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    if (this.isDisposed) return;
    this.renderer.render(scene, camera);
  }

  public dispose() {
    this.isDisposed = true;
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
