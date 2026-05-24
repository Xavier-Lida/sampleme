'use client';

import { useEffect, useState } from 'react';

const MOBILE_UA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
const MOBILE_WIDTH = 768;

// SSR-safe: defaults to false, then re-evaluates after mount based on UA + viewport.
// Re-checks on resize so rotating a tablet or opening DevTools updates the layout.
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function check() {
      const byWidth = window.innerWidth < MOBILE_WIDTH;
      const byUA = MOBILE_UA.test(navigator.userAgent);
      setIsMobile(byWidth || byUA);
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
