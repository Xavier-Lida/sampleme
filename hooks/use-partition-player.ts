"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import {
  clearScheduledEvents,
  createPartitionSynth,
  getPlaybackDurationSeconds,
  schedulePartitionOnTransport,
} from "@/lib/music/partition-to-tone";
import type { PartitionResponse } from "@/lib/types/partition";

function disposeTransport(
  eventIds: number[],
  synth: Tone.PolySynth | null,
): void {
  clearScheduledEvents(eventIds);
  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.seconds = 0;
  synth?.releaseAll();
  synth?.dispose();
}

export function usePartitionPlayer(partition: PartitionResponse | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const synthRef = useRef<Tone.PolySynth | null>(null);
  const eventIdsRef = useRef<number[]>([]);
  const durationRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const stopProgressLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startProgressLoop = useCallback(() => {
    stopProgressLoop();

    const tick = () => {
      const duration = durationRef.current;
      if (duration > 0) {
        const value = Math.min(Tone.Transport.seconds / duration, 1);
        setProgress(value);
        if (value >= 1) {
          setIsPlaying(false);
          stopProgressLoop();
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stopProgressLoop]);

  const resetPlaybackState = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const setupTransport = useCallback(() => {
    if (!partition) return;

    disposeTransport(eventIdsRef.current, synthRef.current);
    eventIdsRef.current = [];
    synthRef.current = null;

    durationRef.current = getPlaybackDurationSeconds(partition);
    synthRef.current = createPartitionSynth();
    eventIdsRef.current = schedulePartitionOnTransport(
      partition,
      synthRef.current,
    );
  }, [partition]);

  useEffect(() => {
    setupTransport();

    return () => {
      stopProgressLoop();
      disposeTransport(eventIdsRef.current, synthRef.current);
      eventIdsRef.current = [];
      synthRef.current = null;
    };
  }, [partition, setupTransport, stopProgressLoop]);

  const play = useCallback(async () => {
    if (!partition) return;
    await Tone.start();
    setupTransport();
    Tone.Transport.seconds = 0;
    setProgress(0);
    Tone.Transport.start();
    setIsPlaying(true);
    startProgressLoop();
  }, [partition, setupTransport, startProgressLoop]);

  const pause = useCallback(() => {
    Tone.Transport.pause();
    setIsPlaying(false);
    stopProgressLoop();
  }, [stopProgressLoop]);

  const stop = useCallback(() => {
    setupTransport();
    resetPlaybackState();
  }, [resetPlaybackState, setupTransport]);

  return {
    isPlaying,
    progress,
    play,
    pause,
    stop,
    durationSeconds: partition ? getPlaybackDurationSeconds(partition) : 0,
  };
}
