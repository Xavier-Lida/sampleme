'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { WaveformTrack } from '@/components/timeline/WaveformTrack';
import { FIXED_BPM } from '@/types/transcription';
import { cn } from '@/lib/utils';
import type { CachedTrack } from '@/lib/sessionCache';
import { SpeakerHigh, SpeakerSlash, Trash, Eye, EyeSlash, PencilSimple } from '@phosphor-icons/react';
import {
  getInstrumentOptions,
  type PlaybackInstrumentId,
} from '@/lib/music/partition-instruments';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TRACK_LABEL_WIDTH = 180;
const TRACK_HEIGHT = 64;
const PIXELS_PER_SECOND = 80;
const MEASURE_SECONDS = (60 / FIXED_BPM) * 4;
const INSTRUMENT_OPTIONS = getInstrumentOptions();

interface AudioTimelineProps {
  tracks: CachedTrack[];
  duration: number;
  currentTime: number;
  activeTrackId: string | null;
  onSeek?: (seconds: number) => void;
  onToggleMute?: (id: string) => void;
  onToggleHidden?: (id: string) => void;
  onRenameTrack?: (id: string, name: string) => void;
  onDeleteTrack?: (id: string) => void;
  onSelectActiveTrack?: (id: string) => void;
  onTrackInstrumentChange?: (id: string, instrument: PlaybackInstrumentId) => void;
  onAddManualTrack?: () => void;
  className?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioTimeline({
  tracks,
  duration,
  currentTime,
  activeTrackId,
  onSeek,
  onToggleMute,
  onToggleHidden,
  onRenameTrack,
  onDeleteTrack,
  onSelectActiveTrack,
  onTrackInstrumentChange,
  onAddManualTrack,
  className,
}: AudioTimelineProps) {
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  function commitRename(id: string) {
    const trimmed = draftName.trim();
    if (trimmed) onRenameTrack?.(id, trimmed);
    setEditingNameId(null);
  }

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

          <div className="daw-ruler">
            <div className="daw-ruler-label-col" style={{ width: TRACK_LABEL_WIDTH }} />
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
            <div
              className="daw-playhead"
              style={{ left: TRACK_LABEL_WIDTH + playheadLeft }}
            />

            {tracks.map((track) => {
              const isActive = track.id === activeTrackId;
              // Waveform spans only the track's own duration — not the full
              // timeline — so the visual aligns with playback time.
              const trackWaveWidth = Math.max(8, track.duration * PIXELS_PER_SECOND);
              const isEditing = editingNameId === track.id;
              return (
                <div
                  key={track.id}
                  className={cn(
                    'daw-track-row',
                    isActive && 'daw-track-row--active',
                  )}
                  style={{ height: TRACK_HEIGHT }}
                  onClick={() => onSelectActiveTrack?.(track.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className="daw-track-label flex flex-col justify-between py-1.5 px-2 h-full border-r border-border bg-background/50 select-none gap-1"
                    style={{ width: TRACK_LABEL_WIDTH }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ background: track.color }}
                        aria-hidden
                      />
                      {isEditing ? (
                        <input
                          type="text"
                          autoFocus
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onBlur={() => commitRename(track.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(track.id);
                            else if (e.key === 'Escape') setEditingNameId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-[10px] text-foreground bg-background/80 border border-border rounded px-1 py-0.5 min-w-0 flex-1 outline-none focus:border-primary"
                        />
                      ) : (
                        <>
                          <span
                            className="font-semibold text-[10px] text-foreground truncate flex-1"
                            title={track.name}
                          >
                            {track.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDraftName(track.name);
                              setEditingNameId(track.id);
                            }}
                            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Renommer la piste"
                          >
                            <PencilSimple className="size-3" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Select
                        value={track.instrument}
                        onValueChange={(value) =>
                          onTrackInstrumentChange?.(track.id, value as PlaybackInstrumentId)
                        }
                      >
                        <SelectTrigger
                          className="h-6 px-1.5 text-[10px] border-border bg-secondary flex-1 min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectGroup>
                            {INSTRUMENT_OPTIONS.map(({ id, label }) => (
                              <SelectItem key={id} value={id} className="text-xs">
                                {label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleHidden?.(track.id);
                        }}
                        className={cn(
                          'p-0.5 rounded hover:bg-muted transition-colors',
                          track.hidden ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground'
                        )}
                        title={track.hidden ? 'Afficher les notes' : 'Masquer les notes'}
                      >
                        {track.hidden ? <EyeSlash className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMute?.(track.id);
                        }}
                        className={cn(
                          'p-0.5 rounded hover:bg-muted transition-colors',
                          track.muted ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
                        )}
                        title={track.muted ? 'Activer le son' : 'Couper le son'}
                      >
                        {track.muted ? <SpeakerSlash className="size-3.5" /> : <SpeakerHigh className="size-3.5" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Supprimer la piste "${track.name}" ?`)) {
                            onDeleteTrack?.(track.id);
                          }
                        }}
                        className="p-0.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                        title="Supprimer la piste"
                      >
                        <Trash className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div
                    className={cn('daw-track-lane relative', track.muted && 'opacity-40')}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTimelineClick(e);
                      onSelectActiveTrack?.(track.id);
                    }}
                    role="presentation"
                  >
                    <div
                      style={{ position: 'absolute', left: 0, top: 0, width: trackWaveWidth }}
                    >
                      <WaveformTrack
                        peaks={track.peaks}
                        width={trackWaveWidth}
                        height={TRACK_HEIGHT - 8}
                        flat={track.notes.length === 0}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {tracks.length === 0 && (
              <div className="daw-track-row" style={{ height: TRACK_HEIGHT }}>
                <div
                  className="daw-track-label flex flex-col justify-center py-1.5 px-2 h-full border-r border-border bg-background/50"
                  style={{ width: TRACK_LABEL_WIDTH }}
                >
                  <span className="font-semibold text-[10px] text-muted-foreground truncate w-full">
                    Audio
                  </span>
                </div>
                <div
                  className="daw-track-lane relative flex items-center justify-center text-xs text-muted-foreground/60"
                  onClick={handleTimelineClick}
                  role="presentation"
                >
                  Glissez un fichier audio, enregistrez, ou ajoutez une piste manuelle ci-dessous
                </div>
              </div>
            )}

            {onAddManualTrack && (
              <div className="px-3 py-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={onAddManualTrack}
                  className="daw-add-track-btn"
                >
                  <span className="text-base leading-none">+</span>
                  Ajouter une piste
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
