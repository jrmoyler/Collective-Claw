/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


import React, { useEffect, useRef } from 'react';
import { SceneManager } from './three/SceneManager';
import UIOverlay from './components/UIOverlay';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<SceneManager | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    // Delay creation slightly to allow previous WebGPU context to be fully destroyed during HMR
    const timer = setTimeout(() => {
      if (isMounted && canvasRef.current && !managerRef.current) {
        managerRef.current = new SceneManager(canvasRef.current);
      }
    }, 50);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-screen h-screen bg-white overflow-hidden">
      {/* Three.js Container */}
      <div ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* UI Layer */}
      <UIOverlay />
    </div>
  );
};

export default App;
