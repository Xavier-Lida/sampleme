'use client';

import { useEffect, useMemo, useRef } from 'react';
import { WaveformTrack } from '@/components/timeline/WaveformTrack';
import { FIXED_BPM } from '@/types/transcription';
import type { Note } from '@/types/transcription';
import { cn } from '@/lib/utils';

const TRACK_LABEL_WIDTH = 80;
const RULER_HEIGHT = 22;
const TRACK_HEIGHT = 54;
const PIXELS_PER_SECOND = 80;
const MEASURE_SECONDS = (60 / FIXED_BPM) * 4;

interface AudioTimelineProps {
  peaks: number[];
  duration: number;
  currentTime: number;
  notes?: Note[];
  onSeek?: (seconds: number) => void;
  className?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioTimeline({
  peaks,
  duration,
  currentTime,
  notes = [],
  onSeek,
  className,
}: AudioTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineWidth = Math.max(duration * PIXELS_PER_SECOND, 320);

  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let t = 0; t <= duration; t += MEASURE_SECONDS) {
      ticks.push(t);
    }
    if (ticks.length > 0 && ticks[ticks.length - 1] !== duration) {
      ticks.push(duration);
    }
    return ticks;
  }, [duration]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || currentTime <= 0) return;

    const playheadX = TRACK_LABEL_WIDTH + currentTime * PIXELS_PER_SECOND;
    const { scrollLeft, clientWidth } = container;
    const margin = 48;

    if (playheadX < scrollLeft + margin) {
      container.scrollLeft = Math.max(0, playheadX - margin);
    } else if (playheadX > scrollLeft + clientWidth - margin) {
      container.scrollLeft = playheadX - clientWidth + margin;
    }
  }, [currentTime]);

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const seconds = Math.max(0, Math.min(duration, x / PIXELS_PER_SECOND));
    onSeek(seconds);
  }

  const playheadLeft = currentTime * PIXELS_PER_SECOND;

  return (
    <div className={cn('daw-tracks-viewport border border-border bg-muted/10 flex-1 min-h-[180px]', className)}>
      <div ref={scrollRef} className="daw-tracks-scroll">
        <div style={{ width: timelineWidth + TRACK_LABEL_WIDTH, minWidth: '100%', position: 'relative' }}>
          
          {/* DAW Ruler (Timeline Bar Headers) */}
          <div className="daw-ruler">
            <div className="daw-ruler-label-col" />
            <div className="daw-ruler-ticks">
              {rulerTicks.map((tick) => (
                <div
                  key={tick}
                  className="daw-ruler-tick"
                  style={{ left: tick * PIXELS_PER_SECOND }}
                >
                  <span>{formatTime(tick)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            {/* Playhead */}
            <div
              className="daw-playhead"
              style={{ left: TRACK_LABEL_WIDTH + playheadLeft }}
            />

            {/* Track 1: Audio Waveform */}
            <div className="daw-track-row">
              <div className="daw-track-label">
                <span className="daw-track-dot bg-cyan-400" />
                Audio
              </div>
              <div
                className="daw-track-lane"
                onClick={handleTimelineClick}
                role="presentation"
              >
                <WaveformTrack peaks={peaks} width={timelineWidth} height={TRACK_HEIGHT} />
              </div>
            </div>

            {/* Track 2: MIDI Notes representation */}
            <div className="daw-track-row">
              <div className="daw-track-label">
                <span className="daw-track-dot bg-purple-500" />
                Notes MIDI
              </div>
              <div className="daw-track-lane relative" onClick={handleTimelineClick} role="presentation">
                {notes.map((note, index) => {
                  const noteLeft = note.start * PIXELS_PER_SECOND;
                  const noteWidth = (note.end - note.start) * PIXELS_PER_SECOND;
                  return (
                    <div
                      key={index}
                      className="daw-track-clip bg-purple-500/40 border border-purple-500/60"
                      style={{
                        left: noteLeft,
                        width: Math.max(12, noteWidth),
                      }}
                    >
                      {note.pitch}
                    </div>
                  );
                })}
                {notes.length === 0 && (
                  <div className="daw-track-empty">Aucune note transcrite</div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
