/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SceneManager } from './three/SceneManager';
import UIOverlay from './components/UIOverlay';
import { useStore } from './store/useStore';

const App: React.FC = () => {
  const canvasRef  = useRef<HTMLDivElement>(null);
  const managerRef = useRef<SceneManager | null>(null);
  const [isReady, setIsReady] = useState(false);
  const error = useStore((s) => s.error);

  useEffect(() => {
    let isMounted = true;

    // Small delay so the layout paints before we start the heavy GL init.
    const timer = setTimeout(() => {
      if (isMounted && canvasRef.current && !managerRef.current) {
        managerRef.current = new SceneManager(canvasRef.current, () => {
          if (isMounted) setIsReady(true);
        });
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
      {/* Three.js canvas container — touch-none prevents scroll hijacking on mobile */}
      <div ref={canvasRef} className="absolute inset-0 w-full h-full touch-none" />

      {/* UI Layer */}
      <UIOverlay />

      {/* Loading screen — fades out once the scene signals it's ready */}
      <AnimatePresence>
        {!isReady && !error && (
          <motion.div
            key="loading"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center gap-6 select-none"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-2.5 h-12 bg-[#7EACEA] rounded-full" />
              <h1 className="text-2xl font-black text-zinc-900 tracking-tight">CollectiveClaw</h1>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
                Initialising simulation&hellip;
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              {[0, 150, 300].map((delay) => (
                <div
                  key={delay}
                  className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
