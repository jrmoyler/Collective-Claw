
import * as THREE from 'three/webgpu';

export class Engine {
  public renderer: THREE.WebGPURenderer;
  public timer: THREE.Timer;

  private isDisposed = false;

  constructor(container: HTMLElement) {
    const isWebGPUSupported = typeof navigator !== 'undefined' && !!(navigator as any).gpu;
    
    const checkWebGL2 = () => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        if (!gl) return false;
        // Test if the context is actually functional
        const ext = gl.getSupportedExtensions();
        return !!ext;
      } catch (e) {
        return false;
      }
    };

    const hasWebGL2 = checkWebGL2();
    const useWebGL = !isWebGPUSupported && hasWebGL2;
    
    try {
      if (!isWebGPUSupported && !hasWebGL2) {
        throw new Error("Neither WebGPU nor WebGL2 are supported by this browser/hardware.");
      }

      this.renderer = new THREE.WebGPURenderer({ 
        antialias: true,
        forceWebGL: useWebGL
      });
      
      // Basic setup that doesn't require a functional context yet
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      
      container.appendChild(this.renderer.domElement);
    } catch (err) {
      console.error("Renderer creation failed:", err);
      this.renderer = this.createDummyRenderer();
      if (container && this.renderer.domElement) {
        container.appendChild(this.renderer.domElement);
      }
    }
    
    this.timer = new THREE.Timer();
  }

  private createDummyRenderer() {
    const el = document.createElement('div');
    el.style.width = '100%';
    el.style.height = '100%';
    return {
      isDummy: true,
      init: () => Promise.reject(new Error("No graphics support available")),
      dispose: () => {},
      setSize: () => {},
      setPixelRatio: () => {},
      render: () => {},
      setAnimationLoop: () => {},
      domElement: el,
      shadowMap: { enabled: false },
      info: { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } }
    } as any;
  }

  public async init(container: HTMLElement) {
    if (!this.renderer || (this.renderer as any).isDummy) {
      console.error("Engine init called but renderer is missing or dummy");
      return false;
    }

    try {
      // Basic check before calling the potentially crashing init()
      const canvas = this.renderer.domElement;
      if (canvas instanceof HTMLCanvasElement) {
        // If we are in WebGL mode, check if we can actually get a context
        const isWebGPU = !(this.renderer as any).backend || (this.renderer as any).backend.isWebGPUBackend;
        if (!isWebGPU) {
          const gl = canvas.getContext('webgl2');
          if (!gl) throw new Error("Could not acquire WebGL2 context from renderer canvas");
        }
      }

      await this.renderer.init();
      
      if (this.renderer.shadowMap) {
        this.renderer.shadowMap.enabled = true;
      }

      if (this.isDisposed) {
        this.renderer.dispose();
      }
      return true;
    } catch (e) {
      console.warn("Primary renderer init failed, trying fallback:", e);
      
      try {
        if (this.renderer.domElement && this.renderer.domElement.parentNode) {
          this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
        
        if (!(this.renderer as any).isDummy) {
          try { this.renderer.dispose(); } catch (ignore) {}
        }
        
        // Final attempt: Create a fresh canvas and force WebGL
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        if (!gl) throw new Error("WebGL2 context unavailable for fallback");
        
        // Check if getSupportedExtensions exists on this context
        if (typeof gl.getSupportedExtensions !== 'function') {
          throw new Error("WebGL2 context is broken - getSupportedExtensions missing");
        }

        this.renderer = new THREE.WebGPURenderer({ forceWebGL: true, canvas });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        
        await this.renderer.init();
        
        if (this.renderer.shadowMap) {
          this.renderer.shadowMap.enabled = true;
        }

        container.appendChild(this.renderer.domElement);
        return true;
      } catch (fallbackErr) {
        console.error("All renderer fallbacks failed:", fallbackErr);
        this.renderer = this.createDummyRenderer();
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
