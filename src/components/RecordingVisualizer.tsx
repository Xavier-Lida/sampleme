'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  active: boolean;
  analyserRef: MutableRefObject<AnalyserNode | null>;
  className?: string;
  rings?: number;
  size?: number;
}

// Listens to the live mic analyser via requestAnimationFrame and animates
// concentric rings whose scale tracks the current RMS amplitude. Avoids React
// state so we don't trigger 60fps re-renders.
export function RecordingVisualizer({
  active,
  analyserRef,
  className,
  rings = 3,
  size = 56,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const ringEls = Array.from(
      container.querySelectorAll<HTMLDivElement>('[data-ring]'),
    );
    const dotEl = container.querySelector<HTMLDivElement>('[data-dot]');

    const analyser = analyserRef.current;
    if (!analyser) return;

    const buf = new Uint8Array(analyser.fftSize);
    // Recent amplitudes per ring so each ring lags the previous → ripple feel.
    const history: number[] = new Array(rings).fill(0);
    let raf = 0;

    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      // Boost so quiet voices register, clamp so very loud peaks stay sane.
      const amp = Math.min(1, rms * 4);

      // Lag each successive ring behind the previous frame's amplitude.
      for (let i = history.length - 1; i > 0; i--) {
        history[i] = history[i - 1] * 0.9;
      }
      history[0] = amp;

      ringEls.forEach((el, i) => {
        const scale = 1 + history[i] * (0.6 + i * 0.25);
        const opacity = Math.max(0.05, 0.5 - i * 0.15) * (0.4 + history[i]);
        el.style.transform = `scale(${scale})`;
        el.style.opacity = String(opacity);
      });
      if (dotEl) {
        dotEl.style.transform = `scale(${1 + amp * 0.25})`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, analyserRef, rings]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {Array.from({ length: rings }).map((_, i) => (
        <div
          key={i}
          data-ring
          className="absolute inset-0 rounded-full border border-red-500/60 bg-red-500/10 will-change-transform"
          style={{ transition: 'transform 60ms linear, opacity 60ms linear' }}
        />
      ))}
      <div
        data-dot
        className="relative size-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] will-change-transform"
        style={{ transition: 'transform 60ms linear' }}
      />
    </div>
  );
}
