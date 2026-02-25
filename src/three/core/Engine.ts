
import * as THREE from 'three/webgpu';

export class Engine {
  public renderer: THREE.WebGPURenderer;
  public timer: THREE.Timer;

  private isDisposed = false;

  constructor(container: HTMLElement) {
    const isWebGPUSupported = typeof navigator !== 'undefined' && !!(navigator as any).gpu;
    
    try {
      this.renderer = new THREE.WebGPURenderer({ 
        antialias: true,
        forceWebGL: !isWebGPUSupported
      });
      
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      
      // Use default shadow map (PCF) as VSM support in WebGPU/NodeMaterial can be sensitive
      this.renderer.shadowMap.enabled = true;
      
      container.appendChild(this.renderer.domElement);
    } catch (err) {
      console.error("Renderer creation failed, attempting fallback:", err);
      // Fallback to a basic renderer if WebGPURenderer completely fails to construct
      this.renderer = new THREE.WebGPURenderer({ forceWebGL: true }) as any;
      container.appendChild(this.renderer.domElement);
    }
    
    this.timer = new THREE.Timer();
  }

  public async init(container: HTMLElement) {
    try {
      await this.renderer.init();
      if (this.isDisposed) {
        this.renderer.dispose();
      }
      return true;
    } catch (e) {
      console.warn("WebGPU init failed, trying WebGL fallback:", e);
      
      // If WebGPU init failed, try to recreate the renderer with forceWebGL
      try {
        if (this.renderer.domElement.parentNode) {
          this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
        this.renderer.dispose();
        
        this.renderer = new THREE.WebGPURenderer({ forceWebGL: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);
        
        await this.renderer.init();
        return true;
      } catch (fallbackErr) {
        console.error("WebGL fallback also failed:", fallbackErr);
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
