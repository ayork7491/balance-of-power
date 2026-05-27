/**
 * useLayoutMode — Detects the current layout mode for responsive layout routing.
 *
 * Layout modes:
 *   landscape        — wide screen or landscape orientation (≥ width > height, min 640px wide)
 *   portrait         — tall screen or portrait orientation on mobile (< 640px wide OR height > width)
 *   compactLandscape — short landscape (e.g. mobile landscape 568×320) — docks compressed
 *
 * Philosophy: portrait-supported / landscape-optimized.
 *   Portrait: map-dominant, bottom tabs, slide-over panels.
 *   Landscape: docked sidebars, tactical command-center view.
 *   compactLandscape: sidebars collapsible by default, reduced heights.
 */
import { useState, useEffect } from 'react';

export function useLayoutMode() {
  const [mode, setMode] = useState(() => detectMode());

  useEffect(() => {
    function update() {
      setMode(detectMode());
    }

    // Use ResizeObserver on body for accurate detection
    const ro = new ResizeObserver(update);
    ro.observe(document.body);

    // Also listen to orientationchange for immediate response
    window.addEventListener('orientationchange', update);

    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return mode;
}

function detectMode() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isLandscape = w > h;

  // Desktop or large tablet — always full landscape
  if (w >= 1024) return 'landscape';

  // Medium tablet landscape
  if (isLandscape && w >= 640) {
    // Short landscape (phone in landscape) — compact mode
    if (h < 420) return 'compactLandscape';
    return 'landscape';
  }

  // Portrait phone or tablet
  return 'portrait';
}